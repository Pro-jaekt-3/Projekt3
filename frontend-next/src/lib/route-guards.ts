import { redirect } from "@tanstack/react-router";

import type { AuthState, Role } from "./role-context";

type GuardArgs = {
  auth: AuthState;
  href: string;
};

/**
 * Redirect to /login if not authenticated, preserving the intended destination.
 * While auth is still resolving (isLoading) we never redirect — render is gated
 * on auth in main.tsx, but this keeps guards safe even if that changes.
 */
export function ensureAuthenticated({ auth, href }: GuardArgs) {
  if (auth.isLoading) return;
  if (!auth.isAuthenticated) {
    throw redirect({ to: "/login", search: { redirect: href } });
  }
}

/**
 * Authenticated AND role is one of `roles`; otherwise send to the dashboard
 * (reachable by every role). In dev, the overridden role drives this check.
 */
export function ensureRole({ auth, href }: GuardArgs, roles: Role[]) {
  ensureAuthenticated({ auth, href });
  if (auth.isLoading) return;
  if (!roles.includes(auth.role)) {
    throw redirect({ to: "/app/dashboard" });
  }
}
