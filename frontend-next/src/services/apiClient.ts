import { auth } from "@/lib/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const API_CONFIG_ERROR =
  "Missing frontend API configuration: set VITE_API_URL in frontend-next/.env.";

if (!API_BASE_URL) {
  console.warn(API_CONFIG_ERROR);
}

type ApiRequestOptions = RequestInit & {
  authRequired?: boolean;
};

const getAuthToken = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("You must be signed in to perform this action.");
  }

  return currentUser.getIdToken();
};

const buildHeaders = async (headers?: HeadersInit, authRequired = true) => {
  const resolvedHeaders = new Headers(headers);

  if (authRequired) {
    const token = await getAuthToken();
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  return resolvedHeaders;
};

const extractErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);

    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  }

  return `Request failed with status ${response.status}`;
};

/**
 * Low-level fetch: prepends VITE_API_URL and (by default) attaches the Firebase
 * `Authorization: Bearer <ID token>` header. Returns the raw Response.
 */
export const apiFetch = async (path: string, options: ApiRequestOptions = {}) => {
  if (!API_BASE_URL) {
    throw new Error(API_CONFIG_ERROR);
  }

  const { authRequired = true, headers, ...rest } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: await buildHeaders(headers, authRequired),
  });
};

/**
 * Fetch + JSON parse. Throws Error(message) using the backend `{ error }` field
 * on non-2xx. Returns `undefined` for 204 / empty-body responses.
 */
export const apiJsonFetch = async <T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  // No content: 204, or empty body (e.g. content-length 0).
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
};

/**
 * Fetch that only asserts a 2xx status (for endpoints whose body we ignore).
 */
export const apiEnsureOk = async (path: string, options: ApiRequestOptions = {}) => {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
};
