// src/components/Navbar.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <nav style={{ display: "flex", gap: "1rem", padding: "1rem" }}>
      <Link to="/">Home</Link>
      <Link to="/stocks">Stocks</Link>

      {token ? (
        <button onClick={handleLogout}>Logout</button>
      ) : (
        <Link to="/auth">Login / Register</Link>
      )}
    </nav>
  );
};

export default Navbar;
