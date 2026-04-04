import { motion } from 'framer-motion'
import ScenarioCard from './ScenarioCard'

const scenarios = [
  {
    id: 'earthquake',
    title: 'EARTHQUAKE',
    location: 'Türkiye-Syria Border, 2023',
    details: 'Magnitude 7.8 · Urban collapse · 11,000+ structures affected',
    accent: '#ff6b2b',
    status: 'SIMULATION READY',
    statusColor: '#00ff88',
    icon: 'earthquake',
    clickable: true,
  },
  {
    id: 'tsunami',
    title: 'TSUNAMI',
    location: 'Sulawesi, Indonesia',
    details: 'Wave height 6m · Coastal devastation · 2km inland reach',
    accent: '#0066ff',
    status: 'SIMULATION READY',
    statusColor: '#00ff88',
    icon: 'tsunami',
    clickable: true,
  },
  {
    id: 'wildfire',
    title: 'WILDFIRE',
    location: 'Maui, Hawaii, 2023',
    details: 'Wind-driven · 3,000 acres · Dense residential zones',
    accent: '#ff4500',
    status: 'SIMULATION READY',
    statusColor: '#00ff88',
    icon: 'wildfire',
    clickable: true,
  },
  {
    id: 'flood',
    title: 'FLOOD',
    location: 'Pakistan Sindh Province',
    details: 'River overflow · 33% of country submerged',
    accent: '#00b8d4',
    status: 'SIMULATION READY',
    statusColor: '#00ff88',
    icon: 'flood',
    clickable: true,
  },
  {
    id: 'avalanche',
    title: 'AVALANCHE',
    location: 'Hindu Kush Range, Afghanistan',
    details: 'Sudden mass · Mountain villages buried · Zero visibility',
    accent: '#b0d4f1',
    status: 'BETA',
    statusColor: '#ffb300',
    icon: 'avalanche',
    clickable: true,
  },
  {
    id: 'cyclone',
    title: 'CYCLONE',
    location: 'Odisha Coast, India',
    details: 'Category 4 · Storm surge · Coastal + inland impact',
    accent: '#a855f7',
    status: 'COMING SOON',
    statusColor: '#475569',
    icon: 'cyclone',
    clickable: false,
  },
]

export default function ScenarioGrid() {
  return (
    <section id="scenarios" style={{
      padding: '100px 40px 120px',
      background: 'var(--bg-primary)',
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
            // MISSION DATABASE
          </div>
          <h2 style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '48px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '4px',
            marginBottom: '16px',
          }}>
            SELECT DISASTER SCENARIO
          </h2>
          <p style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: 1.7,
            fontWeight: 500,
          }}>
            Each simulation uses real geographic data and physics-based destruction 
            modeling to train drone response systems.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}>
          {scenarios.map((scenario, idx) => (
            <ScenarioCard key={scenario.id} scenario={scenario} index={idx} />
          ))}
        </div>
      </div>
    </section>
  )
}
