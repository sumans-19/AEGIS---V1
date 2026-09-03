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
  {
    id: 'dense_forest',
    title: 'DENSE FOREST',
    location: 'Western Ghats, India',
    details: 'Dense canopy · Natural terrain · Trail & clearing SAR',
    accent: '#2d8a4e',
    status: 'SIMULATION READY',
    statusColor: '#00ff88',
    icon: 'dense_forest',
    clickable: true,
  },
]

export default function ScenarioGrid() {
  return (
    <section id="scenarios" style={{
      padding: '80px 40px 100px',
      background: 'var(--bg-primary)',
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
            // MISSION DATABASE
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '40px',
            fontWeight: 800,
            color: '#172124',
            letterSpacing: '0.04em',
            marginBottom: '12px',
          }}>
            SELECT DISASTER SCENARIO
          </h2>
          <p style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '16px',
            color: '#55666B',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: 1.65,
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
