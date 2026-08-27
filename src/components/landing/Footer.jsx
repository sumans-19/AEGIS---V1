export default function Footer() {
  return (
    <footer style={{
      padding: '40px 40px',
      background: '#20292B',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      userSelect: 'none',
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
            fontFamily: 'var(--font-primary)',
            fontSize: '13px',
            color: '#FFFFFF',
            fontWeight: 800,
            letterSpacing: '0.08em',
            marginBottom: '4px',
            textTransform: 'uppercase',
          }}>
            AEGIS SWARMSYNC // Autonomous Disaster Response Platform
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            color: '#8A9A9E',
            letterSpacing: '0.04em',
          }}>
            Built for coordinating multi-UAV autonomous search & rescue operations
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          {['Documentation', 'GitHub', 'Diagnostics'].map(link => (
            <a
              key={link}
              href="#"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                color: '#8A9A9E',
                textDecoration: 'none',
                letterSpacing: '0.04em',
                fontWeight: 600,
                transition: 'color 0.18s ease',
              }}
              onMouseOver={e => e.target.style.color = '#79B9C1'}
              onMouseOut={e => e.target.style.color = '#8A9A9E'}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
