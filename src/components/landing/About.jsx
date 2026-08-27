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
      padding: '100px 40px',
      background: 'var(--bg-secondary)',
      transition: 'background 0.5s ease',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <motion.div
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#1a565e',
            letterSpacing: '0.15em',
            marginBottom: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}>
            // SYSTEM ARCHITECTURE
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '40px',
            fontWeight: 800,
            color: '#172124',
            letterSpacing: '0.04em',
          }}>
            HOW AEGIS OPERATES
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {features.map((feature, idx) => (
            <motion.div
              key={feature.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              style={{
                position: 'relative',
                padding: '40px 32px',
                background: 'rgba(235, 243, 245, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.95)',
                outline: '1px solid rgba(0, 0, 0, 0.07)',
                overflow: 'hidden',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                borderRadius: '12px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = 'rgba(121, 185, 193, 0.8)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(121, 185, 193, 0.25), inset 0 1px 0 #FFFFFF'
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.background = '#FFFFFF'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.95)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.background = 'rgba(235, 243, 245, 0.85)'
              }}
            >
              {/* Background Number */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '12px',
                fontFamily: 'var(--font-display)',
                fontSize: '120px',
                fontWeight: 800,
                color: '#79B9C1',
                opacity: 0.12,
                lineHeight: 1,
                pointerEvents: 'none',
                userSelect: 'none',
              }}>
                {feature.number}
              </div>

              <feature.icon
                size={30}
                style={{ color: '#1a565e', marginBottom: '20px' }}
              />

              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 800,
                color: '#172124',
                letterSpacing: '0.06em',
                marginBottom: '12px',
              }}>
                {feature.title}
              </h3>

              <p style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '14.5px',
                color: '#55666B',
                lineHeight: 1.65,
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
