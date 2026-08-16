// Configurable so the app can point at something other than a laptop.
export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000";

// Derived, never declared separately. Live Monitor used to open a literal
// ws://localhost:8000 while SystemStatus derived its own from API_BASE_URL --
// so the two disagreed the moment the API moved, and Monitor silently kept
// talking to localhost. Replacing only the leading scheme keeps https -> wss.
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Shared fetch wrapper: checks res.ok, reads FastAPI's {detail} on failure,
 * and treats a body-level {status: "error"} the same as an HTTP failure —
 * so a real backend error always reaches the UI instead of a generic
 * "invalid response" message or a silent catch.
 */
export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err: any) {
    return { ok: false, data: null, error: `Could not reach the backend at ${API_BASE_URL}: ${err?.message || err}` };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : `Backend returned ${res.status} ${res.statusText}`;
    return { ok: false, data: null, error: message };
  }

  if (body && typeof body === "object" && "status" in body && body.status !== "success") {
    return { ok: false, data: null, error: body.detail || body.message || "Backend reported a non-success status." };
  }

  return { ok: true, data: body as T, error: null };
}
