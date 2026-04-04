import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import HeroGlobe from './HeroGlobe'

function AnimatedCounter({ target, suffix, label, delay }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const isDecimal = String(target).includes('.')
      const duration = 2000
      const steps = 60
      const stepTime = duration / steps
      let step = 0

      const timer = setInterval(() => {
        step++
        const progress = step / steps
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = eased * target

        if (isDecimal) {
          setCount(current.toFixed(1))
        } else {
          setCount(Math.floor(current))
        }

        if (step >= steps) {
          clearInterval(timer)
          setCount(isDecimal ? target.toFixed(1) : target)
        }
      }, stepTime)

      return () => clearInterval(timer)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, delay])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000 + 0.5, duration: 0.6 }}
      style={{ textAlign: 'center' }}
    >
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '32px',
        fontWeight: 600,
        color: '#00e5ff',
        lineHeight: 1,
      }}>
        {count}{suffix}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#475569',
        letterSpacing: '2px',
        marginTop: '8px',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </motion.div>
  )
}

export default function Hero() {
  const navigate = useNavigate()

  const scrollToScenarios = (e) => {
    e.preventDefault()
    document.getElementById('scenarios')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section style={{
      position: 'relative',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* 3D Globe Background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}>
        <HeroGlobe />
      </div>

      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'var(--bg-gradient)',
        zIndex: 1,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px', padding: '0 40px' }}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '72px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.05,
            letterSpacing: '2px',
            marginBottom: '24px',
          }}
        >
          WHEN SECONDS DEFINE{' '}
          <span style={{ color: 'var(--cyan)', textShadow: 'var(--cyan-glow)' }}>SURVIVAL</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: '700px',
            margin: '0 auto 40px',
            fontWeight: 400,
          }}
        >
          AEGIS deploys autonomous AI-powered drone swarms into active disaster zones — 
          mapping destruction, detecting survivors, and coordinating rescue operations in real time.
        </motion.p>

        <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: 0.6 }}
  style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}
>
  <button
    onClick={() => navigate('/mission?scenario=earthquake')}
    style={{
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '16px',
      fontWeight: 700,
      letterSpacing: '1px',
      padding: '14px 32px',
      background: 'var(--cyan)',
      color: 'var(--bg-primary)',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s',
      boxShadow: 'var(--cyan-glow)',
      borderRadius: '40px',
    }}
  >
    BEGIN SIMULATION →
  </button>

  <button
    onClick={scrollToScenarios}
    style={{
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '16px',
      fontWeight: 700,
      letterSpacing: '1px',
      padding: '14px 32px',
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '2px solid var(--border-color)',
      cursor: 'pointer',
      transition: 'all 0.3s',
      borderRadius: '40px',
    }}
  >
    VIEW SCENARIOS
  </button>
</motion.div>

{/* Stat Counters */}
<div style={{
  display: 'flex',
  gap: '60px',
  justifyContent: 'center',
  paddingTop: '30px',
  borderTop: '1px solid var(--border-color)',
}}>
  <AnimatedCounter target={2.3} suffix="s" label="Avg deployment time" delay={800} />
  <AnimatedCounter target={94.7} suffix="%" label="Survivor detection accuracy" delay={1000} />
  <AnimatedCounter target={5} suffix="" label="Drones per active zone" delay={1200} />
</div>
</div>
    </section>
  )
}
