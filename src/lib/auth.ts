import type { Role, Session } from '../types'
import { APP_CONFIG } from '../config'

const SESSION_KEY = 'ostfriesland-bilder-session-v1'
const ITERATIONS = 210_000

const USERS: Record<string, { role: Role; salt: string; digest: string }> = {
  Admin: {
    role: 'admin',
    salt: 'ostfriesland-admin-v1',
    digest: '7K5fIVQIyInEDG3uLbKuRij/2kj0t7APNzmmqtbNFX4=',
  },
  Ostfriesland: {
    role: 'viewer',
    salt: 'ostfriesland-viewer-v1',
    digest: 'F12K7qI7BLliryw+I5SQuRvnmarlxaZg/I4BJyHjwDE=',
  },
}

const toBase64 = (bytes: ArrayBuffer) => {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let index = 0; index < view.length; index += 1) binary += String.fromCharCode(view[index])
  return btoa(binary)
}

export async function authenticate(username: string, password: string): Promise<Session | null> {
  const user = USERS[username]
  if (!user) return null

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(user.salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  )

  if (toBase64(bits) !== user.digest) return null

  return {
    role: user.role,
    username,
    expiresAt: Date.now() + APP_CONFIG.sessionDays * 24 * 60 * 60 * 1000,
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    if (!value) return null
    const session = JSON.parse(value) as Session
    if (!session.expiresAt || session.expiresAt <= Date.now() || !['admin', 'viewer'].includes(session.role)) {
      clearSession()
      return null
    }
    return session
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

