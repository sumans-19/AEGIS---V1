import { Sun, Moon } from 'lucide-react'
import { useSimStore } from '../store/useSimStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useSimStore()

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#8A9A9E',
        cursor: 'pointer',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.18s ease',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
        e.currentTarget.style.color = '#FFFFFF'
        e.currentTarget.style.borderColor = '#79B9C1'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
        e.currentTarget.style.color = '#8A9A9E'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
      }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
