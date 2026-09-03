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
    case 'dense_forest':
      return (
        <svg viewBox="0 0 32 32" style={iconStyle} fill="none" stroke={color} strokeWidth="1.5">
          <path d="M16,28 L16,18" />
          <path d="M16,18 L8,22 L16,8 L24,22 Z" />
          <path d="M16,14 L10,18 L16,4 L22,18 Z" strokeOpacity="0.55" />
          <line x1="4" y1="28" x2="28" y2="28" strokeOpacity="0.35" />
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
      style={{
        position: 'relative',
        padding: '24px 22px',
        background: hovered && scenario.clickable
          ? '#FFFFFF'
          : 'rgba(235, 243, 245, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${hovered && scenario.clickable ? 'rgba(121, 185, 193, 0.8)' : 'rgba(255, 255, 255, 0.95)'}`,
        outline: '1px solid rgba(0, 0, 0, 0.07)',
        cursor: scenario.clickable ? 'pointer' : 'not-allowed',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered && scenario.clickable ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered && scenario.clickable ? '0 8px 24px rgba(121, 185, 193, 0.25), inset 0 1px 0 #FFFFFF' : '0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF',
        opacity: scenario.clickable ? 1 : 0.6,
        overflow: 'hidden',
        borderRadius: '12px',
      }}
    >
      {/* Accent line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2.5px',
        background: `linear-gradient(90deg, transparent, ${scenario.accent}, transparent)`,
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <ScenarioIcon type={scenario.icon} color={scenario.accent} />

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          background: `${scenario.statusColor}18`,
          border: `1px solid ${scenario.statusColor}40`,
          fontSize: '8.5px',
          fontFamily: 'var(--font-primary)',
          color: scenario.statusColor === '#00ff88' ? '#2e7d5a' : scenario.statusColor,
          letterSpacing: '0.06em',
          fontWeight: 800,
          borderRadius: '12px',
          textTransform: 'uppercase',
        }}>
          <div
            className={scenario.status === 'SIMULATION READY' ? 'pulse-dot' : ''}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: scenario.statusColor === '#00ff88' ? '#58ba8a' : scenario.statusColor,
            }}
          />
          {scenario.status}
        </div>
      </div>

      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '18px',
        fontWeight: 800,
        color: '#172124',
        letterSpacing: '0.06em',
        marginBottom: '4px',
      }}>
        {scenario.title}
      </h3>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: '#1a565e',
        letterSpacing: '0.04em',
        marginBottom: '12px',
        fontWeight: 700,
      }}>
        {scenario.location}
      </div>

      <p style={{
        fontFamily: 'var(--font-primary)',
        fontSize: '13px',
        color: '#55666B',
        lineHeight: 1.6,
        fontWeight: 500,
      }}>
        {scenario.details}
      </p>
    </motion.div>
  )
}
