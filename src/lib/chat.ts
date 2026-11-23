import type { ChatMessage } from '@/types';

/**
 * Merge a live (socket) message into the list without duplicates:
 * - already present by id → unchanged
 * - my own message echoed back while my optimistic copy is pending → replace it
 * - otherwise append
 */
export function mergeIncoming(list: ChatMessage[], msg: ChatMessage, meId?: string): ChatMessage[] {
  if (list.some((m) => m.id === msg.id)) return list;
  if (msg.senderId === meId) {
    const i = list.findIndex((m) => m.pending && m.text === msg.text);
    if (i >= 0) return list.map((m, j) => (j === i ? msg : m));
  }
  return [...list, msg];
}

/** Settle an optimistic send with the saved message (the socket echo may have landed first). */
export function settleOptimistic(list: ChatMessage[], optimisticId: string, saved: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === saved.id)) return list.filter((m) => m.id !== optimisticId);
  return list.map((m) => (m.id === optimisticId ? saved : m));
}

/** After a refetch, keep still-pending optimistic messages at the end. */
export function withPending(fresh: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  const pending = current.filter((m) => m.pending && !fresh.some((f) => f.senderId === m.senderId && f.text === m.text));
  return [...fresh, ...pending];
}

// ---- "Seen" markers for unread dots (per browser) --------------------------
const SEEN_PREFIX = 'hudlgo-chat-seen:';

export function markThreadSeen(threadId: string, at: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(SEEN_PREFIX + threadId, at);
  } catch {
    /* storage unavailable — unread dots just stay off */
  }
}

export function threadSeenAt(threadId: string): string | null {
  try {
    return localStorage.getItem(SEEN_PREFIX + threadId);
  } catch {
    return null;
  }
}

/** Unread when the latest message is someone else's and newer than my last visit. */
export function isThreadUnread(threadId: string, last: ChatMessage | undefined, meId?: string): boolean {
  if (!last || last.senderId === meId) return false;
  const seen = threadSeenAt(threadId);
  return !seen || last.sentAt > seen;
}
