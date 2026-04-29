import React from "react";
import { useLocation } from "react-router-dom";
import bullLogoUrl from "../assets/lightnin-bull-logo.svg";

const LandingBullLogo: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/" || location.pathname === "/auth";

  if (!isLandingPage) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <img
          src={bullLogoUrl}
          alt=""
          style={{
            position: "absolute",
            right: "min(7vw, 88px)",
            top: "112px",
            width: "min(46vw, 560px)",
            maxWidth: "720px",
            opacity: 0.13,
            filter: "drop-shadow(0 0 42px rgba(226,184,75,0.55))",
            transform: "rotate(-2deg)",
          }}
        />
      </div>

      <div
        style={{
          position: "fixed",
          top: 22,
          left: 22,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px 8px 10px",
          borderRadius: 999,
          border: "1px solid rgba(226,184,75,0.36)",
          background: "rgba(3,7,18,0.62)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.34), 0 0 22px rgba(226,184,75,0.12)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: 56,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={bullLogoUrl}
            alt="Lightnin Bull logo"
            style={{
              width: 58,
              height: 38,
              objectFit: "contain",
              filter: "drop-shadow(0 0 12px rgba(250,204,21,0.78))",
            }}
          />
        </span>

        <span
          style={{
            fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: "#f7d56b",
            textShadow: "0 0 14px rgba(226,184,75,0.55)",
            whiteSpace: "nowrap",
          }}
        >
          Lightnin Bull
        </span>
      </div>
    </>
  );
};

export default LandingBullLogo;
