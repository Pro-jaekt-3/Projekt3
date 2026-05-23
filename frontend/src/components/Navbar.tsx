import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "20px",
        padding: "20px",
        borderBottom: "1px solid gray",
      }}
    >
      <Link to="/">Home</Link>

      <Link to="/questions">Questions</Link>

      <Link to="/topics">Topics</Link>
    </nav>
  );
}

export default Navbar;