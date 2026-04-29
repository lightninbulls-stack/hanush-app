import React, { useEffect } from "react";
import FloatingAIAgentV2 from "./FloatingAIAgentV2";

const FULL_AGENT_NAME = "⚡ Lightnin Bull AI Agent";

const LightninBullAIAgent: React.FC = () => {
  useEffect(() => {
    const applyBranding = () => {
      const buttons = Array.from(document.querySelectorAll("button"));

      buttons.forEach((button) => {
        const label = button.textContent?.trim();

        if (label === "⚡ AI Agent") {
          button.textContent = FULL_AGENT_NAME;
          button.setAttribute("aria-label", "Open Lightnin Bull AI Agent");
        }
      });
    };

    applyBranding();

    const intervalId = window.setInterval(applyBranding, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return <FloatingAIAgentV2 />;
};

export default LightninBullAIAgent;
