import { describe, it, expect } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { ensureAuthenticated, ensureRole } from "@/lib/route-guards";
import type { AuthState, Role } from "@/lib/role-context";

const noop = () => {};

function makeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    role: "instructor" as Role,
    user: { name: "Test", email: "test@example.com", role: "instructor" },
    isAuthenticated: true,
    isLoading: false,
    authError: false,
    setRole: noop,
    login: noop,
    logout: noop,
    ...overrides,
  };
}

/** Run a guard and return the thrown redirect (or null if it passed). */
function catchRedirect(fn: () => void) {
  try {
    fn();
    return null;
  } catch (err) {
    if (isRedirect(err)) return err as { options: { to?: string; search?: unknown } };
    throw err;
  }
}

describe("ensureAuthenticated", () => {
  it("passes silently for an authenticated user", () => {
    expect(() =>
      ensureAuthenticated({ auth: makeAuth(), href: "/app/dashboard" }),
    ).not.toThrow();
  });

  it("redirects to /login preserving the destination when unauthenticated", () => {
    const redirect = catchRedirect(() =>
      ensureAuthenticated({ auth: makeAuth({ isAuthenticated: false }), href: "/app/questions" }),
    );

    expect(redirect).not.toBeNull();
    expect(redirect!.options.to).toBe("/login");
    expect(redirect!.options.search).toEqual({ redirect: "/app/questions" });
  });

  it("never redirects while auth is still resolving (isLoading)", () => {
    expect(() =>
      ensureAuthenticated({
        auth: makeAuth({ isAuthenticated: false, isLoading: true }),
        href: "/app/dashboard",
      }),
    ).not.toThrow();
  });

  it("tolerates the router-context placeholder window where auth is undefined", () => {
    expect(() =>
      ensureAuthenticated({
        auth: undefined as unknown as AuthState,
        href: "/app/dashboard",
      }),
    ).not.toThrow();
  });
});

describe("ensureRole", () => {
  it("passes when the user's role is allowed", () => {
    expect(() =>
      ensureRole({ auth: makeAuth({ role: "admin" }), href: "/app/users" }, ["admin"]),
    ).not.toThrow();
  });

  it("redirects to the dashboard when the role is not allowed", () => {
    const redirect = catchRedirect(() =>
      ensureRole({ auth: makeAuth({ role: "participant" }), href: "/app/users" }, [
        "admin",
        "instructor",
      ]),
    );

    expect(redirect).not.toBeNull();
    expect(redirect!.options.to).toBe("/app/dashboard");
  });

  it("redirects to /login first when not even authenticated", () => {
    const redirect = catchRedirect(() =>
      ensureRole({ auth: makeAuth({ isAuthenticated: false }), href: "/app/users" }, ["admin"]),
    );

    expect(redirect).not.toBeNull();
    expect(redirect!.options.to).toBe("/login");
  });

  it("does not enforce roles while auth is still loading", () => {
    expect(() =>
      ensureRole(
        { auth: makeAuth({ role: "participant", isLoading: true }), href: "/app/users" },
        ["admin"],
      ),
    ).not.toThrow();
  });
});
