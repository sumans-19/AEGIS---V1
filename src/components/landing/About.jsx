import { motion } from 'framer-motion'
import { Crosshair, ScanLine, Radio } from 'lucide-react'

const features = [
  {
    number: '01',
    title: 'DEPLOY',
    description: 'Drone swarms launch within seconds of disaster confirmation, pre-loaded with zone coordinates and mission parameters.',
    icon: Crosshair,
  },
  {
    number: '02',
    title: 'DETECT',
    description: 'Thermal imaging, LiDAR scanning, and AI vision models identify survivors through rubble, smoke, and darkness.',
    icon: ScanLine,
  },
  {
    number: '03',
    title: 'DIRECT',
    description: 'Live telemetry streams to ground control. Every drone trajectory, sensor reading, and survivor detection logged and actionable.',
    icon: Radio,
  },
]

export default function About() {
  return (
    <section id="about" style={{
      padding: '120px 40px',
      background: 'var(--bg-secondary)',
      transition: 'background 0.5s ease',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <motion.div
// ... Keep motion wrapper ...
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: 'var(--cyan)',
            letterSpacing: '5px',
            marginBottom: '16px',
            fontWeight: 700,
          }}>
            // SYSTEM OVERVIEW
          </div>
          <h2 style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '48px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '4px',
          }}>
            HOW AEGIS OPERATES
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px',
        }}>
          {features.map((feature, idx) => (
            <motion.div
              key={feature.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="corner-brackets"
              style={{
                position: 'relative',
                padding: '48px 36px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                borderRadius: '8px',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = 'var(--cyan)'
                e.currentTarget.style.boxShadow = 'var(--cyan-glow)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Background Number */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '10px',
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '140px',
                fontWeight: 700,
                color: 'var(--cyan)',
                opacity: 0.08,
                lineHeight: 1,
                pointerEvents: 'none',
                userSelect: 'none',
              }}>
                {feature.number}
              </div>

              <feature.icon
                size={34}
                style={{ color: 'var(--cyan)', marginBottom: '24px' }}
              />

              <h3 style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--cyan)',
                letterSpacing: '3px',
                marginBottom: '16px',
              }}>
                {feature.title}
              </h3>

              <p style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                fontWeight: 500,
              }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
