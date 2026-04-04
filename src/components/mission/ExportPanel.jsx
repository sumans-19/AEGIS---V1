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
        width: '400px',
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-color)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{
        padding: '24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database color="#00e5ff" size={20} />
            <span style={{ fontFamily: 'Rajdhani', fontSize: '20px', fontWeight: 700, letterSpacing: '1px', color: '#e2e8f0' }}>EXPORT_&_ANALYSIS</span>
         </div>
         <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
         <div style={{ padding: '24px' }}>
            {/* Section 1: Export Current */}
            <h4 style={sectionHeaderStyle}>MISSION_SNAPSHOT</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '32px' }}>
               <ExportBtn label="JSON" icon={FileJson} onClick={() => exportMission('json')} />
               <ExportBtn label="CSV" icon={FileText} onClick={() => exportMission('csv')} />
               <ExportBtn label="REPORT" icon={Download} onClick={() => exportMission('report')} />
            </div>

            {/* Section 2: Merge Missions */}
            <h4 style={sectionHeaderStyle}>MISSION_AGGREGATOR</h4>
            <div style={{ 
               padding: '20px', 
               border: '2px dashed var(--border-color)', 
               borderRadius: '4px', 
               textAlign: 'center',
               marginBottom: '16px',
            }}>
               <input 
                  type="file" 
                  id="file-load" 
                  style={{ display: 'none' }} 
                  onChange={handleFileLoad} 
                  accept=".json"
               />
               <label htmlFor="file-load" style={{ cursor: 'pointer' }}>
                  <Upload size={32} color="#00e5ff" style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>DROP_JSON_FILES_OR_BROWSE</div>
               </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
               {files.map(f => (
                  <div key={f.id} style={{
                     padding: '10px 12px',
                     background: 'rgba(255,255,255,0.05)',
                     borderRadius: '2px',
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     fontFamily: 'JetBrains Mono',
                     fontSize: '10px',
                  }}>
                     <span style={{ color: '#e2e8f0' }}>{f.name} ({f.size})</span>
                     <Trash2 size={14} color="#ff2929" style={{ cursor: 'pointer' }} onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} />
                  </div>
               ))}
            </div>

            <button disabled={files.length < 2} style={{
               width: '100%',
               padding: '14px',
               background: files.length < 2 ? 'rgba(0, 229, 255, 0.1)' : '#00e5ff',
               color: files.length < 2 ? '#475569' : '#0a0a0f',
               border: 'none',
               fontFamily: 'Rajdhani',
               fontWeight: 700,
               fontSize: '14px',
               letterSpacing: '1px',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '8px',
               transition: '0.3s',
            }}>
               <GitMerge size={18} />
               MERGE_AND_ANALYZE
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
            gap: '8px',
            padding: '16px 8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            color: '#e2e8f0',
            cursor: 'pointer',
            transition: '0.3s',
            fontFamily: 'JetBrains Mono',
            fontSize: '9px',
         }}
         onMouseOver={e => e.currentTarget.style.borderColor = '#00e5ff'}
         onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
      >
         <Icon size={20} color="#00e5ff" />
         {label}
      </button>
   )
}

const sectionHeaderStyle = {
   fontFamily: 'JetBrains Mono',
   fontSize: '11px',
   color: '#00e5ff',
   letterSpacing: '2px',
   borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
   paddingBottom: '8px',
   marginBottom: '20px',
   fontWeight: 600,
}
