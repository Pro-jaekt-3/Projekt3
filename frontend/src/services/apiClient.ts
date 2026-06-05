import { auth } from "../lib/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const API_CONFIG_ERROR =
  "Missing frontend API configuration: set VITE_API_URL in frontend/.env.";

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

const buildHeaders = async (
  headers?: HeadersInit,
  authRequired = true
) => {
  const resolvedHeaders = new Headers(headers);

  if (authRequired) {
    const token = await getAuthToken();
    resolvedHeaders.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  return resolvedHeaders;
};

const extractErrorMessage = async (
  response: Response
) => {
  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }

  return `Request failed with status ${response.status}`;
};

export const apiFetch = async (
  path: string,
  options: ApiRequestOptions = {}
) => {
  if (!API_BASE_URL) {
    throw new Error(API_CONFIG_ERROR);
  }

  const {
    authRequired = true,
    headers,
    ...rest
  } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: await buildHeaders(
      headers,
      authRequired
    ),
  });
};

export const apiJsonFetch = async <T = any>(
  path: string,
  options: ApiRequestOptions = {}
) => {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response)
    );
  }

  return (await response.json()) as T;
};

export const apiEnsureOk = async (
  path: string,
  options: ApiRequestOptions = {}
) => {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response)
    );
  }
};
