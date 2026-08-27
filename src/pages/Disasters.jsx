import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ScenarioGrid from '../components/landing/ScenarioGrid'
import ThemeToggle from '../components/ThemeToggle'
import { ArrowLeft, LayoutPanelTop } from 'lucide-react'

export default function Disasters({ isEmbedded }) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'var(--bg-primary)',
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        paddingBottom: isEmbedded ? '40px' : '100px',
      }}
    >
      {!isEmbedded && (
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 36px',
            background: '#20292B',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#DCE6E8',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#79B9C1'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(121, 185, 193, 0.2)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.color = '#DCE6E8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
          >
            <ArrowLeft size={15} /> RETURN TO MISSION
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LayoutPanelTop size={22} color="#79B9C1" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', letterSpacing: '2px', lineHeight: 1, color: '#FFFFFF' }}>
                AEGIS <span style={{ color: '#79B9C1' }}>REGISTRY</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                color: '#8A9A9E',
                letterSpacing: '1.5px',
                marginTop: '3px',
              }}>
                GLOBAL DISASTER NODE DIRECTORY
              </div>
            </div>
          </div>
        </div>

        <ThemeToggle />
      </nav>
      )}

      <div style={{ marginTop: '20px' }}>
        <ScenarioGrid />
      </div>

      {/* Decorative footer elements */}
      <div style={{ 
        textAlign: 'center', 
        fontFamily: 'var(--font-mono)', 
        fontSize: '9.5px', 
        color: 'var(--text-tertiary)',
        letterSpacing: '1.5px',
        opacity: 0.7
      }}>
        AEGIS SWARMSYNC // STANDBY FOR SCENARIO INITIALIZATION
      </div>
    </motion.div>
  )
}
