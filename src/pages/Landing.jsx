import { motion } from 'framer-motion'
import Hero from '../components/landing/Hero'
import About from '../components/landing/About'
import ScenarioGrid from '../components/landing/ScenarioGrid'
import EdgeCasesGrid from '../components/landing/EdgeCasesGrid'
import Footer from '../components/landing/Footer'
import ThemeToggle from '../components/ThemeToggle'

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ background: 'var(--bg-primary)', minHeight: '100vh', transition: 'background 0.3s ease' }}
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
          padding: '12px 36px',
          background: '#20292B',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', letterSpacing: '2.5px' }}>
            <span style={{ color: '#79B9C1' }}>AE</span>
            <span style={{ color: '#FFFFFF' }}>GIS</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '7.5px',
            fontWeight: 700,
            color: '#8A9A9E',
            letterSpacing: '2.5px',
            marginTop: '-1px',
          }}>
            AERIAL EMERGENCY GRID & INTELLIGENCE SYSTEM
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {['System', 'Scenarios', 'Edgecases', 'About'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} style={{
              color: '#8A9A9E',
              textDecoration: 'none',
              fontFamily: 'var(--font-primary)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'color 0.2s',
            }}
            onMouseOver={e => e.target.style.color = '#79B9C1'}
            onMouseOut={e => e.target.style.color = '#8A9A9E'}
            >
              {link.replace('Edgecases', 'Edge Cases')}
            </a>
          ))}
          <a href="/disasters" style={{
            color: '#172124',
            background: '#79B9C1',
            textDecoration: 'none',
            fontFamily: 'var(--font-primary)',
            fontSize: '9.5px',
            fontWeight: 800,
            letterSpacing: '1px',
            padding: '8px 20px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 2px 8px rgba(121, 185, 193, 0.35)',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            textTransform: 'uppercase'
          }}
          onMouseOver={e => {
            e.target.style.background = '#96CCD3'
            e.target.style.transform = 'translateY(-1px)'
            e.target.style.boxShadow = '0 4px 12px rgba(121, 185, 193, 0.5)'
          }}
          onMouseOut={e => {
            e.target.style.background = '#79B9C1'
            e.target.style.transform = 'none'
            e.target.style.boxShadow = '0 2px 8px rgba(121, 185, 193, 0.35)'
          }}
          >
            Mission Registry
          </a>
          <ThemeToggle />
        </div>
      </nav>

      <Hero />
      <About />
      <ScenarioGrid />
      <EdgeCasesGrid />
      <Footer />
    </motion.div>
  )
}
