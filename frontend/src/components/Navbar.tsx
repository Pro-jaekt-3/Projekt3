import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-5 flex gap-8">
        <Link to="/">Home</Link>
        <Link to="/questions">Questions</Link>
        <Link to="/topics">Topics</Link>
        <Link to="/learning-objectives">
          Learning Objectives
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;