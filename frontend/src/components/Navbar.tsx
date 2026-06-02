import { Link } from "react-router-dom";
import { currentUser } from "../auth/mockUser";

function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-5 flex gap-8">

        <Link to="/">Home</Link>

        {(currentUser.role === "ADMIN" ||
          currentUser.role === "INSTRUCTOR") && (
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
          </>
        )}

        {currentUser.role === "PARTICIPANT" && (
          <>
            <Link to="/assessments">
              My Assessments
            </Link>
          </>
        )}

        <span className="ml-auto text-gray-500">
          Role: {currentUser.role}
        </span>
      </div>
    </nav>
  );
}

export default Navbar;