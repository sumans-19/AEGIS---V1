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
        fontFamily: 'var(--font-mono)',
        fontSize: '32px',
        fontWeight: 700,
        color: '#1a565e',
        lineHeight: 1,
      }}>
        {count}{suffix}
      </div>
      <div style={{
        fontFamily: 'var(--font-primary)',
        fontSize: '11px',
        fontWeight: 700,
        color: '#6C7F84',
        letterSpacing: '0.06em',
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
            fontFamily: 'var(--font-display)',
            fontSize: '64px',
            fontWeight: 800,
            color: '#172124',
            lineHeight: 1.08,
            letterSpacing: '0.04em',
            marginBottom: '20px',
          }}
        >
          WHEN SECONDS DEFINE{' '}
          <span style={{ color: '#1a565e', textShadow: '0 2px 12px rgba(121, 185, 193, 0.4)' }}>SURVIVAL</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '17px',
            color: '#55666B',
            lineHeight: 1.65,
            maxWidth: '700px',
            margin: '0 auto 36px',
            fontWeight: 500,
          }}
        >
          AEGIS deploys autonomous AI-powered drone swarms into active disaster zones — 
          mapping destruction, detecting survivors, and coordinating rescue operations in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginBottom: '50px' }}
        >
          <button
            onClick={() => navigate('/mission?scenario=earthquake')}
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              padding: '12px 32px',
              background: '#79B9C1',
              color: '#172124',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 16px rgba(121, 185, 193, 0.4)',
              borderRadius: '30px',
              textTransform: 'uppercase',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#96CCD3'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(121, 185, 193, 0.55)'
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#79B9C1'
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(121, 185, 193, 0.4)'
            }}
          >
            BEGIN SIMULATION →
          </button>

          <button
            onClick={scrollToScenarios}
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              padding: '12px 32px',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#172124',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              borderRadius: '30px',
              textTransform: 'uppercase',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#FFFFFF'
              e.currentTarget.style.borderColor = '#79B9C1'
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)'
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)'
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
          paddingTop: '24px',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        }}>
          <AnimatedCounter target={2.3} suffix="s" label="Avg deployment time" delay={800} />
          <AnimatedCounter target={94.7} suffix="%" label="Survivor detection accuracy" delay={1000} />
          <AnimatedCounter target={5} suffix="" label="Drones per active zone" delay={1200} />
        </div>
      </div>
    </section>
  )
}
