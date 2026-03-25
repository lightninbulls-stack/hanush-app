import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import Auth from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "1rem",
        padding: "1rem",
      }}
    >
      {token ? (
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #FFD700",
            color: "#FFD700",
            padding: "6px 16px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Logout
        </button>
      ) : (
        <a href="/auth" style={{ color: "#FFD700" }}>
          Login / Register
        </a>
      )}
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Navbar />
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFD700",
              background: "#000",
              fontSize: "1.1rem",
            }}
          >
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
