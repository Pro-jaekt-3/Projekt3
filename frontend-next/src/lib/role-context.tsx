import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "instructor" | "participant";

export interface DemoUser {
  name: string;
  email: string;
  role: Role;
}

const DEMO_USERS: Record<Role, DemoUser> = {
  admin: { name: "Ana Kovač", email: "ana.admin@projekt3.app", role: "admin" },
  instructor: { name: "Marko Novak", email: "marko.instructor@projekt3.app", role: "instructor" },
  participant: { name: "Eva Horvat", email: "eva.student@projekt3.app", role: "participant" },
};

interface RoleContextValue {
  role: Role;
  user: DemoUser;
  setRole: (role: Role) => void;
  isAuthenticated: boolean;
  logout: () => void;
  login: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = "projekt3.role";
const AUTH_KEY = "projekt3.auth";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("instructor");
  const [isAuthenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_KEY) as Role | null;
      const a = localStorage.getItem(AUTH_KEY);
      if (r) setRoleState(r);
      if (a === "1") setAuthenticated(true);
    } catch {}
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    try { localStorage.setItem(STORAGE_KEY, r); } catch {}
  };

  const login = (r: Role) => {
    setRole(r);
    setAuthenticated(true);
    try { localStorage.setItem(AUTH_KEY, "1"); } catch {}
  };

  const logout = () => {
    setAuthenticated(false);
    try { localStorage.removeItem(AUTH_KEY); } catch {}
  };

  return (
    <RoleContext.Provider
      value={{ role, user: DEMO_USERS[role], setRole, isAuthenticated, login, logout }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
