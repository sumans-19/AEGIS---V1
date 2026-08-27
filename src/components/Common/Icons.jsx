import React from 'react';

/* Consistent SVG Icon helper with technical aerospace stroke */
const defaults = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Icon = ({ children, size = 20, className = '', style = {}, viewBox = '0 0 24 24', ...props }) => (
  <svg
    {...defaults}
    viewBox={viewBox}
    width={size}
    height={size}
    className={className}
    style={style}
    {...props}
  >
    {children}
  </svg>
);

/* ---- Aeroview Wing / Falcon Drone Logo ---- */
export const AeroviewLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left outer wing */}
    <path d="M4 6L16 16L12 26L4 6Z" fill="#79B9C1" fillOpacity="0.85" />
    {/* Right outer wing */}
    <path d="M36 6L24 16L28 26L36 6Z" fill="#79B9C1" fillOpacity="0.85" />
    {/* Left inner wing */}
    <path d="M14 8L19 16L16 23L14 8Z" fill="#D7E6E8" fillOpacity="0.95" />
    {/* Right inner wing */}
    <path d="M26 8L21 16L24 23L26 8Z" fill="#D7E6E8" fillOpacity="0.95" />
    {/* Center diamond fuselage */}
    <path d="M20 10L22.5 16L20 22L17.5 16L20 10Z" fill="#FFFFFF" />
  </svg>
);

/* ---- Left Navigation Rail Icons ---- */
export const Icon3DView = (props) => (
  <Icon {...props}>
    <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
    <path d="M12 12L20 7.5" />
    <path d="M12 12V21" />
    <path d="M12 12L4 7.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconSensors = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 4.5A7.5 7.5 0 0 0 4.5 12" />
    <path d="M12 4.5A7.5 7.5 0 0 1 19.5 12" />
    <path d="M4.5 12A7.5 7.5 0 0 0 12 19.5" />
    <path d="M19.5 12A7.5 7.5 0 0 1 12 19.5" />
    <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="19.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconMission = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </Icon>
);

export const IconAI = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83" />
    <path d="M18.36 5.64l-2.83 2.83M8.47 15.53l-2.83 2.83" />
    <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="21" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="21" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconMap = (props) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconMultiDrone = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="6" r="2.5" />
    <circle cx="6" cy="17" r="2.5" />
    <circle cx="18" cy="17" r="2.5" />
    <path d="M10.5 8.2L7.5 14.8M13.5 8.2L16.5 14.8M8.5 17h7" strokeDasharray="1.5 1.5" />
  </Icon>
);

export const IconSettings = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Icon>
);

/* ---- View Controls (Crosshair, Zoom, Pan, Reset) ---- */
export const IconRotate = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </Icon>
);

export const IconZoom = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16" y1="16" x2="21" y2="21" strokeWidth="2" />
    <line x1="8" y1="11" x2="14" y2="11" />
    <line x1="11" y1="8" x2="11" y2="14" />
  </Icon>
);

export const IconPan = (props) => (
  <Icon {...props}>
    <path d="M18 11V6.5a1.5 1.5 0 00-3 0V11" />
    <path d="M15 9.5V5.5a1.5 1.5 0 00-3 0v6" />
    <path d="M12 11.5V4a1.5 1.5 0 00-3 0v9" />
    <path d="M9 13V8.5a1.5 1.5 0 00-3 0V15a6 6 0 0012 0v-2.5a1.5 1.5 0 00-3 0" />
  </Icon>
);

export const IconReset = (props) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

/* ---- ViewPoint Thumbnail Silhouettes ---- */
export const IconViewPreset1 = (props) => (
  /* Perspective / Isometric starburst */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <circle cx="16" cy="16" r="3.5" fill="currentColor" fillOpacity="0.2" />
    <line x1="16" y1="4" x2="16" y2="28" strokeDasharray="2 2" />
    <line x1="4" y1="16" x2="28" y2="16" strokeDasharray="2 2" />
    <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" />
    <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" />
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="24.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="7.5" cy="24.5" r="1.5" fill="currentColor" />
    <circle cx="24.5" cy="24.5" r="1.5" fill="currentColor" />
  </Icon>
);

export const IconViewPreset2 = (props) => (
  /* Front View Silhouette */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <rect x="11" y="14" width="10" height="6" rx="2" fill="currentColor" fillOpacity="0.15" />
    <line x1="4" y1="14" x2="11" y2="16" strokeWidth="1.5" />
    <line x1="28" y1="14" x2="21" y2="16" strokeWidth="1.5" />
    <circle cx="4" cy="14" r="2" />
    <circle cx="28" cy="14" r="2" />
    <line x1="1" y1="11" x2="7" y2="11" />
    <line x1="25" y1="11" x2="31" y2="11" />
    <path d="M13 20v4M19 20v4" />
    <line x1="10" y1="24" x2="22" y2="24" />
    <circle cx="16" cy="17" r="1.5" fill="currentColor" />
  </Icon>
);

export const IconViewPreset3 = (props) => (
  /* Rear View Silhouette */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <rect x="11" y="13" width="10" height="7" rx="2" fill="currentColor" fillOpacity="0.15" />
    <line x1="5" y1="13" x2="11" y2="15" strokeWidth="1.5" />
    <line x1="27" y1="13" x2="21" y2="15" strokeWidth="1.5" />
    <circle cx="5" cy="13" r="2" />
    <circle cx="27" cy="13" r="2" />
    <line x1="2" y1="10" x2="8" y2="10" />
    <line x1="24" y1="10" x2="30" y2="10" />
    <path d="M12 20v4M20 20v4" />
    <circle cx="16" cy="16" r="1" fill="#c85a5a" stroke="#c85a5a" />
  </Icon>
);

export const IconViewPreset4 = (props) => (
  /* Isometric Top Angle */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <path d="M16 9L23 13V19L16 23L9 19V13L16 9Z" fill="currentColor" fillOpacity="0.15" />
    <line x1="9" y1="13" x2="4" y2="8" />
    <line x1="23" y1="13" x2="28" y2="8" />
    <line x1="9" y1="19" x2="4" y2="24" />
    <line x1="23" y1="19" x2="28" y2="24" />
    <circle cx="4" cy="8" r="2" />
    <circle cx="28" cy="8" r="2" />
    <circle cx="4" cy="24" r="2" />
    <circle cx="28" cy="24" r="2" />
  </Icon>
);

export const IconViewPreset5 = (props) => (
  /* Side View Silhouette */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <rect x="7" y="14" width="18" height="5" rx="2" fill="currentColor" fillOpacity="0.15" />
    <line x1="8" y1="14" x2="8" y2="10" />
    <line x1="24" y1="14" x2="24" y2="10" />
    <line x1="4" y1="9" x2="12" y2="9" />
    <line x1="20" y1="9" x2="28" y2="9" />
    <path d="M10 19l-3 6M22 19l3 6" />
    <line x1="5" y1="25" x2="27" y2="25" />
  </Icon>
);

export const IconViewPreset6 = (props) => (
  /* 3/4 Perspective Angle */
  <Icon viewBox="0 0 32 32" size={24} {...props}>
    <path d="M16 11l7 3v4l-7 4-7-4v-4l7-3z" fill="currentColor" fillOpacity="0.15" />
    <line x1="9" y1="14" x2="3" y2="11" />
    <line x1="23" y1="14" x2="29" y2="11" />
    <line x1="9" y1="18" x2="5" y2="25" />
    <line x1="23" y1="18" x2="27" y2="25" />
    <circle cx="3" cy="11" r="1.8" />
    <circle cx="29" cy="11" r="1.8" />
    <circle cx="5" cy="25" r="1.8" />
    <circle cx="27" cy="25" r="1.8" />
  </Icon>
);

/* ---- Sensor Icons for Bottom Bar and Right Panel ---- */
export const IconGPS = (props) => (
  /* Satellite dish / navigation */
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M4 12a8 8 0 0 1 8-8" />
    <path d="M20 12a8 8 0 0 1-8 8" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <path d="M6 6l3 3M15 15l3 3" />
  </Icon>
);

export const IconIMU = (props) => (
  /* Gyroscope / 9-axis IMU */
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <ellipse cx="12" cy="12" rx="8" ry="3.5" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.2" />
    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
  </Icon>
);

export const IconThermal = (props) => (
  /* Thermal Camera Sensor housing */
  <Icon {...props}>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <line x1="9" y1="6" x2="9" y2="3" />
    <line x1="15" y1="6" x2="15" y2="3" />
    <line x1="7" y1="3" x2="17" y2="3" />
  </Icon>
);

export const IconLidar = (props) => (
  /* Dome LiDAR turret */
  <Icon {...props}>
    <path d="M6 18h12a2 2 0 0 0 2-2v-4a8 8 0 0 0-16 0v4a2 2 0 0 0 2 2z" />
    <line x1="4" y1="20" x2="20" y2="20" strokeWidth="2" />
    <line x1="12" y1="6" x2="12" y2="12" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M9 12a3 3 0 0 1 6 0" strokeDasharray="1.5 1.5" />
  </Icon>
);

export const IconAltitude = (props) => (
  /* Altitude double vertical arrow */
  <Icon {...props}>
    <line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.8" />
    <path d="M8 8l4-4 4 4" strokeWidth="1.8" />
    <path d="M8 16l4 4 4-4" strokeWidth="1.8" />
    <line x1="5" y1="12" x2="19" y2="12" strokeDasharray="2 2" />
  </Icon>
);

export const IconSmoke = (props) => (
  /* Smoke / Gas Cloud */
  <Icon {...props}>
    <path d="M6 17a4 4 0 0 1-.5-7.97A5 5 0 0 1 15.5 8 4.5 4.5 0 0 1 20 12.5a4 4 0 0 1-3 3.9" />
    <circle cx="8" cy="19" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15" cy="20" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="10" cy="14" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.8" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconBattery = (props) => (
  /* 4-bar Battery icon */
  <Icon {...props}>
    <rect x="3" y="7" width="16" height="10" rx="2" />
    <path d="M21 10v4" strokeWidth="2" />
    <line x1="6" y1="10" x2="6" y2="14" strokeWidth="1.8" />
    <line x1="9" y1="10" x2="9" y2="14" strokeWidth="1.8" />
    <line x1="12" y1="10" x2="12" y2="14" strokeWidth="1.8" />
    <line x1="15" y1="10" x2="15" y2="14" strokeWidth="1.8" opacity="0.3" />
  </Icon>
);

export const IconCamera = (props) => (
  /* FPV Camera Aperture */
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 4l3.5 5.5M19.5 8.5L16 14M18 17.5l-6-1M10 19.5l-2.5-6M4.5 15L9 11M6.5 7.5L12 9" />
  </Icon>
);

/* ---- Header Wireless broadcast icon `((•))` ---- */
export const IconWireless = (props) => (
  <Icon viewBox="0 0 24 24" size={24} {...props}>
    <path d="M5 8.5a9 9 0 0 0 0 7" strokeWidth="1.8" />
    <path d="M8 10.5a5 5 0 0 0 0 3" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <path d="M16 10.5a5 5 0 0 1 0 3" strokeWidth="1.8" />
    <path d="M19 8.5a9 9 0 0 1 0 7" strokeWidth="1.8" />
  </Icon>
);

export const IconClose = (props) => (
  <Icon {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);

export const IconInfo = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="16" x2="12" y2="11" strokeWidth="1.8" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconMonitor = (props) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <line x1="8" y1="20" x2="16" y2="20" />
    <line x1="12" y1="17" x2="12" y2="20" />
    <polygon points="10 8 15 10.5 10 13 10 8" fill="currentColor" stroke="none" />
  </Icon>
);

/* ---- Hardware Render Graphic Box (Thermal Camera Module) ---- */
export const ThermalCameraGraphic = ({ size = 64 }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 96 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="92" height="60" rx="6" fill="#1B2225" stroke="rgba(255,255,255,0.08)" />
    {/* Mounting bracket */}
    <path d="M22 52L26 44H70L74 52" stroke="#4A565A" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="22" cy="52" r="2" fill="#79B9C1" />
    <circle cx="74" cy="52" r="2" fill="#79B9C1" />
    {/* Dual Camera Body */}
    <rect x="24" y="16" width="30" height="26" rx="3" fill="#293337" stroke="#3D4B50" strokeWidth="1.5" />
    <rect x="52" y="20" width="20" height="20" rx="2" fill="#222B2E" stroke="#3D4B50" strokeWidth="1.5" />
    {/* Left large lens (Thermal Ge lens) */}
    <circle cx="39" cy="29" r="9" fill="#14191B" stroke="#79B9C1" strokeWidth="1.5" />
    <circle cx="39" cy="29" r="6" fill="#1E282B" />
    <circle cx="39" cy="29" r="3" fill="#79B9C1" fillOpacity="0.4" />
    {/* Right auxiliary lens */}
    <circle cx="62" cy="30" r="5.5" fill="#14191B" stroke="#4A565A" strokeWidth="1.2" />
    <circle cx="62" cy="30" r="2.5" fill="#0A0E10" />
    {/* LED status indicator */}
    <circle cx="28" cy="20" r="1.5" fill="#79B9C1" />
  </svg>
);
