import React from 'react';

export default function StatusBadge({ status, size = 'sm' }) {
  const colors = {
    active: 'var(--status-active)',
    idle: 'var(--status-idle)',
    warning: 'var(--status-warning)',
    error: 'var(--status-error)',
  };

  const sizes = { xs: 5, sm: 7, md: 8 };
  const dotSize = sizes[size] || 7;
  const color = colors[status] || colors.idle;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: status === 'active' ? 'pulse-soft 2.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{
        fontSize: 'var(--fs-xs)',
        fontFamily: 'var(--font-primary)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: color,
      }}>
        {status}
      </span>
    </span>
  );
}
