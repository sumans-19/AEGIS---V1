import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileJson, FileText, Database, Upload, Trash2, GitMerge } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function ExportPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('current')
  const [files, setFiles] = useState([])
  const scenario = useSimStore(s => s.scenario)
  const exportMission = useSimStore(s => s.exportMission)

  const handleFileLoad = (e) => {
     const file = e.target.files[0]
     if (file) setFiles(prev => [...prev, { name: file.name, id: Math.random(), size: (file.size/1024).toFixed(1) + 'KB' }])
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '380px',
        background: 'rgba(235, 243, 245, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.1)',
        userSelect: 'none',
      }}
    >
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#20292B',
      }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database color="#79B9C1" size={16} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em', color: '#FFFFFF' }}>EXPORT // ANALYSIS</span>
         </div>
         <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8A9A9E', cursor: 'pointer', fontSize: '14px' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
         <div style={{ padding: '20px' }}>
            {/* Section 1: Export Current */}
            <h4 style={sectionHeaderStyle}>MISSION SNAPSHOT</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
               <ExportBtn label="JSON" icon={FileJson} onClick={() => exportMission('json')} />
               <ExportBtn label="CSV" icon={FileText} onClick={() => exportMission('csv')} />
               <ExportBtn label="REPORT" icon={Download} onClick={() => exportMission('report')} />
            </div>

            {/* Section 2: Merge Missions */}
            <h4 style={sectionHeaderStyle}>MISSION AGGREGATOR</h4>
            <div style={{ 
               padding: '16px', 
               border: '2px dashed rgba(0, 0, 0, 0.15)', 
               borderRadius: '8px', 
               textAlign: 'center',
               marginBottom: '14px',
               background: 'rgba(255, 255, 255, 0.5)',
            }}>
               <input 
                  type="file" 
                  id="file-load" 
                  style={{ display: 'none' }} 
                  onChange={handleFileLoad} 
                  accept=".json"
               />
               <label htmlFor="file-load" style={{ cursor: 'pointer' }}>
                  <Upload size={24} color="#79B9C1" style={{ opacity: 0.8, marginBottom: '6px' }} />
                  <div style={{ fontSize: '9px', color: '#55666B', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>DROP JSON FILES OR BROWSE</div>
               </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
               {files.map(f => (
                  <div key={f.id} style={{
                     padding: '8px 12px',
                     background: 'rgba(255, 255, 255, 0.7)',
                     borderRadius: '6px',
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     fontFamily: 'var(--font-mono)',
                     fontSize: '9.5px',
                     border: '1px solid rgba(0, 0, 0, 0.05)',
                  }}>
                     <span style={{ color: '#172124', fontWeight: 600 }}>{f.name} ({f.size})</span>
                     <Trash2 size={13} color="#dc3545" style={{ cursor: 'pointer' }} onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} />
                  </div>
               ))}
            </div>

            <button disabled={files.length < 2} style={{
               width: '100%',
               padding: '10px',
               background: files.length < 2 ? 'rgba(0, 0, 0, 0.06)' : '#79B9C1',
               color: files.length < 2 ? '#8A9A9E' : '#172124',
               border: 'none',
               borderRadius: '6px',
               fontFamily: 'var(--font-primary)',
               fontWeight: 800,
               fontSize: '10px',
               letterSpacing: '0.08em',
               cursor: files.length < 2 ? 'not-allowed' : 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '6px',
               transition: 'all 0.18s ease',
               textTransform: 'uppercase',
               boxShadow: files.length >= 2 ? '0 2px 8px rgba(121, 185, 193, 0.35)' : 'none',
            }}>
               <GitMerge size={14} />
               MERGE & ANALYZE
            </button>
         </div>
      </div>
    </motion.div>
  )
}

function ExportBtn({ label, icon: Icon, onClick }) {
   return (
      <button 
         onClick={onClick}
         style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 8px',
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '8px',
            color: '#172124',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 700,
         }}
         onMouseOver={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#79B9C1' }}
         onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)' }}
      >
         <Icon size={18} color="#79B9C1" />
         {label}
      </button>
   )
}

const sectionHeaderStyle = {
   fontFamily: 'var(--font-primary)',
   fontSize: '10px',
   color: '#1a565e',
   letterSpacing: '0.08em',
   borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
   paddingBottom: '6px',
   marginBottom: '14px',
   fontWeight: 800,
   textTransform: 'uppercase',
}
