import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/AuthProvider";
import { auth } from "../lib/firebase";

function Navbar() {
  const navigate = useNavigate();
  const { firebaseUser, appUser, isLoading } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const navItems =
    appUser?.role === "ADMIN"
      ? [
          { label: "Dashboard", to: "/" },
          { label: "Content", to: "/trainings" },
          { label: "Assessments", to: "/assessments" },
          { label: "Analytics", to: "/analytics" },
        ]
      : appUser?.role === "INSTRUCTOR"
        ? [
            { label: "Dashboard", to: "/" },
            { label: "My Trainings", to: "/trainings" },
            { label: "Question Bank", to: "/questions" },
            { label: "Assessments", to: "/assessments" },
            { label: "Results", to: "/analytics" },
          ]
        : appUser?.role === "PARTICIPANT"
          ? [
              { label: "Dashboard", to: "/" },
              { label: "My Assessments", to: "/my-assessments" },
            ]
          : [{ label: "Dashboard", to: "/" }];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center gap-5">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="text-sm font-medium text-slate-700 transition hover:text-slate-950"
          >
            {item.label}
          </Link>
        ))}

        {appUser?.role === "PARTICIPANT" && (
          <span className="cursor-not-allowed text-sm font-medium text-slate-400">
            My Results - Coming soon
          </span>
        )}

        <div className="ml-auto flex items-center gap-4 text-gray-500">
          {!firebaseUser && !isLoading && (
            <Link
              to="/login"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Login
            </Link>
          )}

          <span>
            Role: {appUser?.role || "Guest"}
          </span>

          {firebaseUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
