import { useSimStore } from '../../store/useSimStore'
import { Camera, Thermometer, Map, Users, Network, Radio, Activity } from 'lucide-react'

const TABS = [
  { id: 'droneview', label: 'CAM', icon: Camera },
  { id: 'thermal', label: 'THERM', icon: Thermometer },
  { id: 'radar', label: 'RADAR', icon: Radio },
  { id: 'areamap', label: 'MAP', icon: Map },
  { id: 'survivors', label: 'LOG', icon: Users },
  { id: 'pathfinding', label: 'A*', icon: Network },
  { id: 'sensors', label: 'SENS', icon: Activity },
]

export default function SidebarTabs() {
  const activeSidebarTab = useSimStore(s => s.activeSidebarTab)
  const setActiveSidebarTab = useSimStore(s => s.setActiveSidebarTab)

  return (
    <div style={{
      display: 'flex',
      padding: '4px 8px',
      background: 'rgba(0, 0, 0, 0.04)',
      gap: '3px',
      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
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
              gap: '2px',
              padding: '5px 2px',
              background: isActive ? '#B9DCE1' : 'transparent',
              borderRadius: '5px',
              border: 'none',
              color: isActive ? '#172124' : '#6C7F84',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              fontFamily: 'var(--font-primary)',
              fontSize: '7px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
            }}
            onMouseOver={e => {
              if (!isActive) {
                e.currentTarget.style.color = '#172124'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'
              }
            }}
            onMouseOut={e => {
              if (!isActive) {
                e.currentTarget.style.color = '#6C7F84'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <Icon size={12} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
