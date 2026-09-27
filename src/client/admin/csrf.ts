function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)__Host-ak_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiFetch(url: string, init: Record<string, any> = {}): Promise<Response> {
  const method = ((init.method as string | undefined) ?? "GET").toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      init = { ...init, headers: { ...init.headers, "X-CSRF-Token": token } };
    }
  }
  const res = await fetch(url, init);
  // The login endpoints answer 401 for a wrong password; only an admin API 401 means the session died.
  if (res.status === 401 && url.startsWith("/api/admin/")) onUnauthorized?.();
  return res;
}
