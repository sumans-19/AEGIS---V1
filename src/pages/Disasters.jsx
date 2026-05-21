import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ScenarioGrid from '../components/landing/ScenarioGrid'
import ThemeToggle from '../components/ThemeToggle'
import { ArrowLeft, LayoutPanelTop } from 'lucide-react'

export default function Disasters() {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingBottom: '100px' }}
    >
      {/* Dedicated Header for the Selection Page */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px',
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: '0.2s',
              fontFamily: 'JetBrains Mono',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.background = 'rgba(0,229,255,0.05)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none' }}
          >
            <ArrowLeft size={16} /> RETURN TO MISSION
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <LayoutPanelTop size={24} color="var(--cyan)" />
            <div>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '20px', letterSpacing: '2px', lineHeight: 1 }}>
                AEGIS <span style={{ color: 'var(--cyan)' }}>REGISTRY</span>
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                color: 'var(--text-dim)',
                letterSpacing: '2px',
                marginTop: '2px',
              }}>
                GLOBAL DISASTER NODE DIRECTORY
              </div>
            </div>
          </div>
        </div>

        <ThemeToggle />
      </nav>

      <div style={{ marginTop: '40px' }}>
        <ScenarioGrid />
      </div>

      {/* Decorative footer elements */}
      <div style={{ 
        textAlign: 'center', 
        fontFamily: 'JetBrains Mono', 
        fontSize: '10px', 
        color: 'var(--text-dim)',
        letterSpacing: '2px',
        opacity: 0.5
      }}>
        AEGIS-V1 // STANDBY FOR SCENARIO INITIALIZATION
      </div>
    </motion.div>
  )
}
