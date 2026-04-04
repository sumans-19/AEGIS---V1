import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function ScenarioIcon({ type, color }) {
  const iconStyle = { width: 32, height: 32 }

  switch (type) {
    case 'earthquake':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <polyline points="2,22 8,14 12,20 16,8 20,18 24,12 30,22" />
          <line x1="2" y1="26" x2="30" y2="26" strokeOpacity="0.4" />
          <line x1="16" y1="4" x2="16" y2="6" strokeOpacity="0.3" />
        </svg>
      )
    case 'tsunami':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <path d="M2,20 Q8,12 14,20 Q20,28 26,20 Q30,16 30,16" />
          <path d="M2,24 Q8,18 14,24 Q20,30 26,24" strokeOpacity="0.4" />
          <circle cx="26" cy="8" r="2" strokeOpacity="0.3" />
        </svg>
      )
    case 'wildfire':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <path d="M16,2 Q20,10 18,14 Q22,10 24,16 Q26,22 20,28 Q16,30 12,28 Q6,22 8,16 Q10,10 12,14 Q10,10 16,2" />
        </svg>
      )
    case 'flood':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <path d="M16,4 L16,16" />
          <path d="M12,8 L16,4 L20,8" />
          <path d="M16,16 Q16,24 16,24" />
          <ellipse cx="16" cy="26" rx="6" ry="3" strokeOpacity="0.5" />
          <path d="M2,28 Q8,24 14,28 Q20,32 26,28" strokeOpacity="0.4" />
        </svg>
      )
    case 'avalanche':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <polygon points="16,4 28,28 4,28" />
          <line x1="16" y1="4" x2="20" y2="16" strokeOpacity="0.3" />
          <circle cx="12" cy="22" r="1.5" strokeOpacity="0.4" />
          <circle cx="18" cy="24" r="1" strokeOpacity="0.3" />
        </svg>
      )
    case 'cyclone':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="16" cy="16" r="3" />
          <path d="M16,4 Q24,8 20,16 Q16,24 24,28" />
          <path d="M16,28 Q8,24 12,16 Q16,8 8,4" />
        </svg>
      )
    default:
      return null
  }
}

export default function ScenarioCard({ scenario, index }) {
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()

  const handleClick = () => {
    if (!scenario.clickable) return
    navigate(`/mission?scenario=${scenario.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="corner-brackets"
      style={{
        position: 'relative',
        padding: '28px 24px',
        background: hovered && scenario.clickable
          ? `linear-gradient(135deg, ${scenario.accent}15 0%, var(--bg-panel) 100%)`
          : 'var(--bg-panel)',
        border: `1px solid ${hovered && scenario.clickable ? scenario.accent : 'var(--border-color)'}`,
        cursor: scenario.clickable ? 'pointer' : 'not-allowed',
        transition: 'all 0.3s ease',
        transform: hovered && scenario.clickable ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered && scenario.clickable ? `0 0 20px ${scenario.accent}25` : 'none',
        opacity: scenario.clickable ? 1 : 0.6,
        overflow: 'hidden',
        borderRadius: '8px',
      }}
    >
      {/* Accent line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${scenario.accent}, transparent)`,
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <ScenarioIcon type={scenario.icon} color={scenario.accent} />

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: `${scenario.statusColor}20`,
          border: `1px solid ${scenario.statusColor}40`,
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, monospace',
          color: scenario.statusColor,
          letterSpacing: '1px',
          fontWeight: 700,
          borderRadius: '20px',
        }}>
          <div
            className={scenario.status === 'SIMULATION READY' ? 'pulse-dot' : ''}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: scenario.statusColor,
            }}
          />
          {scenario.status}
        </div>
      </div>

      <h3 style={{
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '22px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '2px',
        marginBottom: '6px',
      }}>
        {scenario.title}
      </h3>

      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: scenario.accent,
        letterSpacing: '1px',
        marginBottom: '16px',
        fontWeight: 600,
      }}>
        {scenario.location}
      </div>

      <p style={{
        fontFamily: 'Rajdhani, sans-serif',
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        fontWeight: 500,
      }}>
        {scenario.details}
      </p>
    </motion.div>
  )
}
