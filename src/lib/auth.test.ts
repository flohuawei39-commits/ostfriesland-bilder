import { beforeEach, describe, expect, it } from 'vitest'
import { authenticate, clearSession, loadSession, saveSession } from './auth'

describe('client authentication', () => {
  beforeEach(() => localStorage.clear())

  it('accepts both configured roles and rejects wrong case/passwords', async () => {
    expect((await authenticate('Admin', 'AdminBilder'))?.role).toBe('admin')
    expect((await authenticate('Ostfriesland', 'OstfrieslandBilder'))?.role).toBe('viewer')
    expect(await authenticate('admin', 'AdminBilder')).toBeNull()
    expect(await authenticate('Admin', 'falsch')).toBeNull()
  })

  it('persists a valid session and removes expired sessions', () => {
    saveSession({ username: 'Admin', role: 'admin', expiresAt: Date.now() + 10000 })
    expect(loadSession()?.username).toBe('Admin')
    saveSession({ username: 'Admin', role: 'admin', expiresAt: Date.now() - 1 })
    expect(loadSession()).toBeNull()
    clearSession()
  })
})

