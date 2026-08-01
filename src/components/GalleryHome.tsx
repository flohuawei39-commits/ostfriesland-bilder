import { ArrowUpRight, FolderOpen, ImageIcon } from 'lucide-react'
import { pagesAsset } from '../config'
import type { Gallery } from '../types'

const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })

export function GalleryHome({ galleries, onOpen }: { galleries: Gallery[]; onOpen: (gallery: Gallery) => void }) {
  const sorted = [...galleries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Bildarchiv</p>
        <h1>Alle Aufnahmen.<br /><span>Ein ruhiger Ort.</span></h1>
        <p>Öffne einen Ordner, sieh dir die Bilder in voller Größe an oder lade die Originaldateien herunter.</p>
      </section>

      <section className="section-block" aria-labelledby="folders-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sammlungen</p>
            <h2 id="folders-title">Ordner</h2>
          </div>
          <span className="result-count">{galleries.length} {galleries.length === 1 ? 'Ordner' : 'Ordner'}</span>
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state"><FolderOpen size={30} /><h3>Noch keine Ordner</h3><p>Der Admin kann die erste Galerie im Verwaltungsbereich anlegen.</p></div>
        ) : (
          <div className="folder-grid">
            {sorted.map((gallery) => {
              const cover = gallery.images.find((image) => image.id === gallery.coverImageId) ?? gallery.images[0]
              return (
                <button key={gallery.id} className="folder-card" onClick={() => onOpen(gallery)}>
                  <div className="folder-cover">
                    {cover ? <img src={pagesAsset(cover.thumbnailPath)} alt="" loading="lazy" /> : <ImageIcon size={38} />}
                    <span className="open-badge"><ArrowUpRight size={17} /></span>
                  </div>
                  <div className="folder-copy">
                    <div><h3>{gallery.title}</h3><p>Aktualisiert {formatter.format(new Date(gallery.updatedAt))}</p></div>
                    <span>{gallery.images.length} Bilder</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

