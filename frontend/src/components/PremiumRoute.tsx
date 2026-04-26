import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchSubscriptionStatus } from "../services/subscriptionApi";

const PremiumRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const status = await fetchSubscriptionStatus();
        setIsActive(status.is_active);
      } catch {
        setIsActive(false);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "#e2b84b",
          fontSize: "1rem",
        }}
      >
        Checking subscription...
      </div>
    );
  }

  if (!isActive) {
    return <Navigate to="/pricing" replace />;
  }

  return children;
};

export default PremiumRoute;
