import { Link, NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/AuthProvider";
import { auth } from "../lib/firebase";

type NavItem = {
  label: string;
  to?: string;
  disabled?: boolean;
};

const adminItems: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "Content Library", to: "/trainings" },
  { label: "Assessments", to: "/assessments" },
  { label: "Analytics", to: "/analytics" },
];

const instructorItems: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "Content", to: "/trainings" },
  { label: "Question Bank", to: "/questions" },
  { label: "Assessments", to: "/assessments" },
  { label: "Analytics", to: "/analytics" },
  { label: "AI Assistant", disabled: true },
];

const participantItems: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "My Assessments", to: "/my-assessments" },
  { label: "My Results", disabled: true },
];

const contentLinks: NavItem[] = [
  { label: "Trainings", to: "/trainings" },
  { label: "Topics", to: "/topics" },
  {
    label: "Learning Objectives",
    to: "/learning-objectives",
  },
  { label: "Equivalent Groups", to: "/equivalent-groups" },
];

function getNavItems(role?: string) {
  if (role === "ADMIN") {
    return adminItems;
  }

  if (role === "INSTRUCTOR") {
    return instructorItems;
  }

  if (role === "PARTICIPANT") {
    return participantItems;
  }

  return [{ label: "Dashboard", to: "/" }];
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-slate-900 text-white"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
  ].join(" ");
}

function Navbar() {
  const navigate = useNavigate();
  const { firebaseUser, appUser, isLoading } = useAuth();
  const navItems = getNavItems(appUser?.role);
  const showContentShortcuts =
    appUser?.role === "ADMIN" || appUser?.role === "INSTRUCTOR";

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/"
            className="mr-2 text-lg font-bold tracking-tight text-slate-950"
          >
            PROJEKT3
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) =>
              item.disabled || !item.to ? (
                <span
                  key={item.label}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-400"
                  title="Coming soon"
                >
                  {item.label}
                  <span className="ml-1 text-xs font-normal">
                    Soon
                  </span>
                </span>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={navLinkClass}
                  end={item.to === "/"}
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {appUser?.role || "Guest"}
            </span>

            {!firebaseUser && !isLoading && (
              <Link
                to="/login"
                className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Login
              </Link>
            )}

            {firebaseUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {showContentShortcuts && (
          <nav
            aria-label="Content shortcuts"
            className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
          >
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Content
            </span>

            {contentLinks.map((item) => (
              <NavLink
                key={item.label}
                to={item.to || "/"}
                className={({ isActive }) =>
                  [
                    "rounded-md px-2.5 py-1.5 text-sm transition",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export default Navbar;
