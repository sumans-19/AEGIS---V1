import { Sun, Moon } from 'lucide-react'
import { useSimStore } from '../store/useSimStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useSimStore()

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'none',
        border: '1px solid var(--border-color)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '6px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
