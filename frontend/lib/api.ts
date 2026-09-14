/**
 * Single API client for the whole app. Every request to the backend goes
 * through here so base URL, auth headers, and error normalization live in
 * exactly one place (see coding-standards.md).
 */

import { getAccessToken, notifySessionExpired, setAccessToken } from "./auth/token-store";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
}

// Codes that mean "the access token is missing/expired" — worth one
// silent refresh + retry before surfacing an error to the caller. Auth
// endpoint failures (wrong password, wrong PIN, locked out, etc.) use
// different codes and never trigger this path.
const RETRYABLE_AUTH_CODES = new Set(["INVALID_TOKEN", "UNAUTHENTICATED"]);

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { accessToken: string };
        setAccessToken(body.accessToken);
        return body.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request<TResponse>(
  path: string,
  options: RequestInit = {},
  allowAuthRetry = true,
  isFormData = false,
): Promise<TResponse> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      // A `FormData` body (file upload) must NOT get an explicit
      // Content-Type — the browser sets `multipart/form-data` with the
      // correct boundary itself; overriding it here would break parsing on
      // the server (see `api.postForm` / the Marketing Contacts CSV import).
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    // httpOnly refresh-token cookie travels with every request automatically.
    credentials: "include",
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;

    if (
      response.status === 401 &&
      allowAuthRetry &&
      errorBody?.code &&
      RETRYABLE_AUTH_CODES.has(errorBody.code)
    ) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<TResponse>(path, options, false, isFormData);
      }
      setAccessToken(null);
      notifySessionExpired();
    }

    throw new ApiError(
      errorBody?.message ?? "Something went wrong. Please try again.",
      response.status,
      errorBody?.code ?? "UNKNOWN_ERROR",
    );
  }

  return body as TResponse;
}

export const api = {
  get: <TResponse>(path: string, headers?: Record<string, string>) => request<TResponse>(path, { method: "GET", headers }),
  post: <TResponse>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<TResponse>(path, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <TResponse>(path: string, body?: unknown) =>
    request<TResponse>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <TResponse>(path: string, body?: unknown) =>
    request<TResponse>(path, {
      method: "DELETE",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  /** POST a `FormData` body (file upload) — see the `isFormData` note on
   * `request` above for why this can't just reuse `api.post`. */
  postForm: <TResponse>(path: string, formData: FormData) =>
    request<TResponse>(path, { method: "POST", body: formData }, true, true),
};
