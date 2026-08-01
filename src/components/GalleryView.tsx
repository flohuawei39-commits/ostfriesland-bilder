import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Download, Search, SlidersHorizontal } from 'lucide-react'
import { pagesAsset } from '../config'
import type { Gallery, GalleryImage } from '../types'
import { Lightbox } from './Lightbox'

export function GalleryView({ gallery, onBack }: { gallery: Gallery; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [quality, setQuality] = useState<'all' | 'full' | 'reduced'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<GalleryImage | null>(null)

  const images = useMemo(() => gallery.images
    .filter((image) => image.originalName.toLowerCase().includes(query.toLowerCase()))
    .filter((image) => quality === 'all' || image.previewQuality === quality)
    .sort((a, b) => a.originalName.localeCompare(b.originalName, 'de', { numeric: true })), [gallery.images, query, quality])

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  async function downloadSelected() {
    const chosen = gallery.images.filter((image) => selected.has(image.id))
    for (const image of chosen) {
      const anchor = document.createElement('a')
      anchor.href = image.raw.url
      anchor.download = image.originalName
      anchor.target = '_blank'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      await new Promise((resolve) => setTimeout(resolve, 450))
    }
  }

  const activeIndex = active ? images.findIndex((image) => image.id === active.id) : -1
  return (
    <main className="page-shell gallery-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Alle Ordner</button>
      <section className="gallery-heading">
        <div><p className="eyebrow">Galerie</p><h1>{gallery.title}</h1><p>{gallery.images.length} Aufnahmen</p></div>
        {selected.size > 0 && <button className="primary-button compact" onClick={downloadSelected}><Download size={16} /> {selected.size} RAW laden</button>}
      </section>
      <div className="gallery-tools">
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dateiname suchen…" /></label>
        <label className="filter-field"><SlidersHorizontal size={17} /><select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}><option value="all">Alle Vorschauen</option><option value="full">Vollauflösung</option><option value="reduced">Reduziert</option></select></label>
      </div>
      {images.length === 0 ? <div className="empty-state"><Search size={28} /><h3>Keine Treffer</h3><p>Ändere Suche oder Filter.</p></div> : (
        <div className="image-grid">
          {images.map((image) => (
            <article className={selected.has(image.id) ? 'image-card selected' : 'image-card'} key={image.id}>
              <button className="image-open" onClick={() => setActive(image)}>
                <img src={pagesAsset(image.thumbnailPath)} alt={image.originalName} loading="lazy" />
                {image.previewQuality === 'reduced' && <span className="quality-badge">reduziert</span>}
              </button>
              <div className="image-card-footer"><div><strong>{image.originalName}</strong><span>{image.metadata.width} × {image.metadata.height}</span></div><button className="select-button" onClick={() => toggle(image.id)} aria-label="Bild auswählen">{selected.has(image.id) && <Check size={15} />}</button></div>
            </article>
          ))}
        </div>
      )}
      {active && <Lightbox image={active} onClose={() => setActive(null)} onPrevious={() => setActive(images[(activeIndex - 1 + images.length) % images.length])} onNext={() => setActive(images[(activeIndex + 1) % images.length])} />}
    </main>
  )
}

