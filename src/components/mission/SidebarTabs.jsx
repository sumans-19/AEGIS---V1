import { useSimStore } from '../../store/useSimStore'
import { Camera, Thermometer, Route, Map, Users } from 'lucide-react'

const TABS = [
  { id: 'droneview', label: 'CAM', icon: Camera },
  { id: 'thermal', label: 'THERM', icon: Thermometer },
  { id: 'trajectory', label: 'TRAJ', icon: Route },
  { id: 'areamap', label: 'MAP', icon: Map },
  { id: 'survivors', label: 'LOG', icon: Users },
]

export default function SidebarTabs() {
  const activeSidebarTab = useSimStore(s => s.activeSidebarTab)
  const setActiveSidebarTab = useSimStore(s => s.setActiveSidebarTab)

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #1e293b',
    }}>
      {TABS.map(tab => {
        const isActive = activeSidebarTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => setActiveSidebarTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '8px 4px',
              background: isActive ? '#00e5ff08' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #00e5ff' : '2px solid transparent',
              color: isActive ? '#00e5ff' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              letterSpacing: '0.5px',
            }}
            onMouseOver={e => {
              if (!isActive) e.currentTarget.style.color = '#94a3b8'
            }}
            onMouseOut={e => {
              if (!isActive) e.currentTarget.style.color = '#475569'
            }}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
