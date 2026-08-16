export const API_BASE_URL = "http://localhost:8000";

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
