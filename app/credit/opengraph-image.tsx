import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "IRION Finance — Private Zero-Knowledge Credit";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#05080f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          border: "8px solid #a6f24a",
          padding: "40px",
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            position: "absolute",
            top: "40px",
            left: "40px",
            right: "40px",
            color: "rgba(255, 255, 255, 0.3)",
            fontSize: "20px",
            letterSpacing: "4px",
          }}
        >
          <span>IRION // ZK_PROOF</span>
          <span>STATUS: SECURE</span>
        </div>

        {/* Brand Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "80px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-3px",
              display: "flex",
              alignItems: "center",
            }}
          >
            PRIVATE <span style={{ color: "#a6f24a", marginLeft: "16px" }}>ZK CREDIT</span>
          </div>

          <div
            style={{
              fontSize: "36px",
              color: "#a6f24a",
              fontWeight: "bold",
              letterSpacing: "1px",
            }}
          >
            Zero-Knowledge Credit Scoring on Stellar
          </div>

          <div
            style={{
              fontSize: "22px",
              color: "rgba(255, 255, 255, 0.4)",
              marginTop: "16px",
              maxWidth: "800px",
              textAlign: "center",
            }}
          >
            Score proven with a secure zero-knowledge proof. Your data never leaves your device.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            position: "absolute",
            bottom: "40px",
            left: "40px",
            right: "40px",
            color: "rgba(255, 255, 255, 0.2)",
            fontSize: "16px",
          }}
        >
          <span>IRION FINANCE</span>
          <span>APP.IRION.FINANCE/CREDIT</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
