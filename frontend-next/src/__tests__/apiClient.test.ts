import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase before importing apiClient — the real module initialises the
// Firebase app at import time, which must never happen in tests.
const getIdToken = vi.fn();
const firebaseAuth: { currentUser: { getIdToken: typeof getIdToken } | null } = {
  currentUser: { getIdToken },
};

vi.mock("@/lib/firebase", () => ({
  get auth() {
    return firebaseAuth;
  },
}));

import { apiFetch, apiJsonFetch, apiEnsureOk } from "@/services/apiClient";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("apiClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAuth.currentUser = { getIdToken };
    getIdToken.mockResolvedValue("test-token-123");
    vi.stubGlobal("fetch", fetchMock);
  });

  describe("apiFetch", () => {
    it("prepends VITE_API_URL and attaches the Bearer token", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

      await apiFetch("/topics");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("http://api.test/topics");
      expect((options.headers as Headers).get("Authorization")).toBe(
        "Bearer test-token-123",
      );
    });

    it("throws when no user is signed in", async () => {
      firebaseAuth.currentUser = null;

      await expect(apiFetch("/topics")).rejects.toThrow(
        "You must be signed in to perform this action.",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips the token when authRequired is false", async () => {
      firebaseAuth.currentUser = null;
      fetchMock.mockResolvedValue(jsonResponse({}));

      await apiFetch("/public", { authRequired: false });

      const [, options] = fetchMock.mock.calls[0];
      expect((options.headers as Headers).get("Authorization")).toBeNull();
    });
  });

  describe("apiJsonFetch", () => {
    it("parses JSON on success", async () => {
      fetchMock.mockResolvedValue(jsonResponse([{ id: 1, name: "UML" }]));

      const result = await apiJsonFetch<Array<{ id: number; name: string }>>("/topics");

      expect(result).toEqual([{ id: 1, name: "UML" }]);
    });

    it("throws the backend { error } message on non-2xx", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "Topic not found" }, { status: 404 }),
      );

      await expect(apiJsonFetch("/topics/999")).rejects.toThrow("Topic not found");
    });

    it("falls back to a status message when the error body is not JSON", async () => {
      fetchMock.mockResolvedValue(
        new Response("<html>oops</html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      );

      await expect(apiJsonFetch("/topics")).rejects.toThrow(
        "Request failed with status 500",
      );
    });

    it("returns undefined for 204 No Content", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      const result = await apiJsonFetch("/topics/1");

      expect(result).toBeUndefined();
    });

    it("returns undefined for an empty body", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 200 }));

      const result = await apiJsonFetch("/topics/1");

      expect(result).toBeUndefined();
    });
  });

  describe("apiEnsureOk", () => {
    it("resolves on 2xx without parsing the body", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await expect(apiEnsureOk("/topics/1")).resolves.toBeUndefined();
    });

    it("throws the backend error message on failure", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "Forbidden" }, { status: 403 }),
      );

      await expect(apiEnsureOk("/topics/1")).rejects.toThrow("Forbidden");
    });
  });
});
