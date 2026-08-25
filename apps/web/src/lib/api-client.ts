import { useAuthStore } from "@/store/auth-store";
import { handleMockRequest } from "./mock/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * When true, every request is served from the in-memory fixture layer in
 * `src/lib/mock/` instead of hitting the NestJS API. Set
 * NEXT_PUBLIC_USE_MOCK_DATA=true in `.env.local` (requires a dev-server restart).
 */
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { tokens, setTokens, clearSession } = useAuthStore.getState();
  if (!tokens?.refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken as string;
  } catch {
    clearSession();
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, body, headers, ...rest } = options;

  // Mock mode short-circuits before any network call. `handleMockRequest`
  // already throws `ApiError`, so it propagates untouched and every existing
  // `error instanceof ApiError` check in the pages keeps working.
  if (USE_MOCK_DATA) {
    return (await handleMockRequest(rest.method ?? "GET", path, body)) as T;
  }

  const { tokens } = useAuthStore.getState();

  const doFetch = async (accessToken: string | null) => {
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    if (!skipAuth && accessToken) {
      finalHeaders.Authorization = `Bearer ${accessToken}`;
    }

    return fetch(`${API_URL}/api/v1${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch(tokens?.accessToken ?? null);

  if (response.status === 401 && !skipAuth) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newAccessToken = await refreshPromise;
    if (newAccessToken) {
      response = await doFetch(newAccessToken);
    }
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = await response.json();
      message = errorBody.message ?? message;
    } catch {
      // response body wasn't JSON — fall back to statusText
    }
    throw new ApiError(response.status, Array.isArray(message) ? message.join(", ") : message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
