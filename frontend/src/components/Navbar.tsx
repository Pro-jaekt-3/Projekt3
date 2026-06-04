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

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-center gap-8">

        <Link to="/">Home</Link>

        {appUser &&
          (appUser.role === "ADMIN" ||
            appUser.role === "INSTRUCTOR") && (
          <>
            <Link to="/questions">
              Questions
            </Link>

            <Link to="/topics">
              Topics
            </Link>

            <Link to="/learning-objectives">
              Learning Objectives
            </Link>

            <Link to="/trainings">
              Trainings
            </Link>

            <Link to="/equivalent-groups">
              Equivalent Groups
            </Link>

            <Link to="/assessments">
              Assessments
            </Link>

            <Link to="/analytics">
              Analytics
            </Link>

            <Link to="/ai-assistant">
              AI Assistant
            </Link>
          </>
        )}

        {appUser?.role === "PARTICIPANT" && (
          <>
            <Link to="/my-assessments">
              My Assessments
            </Link>

            {firebaseUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            )}
          </>
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
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
