import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import Auth from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const MarketingHome = lazy(() => import("./pages/MarketingHome"));
const FactorPage = lazy(() => import("./pages/FactorPage"));

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "grid",
              placeItems: "center",
              color: "#e2b84b",
              background: "#07111f",
              fontSize: "1.05rem",
            }}
          >
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<MarketingHome />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/factors/:slug" element={<FactorPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
