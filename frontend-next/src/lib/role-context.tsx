import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "./firebase";
import { apiJsonFetch } from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Public API surface — UNCHANGED from the original mock role-context so that
// the existing useRole() call sites (TopBar, SidebarNav, dashboard, login, …)
// keep working without edits. Internals are now backed by real Firebase auth.
// `isLoading` is added (non-breaking) so route guards can wait for auth.
// ---------------------------------------------------------------------------

export type Role = "admin" | "instructor" | "participant";

export interface DemoUser {
  name: string;
  email: string;
  role: Role;
}

export interface AuthState {
  role: Role;
  // null until a real user is resolved: during initial load, or permanently if
  // /auth/me failed (see authError). Never a placeholder/demo identity.
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // True when a signed-in Firebase user's backend profile (/auth/me) failed to
  // load. UI can show an error state instead of silently showing nothing.
  authError: boolean;
  setRole: (role: Role) => void;
  login: (role: Role) => void;
  logout: () => void;
}

// ---------------------------------------------------------------------------
// Backend contract (GET /auth/me) — see backend/controllers/authController.js
// ---------------------------------------------------------------------------

type BackendRole = "ADMIN" | "INSTRUCTOR" | "PARTICIPANT";

interface AuthMeResponse {
  id: number;
  email: string;
  role: BackendRole;
  firebaseUid: string;
}

const ROLE_FROM_BACKEND: Record<BackendRole, Role> = {
  ADMIN: "admin",
  INSTRUCTOR: "instructor",
  PARTICIPANT: "participant",
};

// ---------------------------------------------------------------------------
// DEV-ONLY role override. import.meta.env.DEV is statically false in a
// production build, so this whole feature is dead-code-eliminated by Vite and
// is impossible to enable in production regardless of the env var.
// ---------------------------------------------------------------------------

const RAW_DEV_OVERRIDE = import.meta.env.VITE_DEV_ROLE_OVERRIDE as string | undefined;

export const isDevRoleOverrideEnabled = import.meta.env.DEV && Boolean(RAW_DEV_OVERRIDE);

const STORAGE_KEY = "projekt3.role";

// Fail closed: the least-privileged role, used only while there is no real
// backend role to report (e.g. /auth/me failed). Never "instructor"/"admin".
const FALLBACK_ROLE: Role = "participant";

// DEV-ONLY preview identities. Used exclusively when isDevRoleOverrideEnabled
// is true (dead-code-eliminated in production) — never as a fallback for a
// real signed-in user. See useAuthController below.
const DEMO_USERS: Record<Role, DemoUser> = {
  admin: { name: "Ana Kovač", email: "ana.admin@projekt3.app", role: "admin" },
  instructor: { name: "Marko Novak", email: "marko.instructor@projekt3.app", role: "instructor" },
  participant: { name: "Eva Horvat", email: "eva.student@projekt3.app", role: "participant" },
};

function parseRole(value: string | null | undefined): Role | null {
  if (value === "admin" || value === "instructor" || value === "participant") {
    return value;
  }
  return null;
}

// Turn "jurij.dumic@x.com" into "Jurij Dumic" for display.
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return email;
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export const RoleContext = createContext<AuthState | null>(null);

/**
 * Single source of auth truth. Created once ABOVE the router (see main.tsx) so
 * the value can be fed both into the TanStack Router context (for beforeLoad
 * guards) and into RoleContext (for useRole() inside the tree).
 */
export function useAuthController(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AuthMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  // Dev-only previewed role; takes precedence when enabled. Never used in prod.
  const [devRole, setDevRole] = useState<Role | null>(() => {
    if (!isDevRoleOverrideEnabled) return null;
    try {
      return parseRole(localStorage.getItem(STORAGE_KEY)) ?? parseRole(RAW_DEV_OVERRIDE);
    } catch {
      return parseRole(RAW_DEV_OVERRIDE);
    }
  });

  // Real Firebase auth state → fetch backend /auth/me for the authoritative role.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(false);

      if (!user) {
        setAppUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const me = await apiJsonFetch<AuthMeResponse>("/auth/me");
        setAppUser(me ?? null);
        if (!me) setAuthError(true);
      } catch (error) {
        console.error("Failed to load authenticated user from /auth/me:", error);
        setAppUser(null);
        setAuthError(true);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const setRole = useCallback((next: Role) => {
    // Dev-only override; a no-op in production builds.
    if (!isDevRoleOverrideEnabled) return;
    setDevRole(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  }, []);

  // login(role) keeps the original signature. Real Firebase sign-in is performed
  // by the login page directly; here login() is the DEV override entry point
  // ("Continue as …"), effective only when the override is enabled.
  const login = useCallback(
    (next: Role) => {
      setRole(next);
    },
    [setRole],
  );

  const logout = useCallback(() => {
    setDevRole(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Fire-and-forget; onAuthStateChanged clears appUser.
    void signOut(auth).catch((error) => console.error("Sign-out failed:", error));
  }, []);

  return useMemo<AuthState>(() => {
    const overrideActive = isDevRoleOverrideEnabled && devRole != null;
    const backendRole = appUser ? ROLE_FROM_BACKEND[appUser.role] : null;

    const role: Role = overrideActive ? devRole! : (backendRole ?? FALLBACK_ROLE);

    // DEMO_USERS is a dev-only preview identity — never a stand-in for a real
    // signed-in user. If appUser hasn't loaded yet (or failed to), user is
    // null; callers must handle loading/error explicitly instead of rendering
    // a placeholder name.
    const user: DemoUser | null = overrideActive
      ? DEMO_USERS[devRole!]
      : appUser
        ? { name: displayNameFromEmail(appUser.email), email: appUser.email, role }
        : null;

    // Authenticated only once BOTH the Firebase session and the backend
    // profile are present (or the dev override is active) — a Firebase
    // session with no resolved backend profile is not a signed-in state.
    const isAuthenticated = overrideActive || Boolean(firebaseUser && appUser);

    return { role, user, isAuthenticated, isLoading, authError, setRole, login, logout };
  }, [appUser, firebaseUser, devRole, isLoading, authError, setRole, login, logout]);
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleContext provider");
  return ctx;
}
