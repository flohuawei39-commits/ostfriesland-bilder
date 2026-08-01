import { Images, LogOut, Settings } from 'lucide-react'
import type { Session } from '../types'

interface HeaderProps {
  session: Session
  adminOpen: boolean
  onAdminToggle: () => void
  onHome: () => void
  onLogout: () => void
}

export function Header({ session, adminOpen, onAdminToggle, onHome, onLogout }: HeaderProps) {
  return (
    <header className="site-header">
      <button className="header-brand" onClick={onHome}>
        <span className="header-logo"><Images size={20} /></span>
        <span><strong>Ostfriesland</strong><small>Bilder</small></span>
      </button>
      <nav className="header-actions" aria-label="Kontomenü">
        <span className="user-chip">{session.username}</span>
        {session.role === 'admin' && (
          <button className={adminOpen ? 'header-button active' : 'header-button'} onClick={onAdminToggle}>
            <Settings size={17} /><span>Verwalten</span>
          </button>
        )}
        <button className="header-button" onClick={onLogout}>
          <LogOut size={17} /><span>Abmelden</span>
        </button>
      </nav>
    </header>
  )
}

