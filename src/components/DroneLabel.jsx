import React from "react";
import { Html } from "@react-three/drei";

export default function DroneLabel({ drone }) {
  const rawAction = drone.action || drone.last_decision;
  const actionStr = typeof rawAction === "string" ? rawAction : rawAction?.action || "NOMINAL";
  const cleanAction = actionStr.replace(/_/g, " ");
  const reason = typeof rawAction === "object" ? rawAction.reason : "";
  const isEmergency = reason && reason !== "All systems nominal";

  return (
    <Html
      position={[0, 4.5, 0]}
      center
      distanceFactor={45}
      occlude={false}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        style={{
          background: "rgba(18, 26, 28, 0.94)",
          padding: "3px 8px",
          borderRadius: "6px",
          border: `1px solid ${isEmergency ? '#dc3545' : '#79B9C1'}`,
          boxShadow: isEmergency
            ? "0 2px 8px rgba(220, 53, 69, 0.4)"
            : "0 2px 8px rgba(0, 0, 0, 0.4)",
          color: "#FFFFFF",
          fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
          fontSize: "9px",
          lineHeight: 1.2,
          textAlign: "center",
          whiteSpace: "nowrap",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1px",
        }}
      >
        {/* DRONE CALLSIGN */}
        <div style={{
          color: "#79B9C1",
          fontWeight: 800,
          fontSize: "9.5px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {drone.callsign || `DRONE-${drone.id}`}
        </div>

        {/* STATUS / ACTION */}
        <div style={{
          fontSize: "7.5px",
          fontWeight: 600,
          color: isEmergency ? "#ff8080" : "#DCE6E8",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}>
          {isEmergency ? reason : cleanAction}
        </div>
      </div>
    </Html>
  );
}
