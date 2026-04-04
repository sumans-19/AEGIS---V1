import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserCheck, Timer, MapPin, Heart, ShieldAlert, Target } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function SurvivorsLog() {
  const survivors = useSimStore(s => s.survivors)
  const drones = useSimStore(s => s.drones)
  const markAsRescued = (id) => {
     // useSimStore.getState().sendCommand('mark_rescued', {id})
  }

  const detected = survivors.filter(s => s.detected)
  const rescued = survivors.filter(s => s.status === 'RESCUED')

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
    }}>
      {/* Summary Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        background: 'rgba(0,0,0,0.05)',
      }}>
         <StatBox label="TOTAL" value={survivors.length} icon={Users} color="#94a3b8" />
         <StatBox label="DETECTED" value={detected.length} icon={ShieldAlert} color="#00e5ff" />
         <StatBox label="RESCUED" value={rescued.length} icon={UserCheck} color="#00ff88" />
         <StatBox label="PENDING" value={survivors.length - detected.length} icon={Timer} color="#ffb300" />
      </div>

      {/* List Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <AnimatePresence>
          {detected.map((s, idx) => {
             const drone = drones.find(d => d.id === s.detected_by)
             const isRescued = s.status === 'RESCUED'
             
             return (
               <motion.div
                 key={s.id}
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: idx * 0.05 }}
                 className="corner-brackets"
                 style={{
                   padding: '16px',
                   background: isRescued ? 'rgba(0, 255, 136, 0.05)' : 'rgba(0, 229, 255, 0.05)',
                   border: `1px solid ${isRescued ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 229, 255, 0.2)'}`,
                   display: 'grid',
                   gridTemplateColumns: '1fr auto',
                   gap: '12px',
                 }}
               >
                 <div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>SURVIVOR_#{s.id}</span>
                      <span style={{ 
                        fontSize: '9px', 
                        padding: '2px 6px', 
                        borderRadius: '2px', 
                        background: isRescued ? '#00ff8820' : '#00e5ff20',
                        color: isRescued ? '#00ff88' : '#00e5ff',
                        fontFamily: 'JetBrains Mono',
                        letterSpacing: '1px'
                      }}>
                        {isRescued ? 'RESCUE_CONFIRMED' : 'THERMAL_ID'}
                      </span>
                   </div>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <DataPair label="TEMP" value={`${s.body_temp?.toFixed(1)}°C`} icon={Heart} />
                      <DataPair label="CONFID" value={`${s.confidence > 1 ? s.confidence.toFixed(0) : (s.confidence * 100).toFixed(0)}%`} icon={Target} />
                      <DataPair label="SENSE" value={drone?.callsign || 'UAV'} icon={MapPin} />
                      <DataPair label="LATLON" value={`${s.real_coords?.[0]?.toFixed(3)}, ${s.real_coords?.[1]?.toFixed(3)}`} icon={MapPin} />
                   </div>
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center' }}>
                   {!isRescued && (
                      <button 
                         onClick={() => markAsRescued(s.id)}
                         style={{
                            background: '#00ff88',
                            color: '#0a0a0f',
                            border: 'none',
                            padding: '10px 14px',
                            fontFamily: 'Rajdhani',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                            letterSpacing: '1px',
                            boxShadow: '0 0 10px #00ff8840'
                         }}
                      >
                         DISPATCH_RESCUE
                      </button>
                   )}
                   {isRescued && <UserCheck size={24} color="#00ff88" />}
                 </div>
               </motion.div>
             )
          })}
        </AnimatePresence>
        
        {detected.length === 0 && (
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
              <Users size={64} style={{ marginBottom: '16px' }} />
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>AWAITING_FIELD_DETECTION...</div>
           </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }) {
   return (
      <div style={{ textAlign: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <Icon size={12} color={color} />
            <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono', color: '#475569', letterSpacing: '1px' }}>{label}</span>
         </div>
         <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'Rajdhani' }}>{value}</div>
      </div>
   )
}

function DataPair({ label, value, icon: Icon }) {
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
         <Icon size={10} color="#475569" />
         <span style={{ fontSize: '9px', color: '#94a3b8', width: '35px' }}>{label}:</span>
         <span style={{ fontSize: '9px', color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
      </div>
   )
}
