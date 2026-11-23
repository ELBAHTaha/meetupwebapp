// ---------------------------------------------------------------------------
// One shared socket.io connection to the backend (real-time chat + live
// notification counts). Only active against the real API (VITE_API_URL set);
// in mock mode every export is a harmless no-op.
//
// Lifecycle:
//   • startRealtime() after login (called from the app layouts)
//   • reconnects with the fresh access token whenever tokens change (refresh)
//   • an expired-token handshake triggers a token refresh, then a reconnect
//   • tokens.clear() (logout) disconnects
// ---------------------------------------------------------------------------
import { io, type Socket } from 'socket.io-client';
import { API_URL, TOKENS_CHANGED_EVENT, USE_REMOTE, refreshAccessToken, tokens } from '@/api/http';

type Handler = (payload: never) => void;

let socket: Socket | null = null;
let hasConnectedOnce = false;
let lastRefreshAttempt = 0;
const handlers = new Map<string, Set<Handler>>();
const threadRefs = new Map<string, number>();
const resyncListeners = new Set<() => void>();

function dispatch(event: string, payload: unknown): void {
  handlers.get(event)?.forEach((fn) => (fn as (p: unknown) => void)(payload));
}

function create(): Socket {
  const s = io(API_URL, {
    autoConnect: false,
    // Function form: read the CURRENT token on every (re)connect attempt.
    auth: (cb) => cb({ token: tokens.access ?? '' }),
    transports: ['websocket', 'polling'],
  });
  s.onAny((event: string, payload: unknown) => dispatch(event, payload));
  s.on('connect', () => {
    // Re-subscribe to open threads (rooms don't survive a reconnect)…
    threadRefs.forEach((_n, eventId) => s.emit('thread:join', { eventId }));
    // …and let screens refetch anything they may have missed while offline.
    if (hasConnectedOnce) resyncListeners.forEach((fn) => fn());
    hasConnectedOnce = true;
  });
  s.on('connect_error', (err: Error) => {
    // Expired/invalid access token → refresh it; tokens.set() fires
    // TOKENS_CHANGED which reconnects. Rate-limited to avoid a refresh loop.
    if (err.message === 'UNAUTHORIZED' && tokens.refresh && Date.now() - lastRefreshAttempt > 30_000) {
      lastRefreshAttempt = Date.now();
      void refreshAccessToken();
    }
    // FORBIDDEN (suspended/banned) → stay disconnected.
  });
  return s;
}

/** Open the shared connection (no-op in mock mode or when signed out). */
export function startRealtime(): void {
  if (!USE_REMOTE || !tokens.access) return;
  if (!socket) socket = create();
  if (!socket.connected && !socket.active) socket.connect();
}

export function stopRealtime(): void {
  socket?.disconnect();
}

if (USE_REMOTE && typeof window !== 'undefined') {
  window.addEventListener(TOKENS_CHANGED_EVENT, () => {
    if (!tokens.access) {
      stopRealtime();
      return;
    }
    // New token (login or refresh): re-handshake so the server sees it.
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  });
}

/** Listen to a server event. Returns an unsubscribe function. */
export function onSocket<T>(event: string, fn: (payload: T) => void): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(fn as Handler);
  return () => handlers.get(event)?.delete(fn as Handler);
}

/** Called after a reconnect so screens can refetch what they may have missed. */
export function onResync(fn: () => void): () => void {
  resyncListeners.add(fn);
  return () => resyncListeners.delete(fn);
}

/** Subscribe to a group chat's room (ref-counted). Returns an unsubscribe function. */
export function subscribeThread(eventId: string): () => void {
  if (!USE_REMOTE || !eventId) return () => undefined;
  threadRefs.set(eventId, (threadRefs.get(eventId) ?? 0) + 1);
  if (socket?.connected) socket.emit('thread:join', { eventId });
  return () => {
    const n = (threadRefs.get(eventId) ?? 1) - 1;
    if (n > 0) {
      threadRefs.set(eventId, n);
      return;
    }
    threadRefs.delete(eventId);
    if (socket?.connected) socket.emit('thread:leave', { eventId });
  };
}
