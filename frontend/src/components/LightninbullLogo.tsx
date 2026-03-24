import "./LightninbullLogo.css";

type LightninbullLogoProps = {
  showSubText?: boolean;
};

export default function LightninbullLogo({
  showSubText = true,
}: LightninbullLogoProps) {
  return (
    <div className="logo-wrap">
      {/* optional bull image */}
      <img
        src="/lightninbull-bull.png"
        alt="Lightninbull Bull"
        className="logo-bull"
      />

      <div className="logo-text">Lightninbull</div>

      {showSubText && (
        <div className="sub-text">Financial Analytics</div>
      )}
    </div>
  );
}
