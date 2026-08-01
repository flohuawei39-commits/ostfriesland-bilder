import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckCircle2, ImagePlus, KeyRound, LoaderCircle, Pencil, Plus, Star, Trash2, Upload, XCircle } from 'lucide-react'
import { APP_CONFIG } from '../config'
import type { Gallery, GalleryImage, GalleryManifest, UploadProgress } from '../types'
import { extractBestEmbeddedJpeg, qualityFor } from '../lib/nef'
import { createThumbnail } from '../lib/thumbnail'
import {
  commitRepositoryChanges,
  deleteGalleryRelease,
  deleteReleaseAsset,
  ensureRelease,
  getRelease,
  manifestChange,
  releaseDownloadUrl,
  uploadReleaseAsset,
  validateToken,
  type RepositoryChange,
} from '../lib/github'

const now = () => new Date().toISOString()
const baseNameOf = (name: string) => name.replace(/\.[^.]+$/, '')
const stableId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cloneManifest = (manifest: GalleryManifest): GalleryManifest => structuredClone(manifest)

function stageText(progress: UploadProgress) {
  const labels: Record<UploadProgress['stage'], string> = {
    queued: 'Wartet', extracting: 'Vorschau wird gelesen', 'uploading-raw': 'Original wird geladen',
    'uploading-preview': 'Vorschau wird geladen', committing: 'Wird veröffentlicht', done: 'Fertig', error: 'Fehler',
  }
  return progress.message || labels[progress.stage]
}

export function AdminPanel({ manifest, onManifest }: { manifest: GalleryManifest; onManifest: (manifest: GalleryManifest) => void }) {
  const [token, setToken] = useState('')
  const [tokenReady, setTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [uploadGalleryId, setUploadGalleryId] = useState(manifest.galleries[0]?.id ?? '')
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadGallery = useMemo(() => manifest.galleries.find((gallery) => gallery.id === uploadGalleryId), [manifest, uploadGalleryId])

  async function connectToken(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setTokenError('')
    try {
      await validateToken(token.trim())
      setTokenReady(true)
    } catch (error) {
      setTokenReady(false)
      setTokenError(error instanceof Error ? error.message : 'Token konnte nicht geprüft werden.')
    } finally {
      setBusy(false)
    }
  }

  async function createGallery(event: FormEvent) {
    event.preventDefault()
    if (!tokenReady || !newTitle.trim()) return
    setBusy(true)
    try {
      const id = `${stableId(newTitle) || 'galerie'}-${crypto.randomUUID().slice(0, 8)}`
      const releaseTag = `gallery-${id}`
      const release = await ensureRelease(token, releaseTag, newTitle.trim())
      const next = cloneManifest(manifest)
      next.galleries.unshift({ id, title: newTitle.trim(), releaseId: release.id, releaseTag, createdAt: now(), updatedAt: now(), images: [] })
      next.updatedAt = now()
      await commitRepositoryChanges(token, [manifestChange(next)], `Galerie ${newTitle.trim()} anlegen`)
      onManifest(next)
      setUploadGalleryId(id)
      setNewTitle('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Galerie konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function renameGallery(gallery: Gallery) {
    const title = prompt('Neuer Ordnername', gallery.title)?.trim()
    if (!title || title === gallery.title) return
    const next = cloneManifest(manifest)
    const target = next.galleries.find((item) => item.id === gallery.id)!
    target.title = title
    target.updatedAt = now()
    next.updatedAt = now()
    setBusy(true)
    try {
      await commitRepositoryChanges(token, [manifestChange(next)], `Galerie in ${title} umbenennen`)
      onManifest(next)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen.')
    } finally { setBusy(false) }
  }

  async function removeGallery(gallery: Gallery) {
    if (!confirm(`„${gallery.title}“ und alle ${gallery.images.length} Bilder endgültig löschen?`)) return
    setBusy(true)
    try {
      const next = cloneManifest(manifest)
      next.galleries = next.galleries.filter((item) => item.id !== gallery.id)
      next.updatedAt = now()
      const changes: RepositoryChange[] = [manifestChange(next), ...gallery.images.map((image) => ({ path: `public/${image.thumbnailPath}`, delete: true }))]
      await commitRepositoryChanges(token, changes, `Galerie ${gallery.title} ausblenden und löschen`)
      const release = await getRelease(token, gallery.releaseTag)
      if (release) await deleteGalleryRelease(token, release)
      onManifest(next)
      if (uploadGalleryId === gallery.id) setUploadGalleryId(next.galleries[0]?.id ?? '')
    } catch (error) {
      alert(`Löschen nicht vollständig: ${error instanceof Error ? error.message : String(error)}. Bitte erneut versuchen.`)
    } finally { setBusy(false) }
  }

  async function setCover(gallery: Gallery, image: GalleryImage) {
    const next = cloneManifest(manifest)
    const target = next.galleries.find((item) => item.id === gallery.id)!
    target.coverImageId = image.id
    target.updatedAt = now()
    next.updatedAt = now()
    setBusy(true)
    try {
      await commitRepositoryChanges(token, [manifestChange(next)], `Cover für ${gallery.title} ändern`)
      onManifest(next)
    } catch (error) { alert(error instanceof Error ? error.message : 'Cover konnte nicht geändert werden.') }
    finally { setBusy(false) }
  }

  async function removeImage(gallery: Gallery, image: GalleryImage) {
    if (!confirm(`${image.originalName} endgültig löschen?`)) return
    setBusy(true)
    try {
      const next = cloneManifest(manifest)
      const target = next.galleries.find((item) => item.id === gallery.id)!
      target.images = target.images.filter((item) => item.id !== image.id)
      if (target.coverImageId === image.id) target.coverImageId = target.images[0]?.id
      target.updatedAt = now()
      next.updatedAt = now()
      await commitRepositoryChanges(token, [manifestChange(next), { path: `public/${image.thumbnailPath}`, delete: true }], `Bild ${image.originalName} löschen`)
      const release = await getRelease(token, gallery.releaseTag)
      if (release) {
        const names = new Set([image.raw.name.toLowerCase(), image.preview.name.toLowerCase()])
        for (const asset of release.assets.filter((item) => names.has(item.name.toLowerCase()))) await deleteReleaseAsset(token, asset.id)
      }
      onManifest(next)
    } catch (error) {
      alert(`Löschen nicht vollständig: ${error instanceof Error ? error.message : String(error)}. Bitte erneut versuchen.`)
    } finally { setBusy(false) }
  }

  function updateProgress(id: string, patch: Partial<UploadProgress>) {
    setProgress((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].filter((file) => /\.nef$/i.test(file.name))
    event.target.value = ''
    if (!uploadGallery || !files.length || !tokenReady) return
    const existingNames = new Set(uploadGallery.images.map((image) => image.originalName.toLowerCase()))
    const uniqueIncoming = new Set(files.map((file) => file.name.toLowerCase()))
    const projected = uploadGallery.images.length - [...uniqueIncoming].filter((name) => existingNames.has(name)).length + uniqueIncoming.size
    if (projected > APP_CONFIG.maxImagesPerGallery) {
      alert(`Der Ordner würde ${projected} Bilder enthalten. Erlaubt sind maximal ${APP_CONFIG.maxImagesPerGallery}.`)
      return
    }

    const items = files.map((file) => ({ id: crypto.randomUUID(), file }))
    setProgress(items.map(({ id, file }) => ({ id, fileName: file.name, stage: 'queued', percent: 0 })))
    setBusy(true)
    try {
      const release = await ensureRelease(token, uploadGallery.releaseTag, uploadGallery.title)
      const next = cloneManifest(manifest)
      const target = next.galleries.find((gallery) => gallery.id === uploadGallery.id)!
      target.releaseId = release.id
      const thumbnailChanges: RepositoryChange[] = []

      for (const { id: progressId, file } of items) {
        try {
          updateProgress(progressId, { stage: 'extracting', percent: 10 })
          const candidate = extractBestEmbeddedJpeg(await file.arrayBuffer())
          const previewBlob = new Blob([Uint8Array.from(candidate.bytes).buffer], { type: 'image/jpeg' })
          const thumbnailBlob = await createThumbnail(previewBlob)
          const baseName = baseNameOf(file.name)
          const existing = target.images.find((image) => image.originalName.toLowerCase() === file.name.toLowerCase())
          const imageId = existing?.id ?? `${stableId(baseName)}-${crypto.randomUUID().slice(0, 6)}`
          const previewName = `${baseName}.preview.jpg`
          updateProgress(progressId, { stage: 'uploading-raw', percent: 35 })
          const [rawAsset, previewAsset] = await Promise.all([
            uploadReleaseAsset(token, release, file.name, file),
            uploadReleaseAsset(token, release, previewName, previewBlob),
          ])
          updateProgress(progressId, { stage: 'uploading-preview', percent: 75 })
          const thumbnailPath = `thumbnails/${target.id}/${imageId}.webp`
          thumbnailChanges.push({ path: `public/${thumbnailPath}`, content: new Uint8Array(await thumbnailBlob.arrayBuffer()) })
          const timestamp = now()
          const image: GalleryImage = {
            id: imageId,
            originalName: file.name,
            baseName,
            raw: { id: rawAsset.id, name: rawAsset.name, url: rawAsset.browser_download_url || releaseDownloadUrl(target.releaseTag, file.name), size: rawAsset.size, digest: rawAsset.digest },
            preview: { id: previewAsset.id, name: previewAsset.name, url: previewAsset.browser_download_url || releaseDownloadUrl(target.releaseTag, previewName), size: previewAsset.size, digest: previewAsset.digest },
            thumbnailPath,
            previewQuality: qualityFor(candidate),
            metadata: { width: candidate.width, height: candidate.height, rawBytes: file.size, previewBytes: previewBlob.size, sourceLastModified: new Date(file.lastModified).toISOString() },
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          }
          target.images = [...target.images.filter((item) => item.id !== imageId && item.originalName.toLowerCase() !== file.name.toLowerCase()), image]
          if (!target.coverImageId) target.coverImageId = image.id
          updateProgress(progressId, { stage: 'committing', percent: 90 })
        } catch (error) {
          updateProgress(progressId, { stage: 'error', percent: 0, message: error instanceof Error ? error.message : String(error) })
        }
      }

      target.images.sort((a, b) => a.originalName.localeCompare(b.originalName, 'de', { numeric: true }))
      target.updatedAt = now()
      next.updatedAt = now()
      if (thumbnailChanges.length) {
        await commitRepositoryChanges(token, [...thumbnailChanges, manifestChange(next)], `${thumbnailChanges.length} Bilder in ${target.title} veröffentlichen`)
        onManifest(next)
        setProgress((current) => current.map((item) => item.stage === 'committing' ? { ...item, stage: 'done', percent: 100 } : item))
      }
    } finally { setBusy(false) }
  }

  return (
    <aside className="admin-panel" aria-label="Galerieverwaltung">
      <div className="admin-heading"><div><p className="eyebrow">Admin</p><h2>Verwalten</h2></div><span>{tokenReady ? <><CheckCircle2 size={15} /> Verbunden</> : 'Token erforderlich'}</span></div>
      <section className="admin-section">
        <h3><KeyRound size={17} /> GitHub-Verbindung</h3>
        <p>Fine-grained Token für nur dieses Repository, Berechtigung „Contents: Read and write“. Er bleibt nur bis zum Schließen dieser Seite im Speicher.</p>
        <form className="token-form" onSubmit={connectToken}><input type="password" value={token} onChange={(event) => { setToken(event.target.value); setTokenReady(false) }} placeholder="github_pat_…" autoComplete="off" /><button className="secondary-button" disabled={busy || !token}>Prüfen</button></form>
        {tokenError && <p className="form-error">{tokenError}</p>}
      </section>

      <section className="admin-section disabled-wrap" aria-disabled={!tokenReady}>
        <h3><Plus size={17} /> Ordner anlegen</h3>
        <form className="token-form" onSubmit={createGallery}><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Name des neuen Ordners" disabled={!tokenReady} /><button className="primary-button compact" disabled={!tokenReady || busy || !newTitle.trim()}>Anlegen</button></form>
      </section>

      <section className="admin-section disabled-wrap" aria-disabled={!tokenReady}>
        <h3><Upload size={17} /> RAW-Dateien hochladen</h3>
        <div className="upload-row"><select value={uploadGalleryId} onChange={(event) => setUploadGalleryId(event.target.value)} disabled={!tokenReady}>{manifest.galleries.map((gallery) => <option key={gallery.id} value={gallery.id}>{gallery.title} ({gallery.images.length}/{APP_CONFIG.maxImagesPerGallery})</option>)}</select><button className="primary-button compact" onClick={() => fileInput.current?.click()} disabled={!tokenReady || busy || !uploadGallery}><ImagePlus size={16} /> NEFs wählen</button><input ref={fileInput} hidden type="file" multiple accept=".nef,image/x-nikon-nef" onChange={uploadFiles} /></div>
        {progress.length > 0 && <div className="upload-list">{progress.map((item) => <div key={item.id} className={`upload-item ${item.stage}`}><span>{item.stage === 'done' ? <CheckCircle2 size={16} /> : item.stage === 'error' ? <XCircle size={16} /> : <LoaderCircle className={busy ? 'spin' : ''} size={16} />}</span><div><strong>{item.fileName}</strong><small>{stageText(item)}</small><i style={{ width: `${item.percent}%` }} /></div></div>)}</div>}
      </section>

      <section className="admin-section disabled-wrap" aria-disabled={!tokenReady}>
        <h3>Ordner und Bilder</h3>
        <div className="manage-list">{manifest.galleries.map((gallery) => <details key={gallery.id}><summary><span>{gallery.title}<small>{gallery.images.length} Bilder</small></span><span className="summary-actions"><button aria-label="Umbenennen" disabled={!tokenReady || busy} onClick={(event) => { event.preventDefault(); renameGallery(gallery) }}><Pencil size={15} /></button><button className="danger" aria-label="Ordner löschen" disabled={!tokenReady || busy} onClick={(event) => { event.preventDefault(); removeGallery(gallery) }}><Trash2 size={15} /></button></span></summary><div className="manage-images">{gallery.images.map((image) => <div key={image.id}><span>{image.originalName}</span><span><button className={gallery.coverImageId === image.id ? 'active' : ''} title="Als Cover" disabled={!tokenReady || busy} onClick={() => setCover(gallery, image)}><Star size={14} /></button><button className="danger" title="Endgültig löschen" disabled={!tokenReady || busy} onClick={() => removeImage(gallery, image)}><Trash2 size={14} /></button></span></div>)}</div></details>)}</div>
      </section>
    </aside>
  )
}
