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
      userSelect: 'none',
    }}>
      {/* Summary Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.5)',
        borderRadius: '6px',
        marginBottom: '8px',
      }}>
         <StatBox label="TOTAL" value={survivors.length} icon={Users} color="#6C7F84" />
         <StatBox label="DETECTED" value={detected.length} icon={ShieldAlert} color="#79B9C1" />
         <StatBox label="RESCUED" value={rescued.length} icon={UserCheck} color="#58ba8a" />
         <StatBox label="PENDING" value={survivors.length - detected.length} icon={Timer} color="#f59e0b" />
      </div>

      {/* List Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <AnimatePresence>
          {detected.map((s, idx) => {
             const drone = drones.find(d => d.id === s.detected_by)
             const isRescued = s.status === 'RESCUED'
             
             return (
               <motion.div
                 key={s.id}
                 initial={{ opacity: 0, y: 6 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.04 }}
                 style={{
                   padding: '8px 10px',
                   background: isRescued ? 'rgba(88, 186, 138, 0.12)' : 'rgba(255, 255, 255, 0.65)',
                   border: `1px solid ${isRescued ? 'rgba(88, 186, 138, 0.4)' : 'rgba(0, 0, 0, 0.06)'}`,
                   borderRadius: '6px',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: '5px',
                 }}
               >
                 {/* Top Row: Title & Badge */}
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ 
                       fontFamily: 'var(--font-primary)', 
                       fontSize: '9.5px', 
                       fontWeight: 800, 
                       color: '#172124',
                       whiteSpace: 'nowrap',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       maxWidth: '150px'
                    }}>
                      SURV #{String(s.id).replace('SURV-', '').slice(-8)}
                    </span>
                    <span style={{ 
                      fontSize: '7px', 
                      padding: '2px 5px', 
                      borderRadius: '3px', 
                      background: isRescued ? 'rgba(88, 186, 138, 0.2)' : 'rgba(121, 185, 193, 0.2)',
                      color: isRescued ? '#2e7d5a' : '#1a565e',
                      fontFamily: 'var(--font-primary)',
                      fontWeight: 800,
                      letterSpacing: '0.06em'
                    }}>
                      {isRescued ? 'RESCUED' : 'DETECTED'}
                    </span>
                 </div>
                 
                 {/* Data Grid */}
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '2px 0' }}>
                    <DataPair label="TEMP" value={`${s.body_temp?.toFixed(1) || 37.0}°C`} icon={Heart} />
                    <DataPair label="CONF" value={`${s.confidence > 1 ? s.confidence?.toFixed(0) : ((s.confidence || 0) * 100).toFixed(0)}%`} icon={Target} />
                    <DataPair label="UAV" value={drone?.callsign || 'UAV'} icon={MapPin} />
                    <DataPair label="POS" value={`${(s.real_coords?.[0] ?? s.pos?.[0] ?? 0).toFixed(0)}, ${(s.real_coords?.[1] ?? s.pos?.[2] ?? 0).toFixed(0)}`} icon={MapPin} />
                 </div>

                 {/* Action Button */}
                 {!isRescued ? (
                    <button 
                       onClick={() => markAsRescued(s.id)}
                       style={{
                          width: '100%',
                          background: 'rgba(121, 185, 193, 0.2)',
                          color: '#172124',
                          border: '1px solid #79B9C1',
                          borderRadius: '4px',
                          padding: '4px 0',
                          fontFamily: 'var(--font-primary)',
                          fontWeight: 800,
                          fontSize: '8px',
                          cursor: 'pointer',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          transition: 'all 0.2s ease'
                       }}
                       onMouseOver={e => {
                          e.currentTarget.style.background = '#79B9C1'
                          e.currentTarget.style.color = '#172124'
                       }}
                       onMouseOut={e => {
                          e.currentTarget.style.background = 'rgba(121, 185, 193, 0.2)'
                          e.currentTarget.style.color = '#172124'
                       }}
                    >
                       DISPATCH RESCUE
                    </button>
                 ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px' }}>
                       <UserCheck size={14} color="#58ba8a" />
                    </div>
                 )}
               </motion.div>
             )
          })}
        </AnimatePresence>
        
        {detected.length === 0 && (
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, padding: '30px 0' }}>
              <Users size={32} color="#6C7F84" style={{ marginBottom: '8px' }} />
              <div style={{ fontFamily: 'var(--font-primary)', fontSize: '8.5px', color: '#6C7F84', fontWeight: 600 }}>AWAITING FIELD DETECTION...</div>
           </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }) {
   return (
      <div style={{ textAlign: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginBottom: '2px' }}>
            <Icon size={10} color={color} />
            <span style={{ fontSize: '7px', fontFamily: 'var(--font-primary)', color: '#6C7F84', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</span>
         </div>
         <div style={{ fontSize: '13px', fontWeight: 800, color: '#172124', fontFamily: 'var(--font-primary)' }}>{value}</div>
      </div>
   )
}

function DataPair({ label, value, icon: Icon }) {
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
         <Icon size={9} color="#6C7F84" />
         <span style={{ fontSize: '7.5px', color: '#6C7F84', fontWeight: 700, width: '28px' }}>{label}:</span>
         <span style={{ fontSize: '7.5px', color: '#172124', fontWeight: 800 }}>{value}</span>
      </div>
   )
}
