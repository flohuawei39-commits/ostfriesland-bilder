import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import type { GalleryImage } from '../types'

const formatBytes = (bytes: number) => {
  const value = bytes / 1024 / 1024
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

export function Lightbox({ image, onClose, onPrevious, onNext }: {
  image: GalleryImage
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={image.originalName}>
      <div className="lightbox-topbar">
        <div><strong>{image.originalName}</strong><span>{image.metadata.width} × {image.metadata.height} · {image.previewQuality === 'reduced' ? 'reduzierte Vorschau' : 'Vollauflösung'}</span></div>
        <button className="round-button" onClick={onClose} aria-label="Schließen"><X /></button>
      </div>
      <button className="lightbox-nav previous" onClick={onPrevious} aria-label="Vorheriges Bild"><ChevronLeft /></button>
      <div className="lightbox-canvas"><img src={image.preview.url} alt={image.originalName} /></div>
      <button className="lightbox-nav next" onClick={onNext} aria-label="Nächstes Bild"><ChevronRight /></button>
      <div className="lightbox-footer">
        <span>RAW {formatBytes(image.raw.size)} · JPEG {formatBytes(image.preview.size)}</span>
        <div>
          <a className="secondary-button" href={image.preview.url} download={`${image.baseName}.jpg`}><Download size={16} /> JPEG</a>
          <a className="primary-button compact" href={image.raw.url} download={image.originalName}><Download size={16} /> RAW</a>
        </div>
      </div>
    </div>
  )
}

