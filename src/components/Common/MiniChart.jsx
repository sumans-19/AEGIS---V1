import React from 'react';

export default function MiniChart({ data, color = '#6FAEB6', width = 110, height = 36 }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;

  const points = data.map((val, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaStr = `${pad},${height - pad} ${polylineStr} ${width - pad},${height - pad}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      
      {/* Gradient Fill under the line */}
      <polygon points={areaStr} fill={`url(#grad-${color.replace(/[^a-zA-Z0-9]/g, '')})`} />
      
      {/* Smooth curve line */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertex Dots matching reference image */}
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r="1.8"
          fill={idx === points.length - 1 ? '#FFFFFF' : color}
          stroke={color}
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}
