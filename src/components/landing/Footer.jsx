export default function Footer() {
  return (
    <footer style={{
      padding: '60px 40px',
      background: '#080c1a',
      borderTop: '1px solid #1e293b',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '14px',
            color: '#475569',
            fontWeight: 600,
            letterSpacing: '1px',
            marginBottom: '4px',
          }}>
            AEGIS v1.0 — Disaster Response Simulation Platform
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#334155',
            letterSpacing: '0.5px',
          }}>
            Built for training autonomous drone systems in emergency scenarios
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          {['Documentation', 'GitHub', 'Contact'].map(link => (
            <a
              key={link}
              href="#"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#475569',
                textDecoration: 'none',
                letterSpacing: '1px',
                transition: 'color 0.2s',
              }}
              onMouseOver={e => e.target.style.color = '#00e5ff'}
              onMouseOut={e => e.target.style.color = '#475569'}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
