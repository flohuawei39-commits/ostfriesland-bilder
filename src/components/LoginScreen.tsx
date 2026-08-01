import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { authenticate, saveSession } from '../lib/auth'
import type { Session } from '../types'

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await authenticate(username, password)
      if (!session) {
        setError('Kennung oder Passwort ist nicht korrekt.')
        return
      }
      saveSession(session)
      onLogin(session)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <p className="eyebrow">Privates Bildarchiv</p>
        <h1 id="login-title">Ostfriesland<br />Bilder</h1>
        <p className="login-intro">Melde dich an, um die Galerien anzusehen und Originaldateien herunterzuladen.</p>

        <form onSubmit={submit} className="login-form">
          <label>
            <span>Kennung</span>
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label>
            <span>Passwort</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label="Passwort anzeigen oder verbergen">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy} type="submit">
            <LockKeyhole size={17} /> {busy ? 'Prüfe…' : 'Galerie öffnen'}
          </button>
        </form>

        <p className="security-note">Hinweis: Diese Anmeldung ist eine Sichtschranke. Die Dateien liegen technisch öffentlich bei GitHub.</p>
      </section>
    </main>
  )
}

