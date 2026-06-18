// ---------------------------------------------------------------------------
// HTTP client for the hudlgo backend (NestJS). Activated when VITE_API_URL is set;
// otherwise the app keeps using the in-memory mock in `src/api/index.ts`.
//
// Handles: base URL, JWT Authorization header, and transparent refresh-on-401
// with a single in-flight refresh.
// ---------------------------------------------------------------------------

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** True when the app should talk to the real backend instead of the mock. */
export const USE_REMOTE = API_URL.length > 0;

const ACCESS_KEY = 'jmaa-access-token';
const REFRESH_KEY = 'jmaa-refresh-token';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(pair: { accessToken?: string; refreshToken?: string }) {
    if (pair.accessToken) localStorage.setItem(ACCESS_KEY, pair.accessToken);
    if (pair.refreshToken) localStorage.setItem(REFRESH_KEY, pair.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        tokens.set(data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  /** FormData for multipart (file upload) requests. */
  form?: FormData;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOpts = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // browser sets multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body });

  if (res.status === 401 && retry && (await doRefresh())) {
    return request<T>(path, opts, false);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = Array.isArray(err.message) ? err.message.join(', ') : err.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, form: FormData, method = 'POST') => request<T>(path, { method, form }),
};
