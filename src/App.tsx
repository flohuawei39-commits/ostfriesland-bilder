import { useEffect, useState } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { APP_CONFIG, pagesAsset } from './config'
import type { Gallery, GalleryManifest, Session } from './types'
import { clearSession, loadSession } from './lib/auth'
import { LoginScreen } from './components/LoginScreen'
import { Header } from './components/Header'
import { GalleryHome } from './components/GalleryHome'
import { GalleryView } from './components/GalleryView'
import { AdminPanel } from './components/AdminPanel'

const EMPTY_MANIFEST: GalleryManifest = {
  schemaVersion: 1,
  siteTitle: APP_CONFIG.siteTitle,
  owner: APP_CONFIG.owner,
  repository: APP_CONFIG.repository,
  updatedAt: new Date(0).toISOString(),
  galleries: [],
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [manifest, setManifest] = useState<GalleryManifest>(EMPTY_MANIFEST)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeGalleryId, setActiveGalleryId] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch(`${pagesAsset('data/gallery-manifest.json')}?v=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest konnte nicht geladen werden (${response.status}).`)
        return response.json() as Promise<GalleryManifest>
      })
      .then((value) => { if (!cancelled) setManifest(value) })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [session])

  if (!session) return <LoginScreen onLogin={(value) => { setLoading(true); setLoadError(''); setSession(value) }} />

  const activeGallery: Gallery | undefined = manifest.galleries.find((gallery) => gallery.id === activeGalleryId)
  const logout = () => { clearSession(); setSession(null); setAdminOpen(false); setActiveGalleryId(null) }

  return (
    <div className="app-shell">
      <Header session={session} adminOpen={adminOpen} onAdminToggle={() => setAdminOpen((value) => !value)} onHome={() => { setActiveGalleryId(null); setAdminOpen(false) }} onLogout={logout} />
      <div className={adminOpen ? 'content-with-admin open' : 'content-with-admin'}>
        <div className="main-content">
          <div className="public-banner"><AlertTriangle size={15} /><span>Die Anmeldung ist nur eine Sichtschranke. Direkte GitHub-Dateilinks sind öffentlich.</span></div>
          {loading ? <div className="loading-state"><LoaderCircle className="spin" /><span>Galerien werden geladen…</span></div> : loadError ? <div className="empty-state"><AlertTriangle /><h3>Galerie nicht verfügbar</h3><p>{loadError}</p></div> : activeGallery ? <GalleryView gallery={activeGallery} onBack={() => setActiveGalleryId(null)} /> : <GalleryHome galleries={manifest.galleries} onOpen={(gallery) => setActiveGalleryId(gallery.id)} />}
        </div>
        {adminOpen && session.role === 'admin' && <AdminPanel manifest={manifest} onManifest={setManifest} />}
      </div>
      <footer><span>Ostfriesland Bilder</span><span>Privates Archiv · Gehostet auf GitHub</span></footer>
    </div>
  )
}
