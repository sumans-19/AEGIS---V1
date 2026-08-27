import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Brain } from 'lucide-react'
import AIDecisionPanel from '../components/mission/AIDecisionPanel'

export default function AIDashboard({ isEmbedded }) {
  const navigate = useNavigate()

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!isEmbedded && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#20292B',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => navigate('/mission')}
              style={navBtn}
              title="Back to Mission"
            >
              <ArrowLeft size={16} />
            </button>
            <Brain size={20} color="#79B9C1" />
            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  color: '#FFFFFF',
                }}
              >
                AI DECISION DASHBOARD
              </h1>
              <p
                style={{
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8.5px',
                  color: '#8A9A9E',
                  letterSpacing: '1px',
                }}
              >
                COMMAND CENTER // LIVE INTERVENTION MONITOR
              </p>
            </div>
          </div>
        </header>
      )}

      <AIDecisionPanel />
    </div>
  )
}

const navBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 10px',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '6px',
  color: '#DCE6E8',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}
