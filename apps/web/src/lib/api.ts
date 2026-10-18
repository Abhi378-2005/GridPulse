const rawServerUrl = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
export const SERVER_URL = rawServerUrl.startsWith('http://') || rawServerUrl.startsWith('https://')
  ? rawServerUrl
  : `https://${rawServerUrl}`;

const TOKEN_KEY = 'gridpulse.token';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private window) — the session just won't persist
  }
}

/** JSON request to the GridPulse API. Throws an Error with the server's message on failure. */
export async function apiFetch<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

/** Download a file from an authenticated endpoint. */
export async function apiDownload(path: string, token: string, filename: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
