import { useSimStore } from '../../store/useSimStore'

const CALLSIGNS = {
  1: 'Arjun',
  2: 'Bhima',
  3: 'Karna',
  4: 'Krishna',
  5: 'Ram',
}

const styles = {
  panel: { flex: 1, padding: '24px 32px', overflow: 'auto', background: 'var(--bg-primary)' },
  title: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em', color: '#172124', margin: '0 0 6px' },
  subtitle: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#55666B', marginBottom: '24px', letterSpacing: '0.04em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: (critical) => ({
    background: critical ? 'rgba(220, 53, 69, 0.08)' : 'rgba(235, 243, 245, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: critical ? '1px solid rgba(220, 53, 69, 0.4)' : '1px solid rgba(255, 255, 255, 0.95)',
    outline: '1px solid rgba(0, 0, 0, 0.07)',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: critical ? '0 4px 16px rgba(220, 53, 69, 0.15)' : '0 4px 14px rgba(0, 0, 0, 0.04), inset 0 1px 0 #FFFFFF',
  }),
  cardHeader: { fontFamily: 'var(--font-primary)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: '#172124', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' },
  line: { margin: '5px 0', fontFamily: 'var(--font-primary)', fontSize: '10.5px', color: '#55666B', fontWeight: 600 },
  action: { color: '#1a565e', fontWeight: 800 },
  assist: { marginTop: '8px', color: '#79B9C1', fontSize: '9.5px', fontFamily: 'var(--font-mono)', fontWeight: 700 },
  empty: { padding: '48px 24px', textAlign: 'center', color: '#6C7F84', fontFamily: 'var(--font-primary)', fontSize: '11px', fontWeight: 700, border: '1px dashed rgba(0, 0, 0, 0.15)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.4)' },
}

export default function AIDecisionPanel() {
  const liveAiDrones = useSimStore(s => s.liveAiDrones)
  const backendConnected = useSimStore(s => s.backendConnected)

  const storeDrones = useSimStore(s => s.drones)

  const drones = liveAiDrones || []

  const filteredDrones = drones.filter(d => {
    // Always show simulated drones
    const storeDrone = storeDrones.find(sd => sd.id === d.id)
    if (storeDrone?.isSimulated) return true

    const action = typeof d.action === 'string' ? d.action : d.action?.action || 'CONTINUE_MISSION'
    const reason = typeof d.action === 'object' ? d.action?.reason || '' : (d.reason || '')
    return action !== 'CONTINUE_MISSION' || (reason && reason !== 'All systems nominal')
  })

  const getActionString = (d) => {
    if (!d) return 'CONTINUE_MISSION'
    if (typeof d.action === 'string') return d.action
    return d.action?.action || 'CONTINUE_MISSION'
  }

  const priorityOrder = [
    "RETURN_TO_BASE",
    "REROUTE",
    "AVOID_OBSTACLE"
  ]

  const sortedDrones = [...filteredDrones].sort((a, b) => {
    const actA = getActionString(a)
    const actB = getActionString(b)
    
    const idxA = priorityOrder.indexOf(actA)
    const idxB = priorityOrder.indexOf(actB)
    
    const valA = idxA === -1 ? 999 : idxA
    const valB = idxB === -1 ? 999 : idxB
    
    return valA - valB
  })

  return (
    <div className="ai-decision-panel" style={styles.panel}>
      <h3 style={styles.title}>AI DECISIONS & INTERVENTIONS</h3>
      <p style={styles.subtitle}>
        {backendConnected ? 'LIVE STREAM // ALL DRONES EVALUATED EVERY SECOND' : 'WAITING FOR BACKEND CONNECTION…'}
      </p>

      {sortedDrones.length > 0 ? (
        <div style={styles.grid}>
          {sortedDrones.map(d => {
            const critical = (d.battery ?? 100) < 20
            const label = d.callsign || CALLSIGNS[d.id] || `DRONE-${d.id}`
            const action = typeof d.action === 'string' ? d.action : d.action?.action || 'CONTINUE_MISSION'
            const reason =
              typeof d.action === 'object' && d.action !== null
                ? d.action?.reason || ''
                : (d.reason || '')
            const storeDrone = storeDrones.find(sd => sd.id === d.id)
            const isSimulated = storeDrone?.isSimulated ?? false
            return (
              <div key={d.id} className="ai-card" style={styles.card(critical)}>
                <div style={styles.cardHeader}>
                  {label} // UNIT 0{d.id}
                  {isSimulated && (
                    <span style={{ color: '#d97706', marginLeft: '8px', fontSize: '9px', fontWeight: 800, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                      SIMULATED
                    </span>
                  )}
                  {critical && (
                    <span style={{ color: '#dc3545', marginLeft: '8px', fontSize: '9px', fontWeight: 800, background: 'rgba(220, 53, 69, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                      CRITICAL
                    </span>
                  )}
                </div>
                <div style={styles.line}>Unit: DRONE-0{d.id}</div>
                <div style={styles.line}>
                  Action: <span style={styles.action}>{action}</span>
                </div>
                {reason && <div style={styles.line}>Reason: {reason}</div>}
                <div style={styles.line}>Status: {d.status}</div>
                {d.battery != null && (
                  <div style={styles.line}>Battery: {Number(d.battery).toFixed(1)}%</div>
                )}
                {d.nearby_drone_id && (
                  <div style={styles.assist}>
                    ASSISTING: {CALLSIGNS[d.nearby_drone_id] || d.nearby_drone_id}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={styles.empty}>
          No active AI interventions. Inject failures in the simulation panel to trigger decisions.
        </div>
      )}
    </div>
  )
}