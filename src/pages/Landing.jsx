import { motion } from 'framer-motion'
import Hero from '../components/landing/Hero'
import About from '../components/landing/About'
import ScenarioGrid from '../components/landing/ScenarioGrid'
import Footer from '../components/landing/Footer'
import ThemeToggle from '../components/ThemeToggle'

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ background: 'var(--bg-primary)', minHeight: '100vh', transition: 'background 0.5s ease' }}
    >
      {/* Top Navigation */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px',
          background: 'var(--bg-panel)',
          opacity: 0.95,
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
          transition: 'all 0.3s ease',
        }}
      >
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '26px', letterSpacing: '3px' }}>
            <span style={{ color: 'var(--cyan)' }}>AE</span>
            <span style={{ color: 'var(--text-primary)' }}>GIS</span>
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            color: 'var(--text-dim)',
            letterSpacing: '3px',
            marginTop: '-2px',
          }}>
            AERIAL EMERGENCY GRID & INTELLIGENCE SYSTEM
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {['System', 'Scenarios', 'About'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '1px',
              transition: 'color 0.2s',
            }}
            onMouseOver={e => e.target.style.color = 'var(--cyan)'}
            onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}
            >
              {link}
            </a>
          ))}
          <a href="/mission" style={{
            color: 'var(--cyan)',
            textDecoration: 'none',
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '2px',
            padding: '10px 24px',
            border: '2px solid var(--cyan)',
            borderRadius: '40px',
            transition: 'all 0.3s',
            textTransform: 'uppercase'
          }}
          onMouseOver={e => {
            e.target.style.background = 'var(--cyan)'
            e.target.style.color = 'var(--bg-primary)'
            e.target.style.boxShadow = 'var(--cyan-glow-strong)'
          }}
          onMouseOut={e => {
            e.target.style.background = 'transparent'
            e.target.style.color = 'var(--cyan)'
            e.target.style.boxShadow = 'none'
          }}
          >
            Launch Mission
          </a>
          <ThemeToggle />
        </div>
      </nav>

      <Hero />
      <About />
      <ScenarioGrid />
      <Footer />
    </motion.div>
  )
}
