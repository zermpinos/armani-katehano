function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)__Host-ak_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export function apiFetch(url: string, init: Record<string, any> = {}): Promise<Response> {
  const method = ((init.method as string | undefined) ?? "GET").toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      init = { ...init, headers: { ...init.headers, "X-CSRF-Token": token } };
    }
  }
  return fetch(url, init);
}
