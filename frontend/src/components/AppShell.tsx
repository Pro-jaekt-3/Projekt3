import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/AuthProvider";
import { auth } from "../lib/firebase";

type NavItem = {
  label: string;
  to: string;
  symbol: string;
  disabled?: boolean;
};

const navByRole: Record<string, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", to: "/", symbol: "D" },
    { label: "Users & Roles", to: "/admin/users", symbol: "U" },
    { label: "All Trainings", to: "/admin/trainings", symbol: "T" },
    { label: "All Assessments", to: "/admin/assessments", symbol: "A" },
    { label: "AI Models", to: "/admin/ai-models", symbol: "AI" },
    { label: "System Analytics", to: "/admin/system-analytics", symbol: "R" },
  ],
  INSTRUCTOR: [
    { label: "Dashboard", to: "/", symbol: "D" },
    { label: "My Trainings", to: "/trainings", symbol: "T" },
    { label: "Question Bank", to: "/questions", symbol: "Q" },
    { label: "Assessments", to: "/assessments", symbol: "A" },
    { label: "Results", to: "/analytics", symbol: "R" },
  ],
  PARTICIPANT: [
    { label: "Dashboard", to: "/", symbol: "D" },
    { label: "My Assessments", to: "/my-assessments", symbol: "M" },
    { label: "My Results", to: "/my-results", symbol: "R", disabled: true },
  ],
};

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/login": "Login",
  "/trainings": "My Trainings",
  "/questions": "Question Bank",
  "/assessments": "Assessments",
  "/my-assessments": "My Assessments",
  "/analytics": "Analytics",
  "/topics": "Topics",
  "/learning-objectives": "Learning Objectives",
  "/equivalent-groups": "Equivalent Groups",
  "/admin/users": "Users & Roles",
  "/admin/trainings": "All Trainings",
  "/admin/assessments": "All Assessments",
  "/admin/ai-models": "AI Models",
  "/admin/system-analytics": "System Analytics",
};

function getPageTitle(pathname: string) {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  if (pathname.startsWith("/trainings/")) {
    return "Training Workspace";
  }

  if (pathname.startsWith("/assessments/")) {
    return "Assessment Results";
  }

  if (pathname.startsWith("/solve-assessment/")) {
    return "Solve Assessment";
  }

  if (pathname.startsWith("/my-results/")) {
    return "My Result";
  }

  return "PROJEKT3";
}

function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, appUser, isLoading } = useAuth();

  const navItems = appUser?.role
    ? navByRole[appUser.role] || [{ label: "Dashboard", to: "/", symbol: "D" }]
    : [{ label: "Dashboard", to: "/", symbol: "D" }];

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-[var(--app-border)] bg-white/95 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-[var(--app-border)] px-5 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-primary)] text-sm font-bold text-white">
              P3
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-950">
                PROJEKT3
              </span>
              <span className="block text-xs font-medium text-slate-500">
                Assessment workspace
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => item.disabled ? (
            <span
              key={item.to}
              title="Top-level result history is coming soon. Individual results open after submission."
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-bold">
                {item.symbol}
              </span>
              {item.label}
            </span>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[var(--app-primary-soft)] text-[var(--app-primary-dark)]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`
              }
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-bold">
                {item.symbol}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--app-border)] p-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Published assessments are visible to demo participants. Specific assignment is future work.
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {appUser?.role || "Guest"}
              </p>
              <h1 className="text-xl font-bold text-slate-950">
                {getPageTitle(location.pathname)}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap gap-2 lg:hidden">
                {navItems.map((item) => item.disabled ? (
                  <span
                    key={item.to}
                    title="Top-level result history is coming soon."
                    className="cursor-not-allowed rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-400"
                  >
                    {item.label}
                  </span>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-semibold ${
                        isActive
                          ? "bg-[var(--app-primary-soft)] text-[var(--app-primary-dark)]"
                          : "bg-white text-slate-600"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {!firebaseUser && !isLoading && (
                <Link to="/login" className="app-button-secondary">
                  Login
                </Link>
              )}

              {firebaseUser && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="app-button-secondary"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
