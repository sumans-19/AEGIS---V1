import React, { useState } from 'react';

export default function ToggleSwitch({ checked, onChange, label }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <div
      onClick={onChange}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '5px 4px',
        userSelect: 'none',
        borderRadius: 6,
        transition: 'background 0.18s ease',
        background: isHovered ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
      }}
    >
      <span style={{
        fontSize: '7.5px',
        fontFamily: 'var(--font-primary)',
        fontWeight: 700,
        color: isHovered ? '#1F282B' : '#4B5C62',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        transition: 'color 0.18s ease',
      }}>
        {label}
      </span>
      <div
        style={{
          width: 32,
          height: 16,
          borderRadius: 10,
          background: checked ? '#79B9C1' : '#B2C2C6',
          position: 'relative',
          transition: 'all 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0,
          boxShadow: checked
            ? '0 0 8px rgba(121, 185, 193, 0.4), inset 0 1px 1px rgba(0, 0, 0, 0.1)'
            : 'inset 0 1px 2px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div style={{
          width: isPressed ? 14 : 12,
          height: 12,
          borderRadius: '50%',
          background: '#FFFFFF',
          position: 'absolute',
          top: 2,
          left: checked ? (isPressed ? 16 : 18) : 2,
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }} />
      </div>
    </div>
  );
}

