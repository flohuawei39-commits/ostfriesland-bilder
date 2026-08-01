import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.resolve(process.env.SOURCE_DIR || path.join(root, 'ofrila07'))
const galleryId = 'ofrila07'
const releaseTag = `gallery-${galleryId}`
const releaseDir = path.join(root, '.import', galleryId, 'release')
const thumbnailDir = path.join(root, 'public', 'thumbnails', galleryId)
const manifestPath = path.join(root, 'public', 'data', 'gallery-manifest.json')
const owner = process.env.GITHUB_OWNER || 'flohuawei39-commits'
const repository = process.env.GITHUB_REPO || 'ostfriesland-bilder'
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function u16(bytes, offset) { return (bytes[offset] << 8) | bytes[offset + 1] }

function parseJpeg(bytes, start) {
  let cursor = start + 2
  let width = 0
  let height = 0
  let sawScan = false
  while (cursor < bytes.length - 3) {
    if (bytes[cursor] !== 0xff) return null
    while (bytes[cursor] === 0xff) cursor += 1
    const marker = bytes[cursor++]
    if (marker === 0xd9) return sawScan && width && height ? { start, end: cursor, width, height } : null
    if (marker === 0 || marker === 0xd8 || marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (cursor + 1 >= bytes.length) return null
    const length = u16(bytes, cursor)
    if (length < 2 || cursor + length > bytes.length) return null
    if (SOF.has(marker)) {
      height = u16(bytes, cursor + 3)
      width = u16(bytes, cursor + 5)
      if (width < 160 || height < 160 || width > 20000 || height > 20000) return null
    }
    if (marker === 0xda) {
      sawScan = true
      cursor += length
      while (cursor < bytes.length - 1) {
        if (bytes[cursor] !== 0xff) { cursor += 1; continue }
        const next = bytes[cursor + 1]
        if (next === 0 || (next >= 0xd0 && next <= 0xd7)) { cursor += 2; continue }
        if (next === 0xd9) return width && height ? { start, end: cursor + 2, width, height } : null
        cursor += 1
      }
      return null
    }
    cursor += length
  }
  return null
}

function bestJpeg(buffer) {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const found = []
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] !== 0xff || bytes[index + 1] !== 0xd8) continue
    const value = parseJpeg(bytes, index)
    if (!value) continue
    found.push(value)
    index = value.end - 1
  }
  if (!found.length) throw new Error('Keine eingebettete JPEG-Vorschau gefunden')
  return found.sort((a, b) => b.width * b.height - a.width * a.height || (b.end - b.start) - (a.end - a.start))[0]
}

function urlFor(name) {
  return `https://github.com/${owner}/${repository}/releases/download/${encodeURIComponent(releaseTag)}/${encodeURIComponent(name)}`
}

await fs.access(sourceDir)
await fs.mkdir(releaseDir, { recursive: true })
await fs.mkdir(thumbnailDir, { recursive: true })

const names = (await fs.readdir(sourceDir)).filter((name) => /\.nef$/i.test(name)).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
if (names.length > 450) throw new Error(`Zu viele NEFs: ${names.length}; maximal 450.`)
const images = []

for (let index = 0; index < names.length; index += 1) {
  const originalName = names[index]
  const sourcePath = path.join(sourceDir, originalName)
  const source = await fs.readFile(sourcePath)
  const stats = await fs.stat(sourcePath)
  const candidate = bestJpeg(source)
  const baseName = originalName.replace(/\.[^.]+$/, '')
  const previewName = `${baseName}.preview.jpg`
  const preview = source.subarray(candidate.start, candidate.end)
  const previewPath = path.join(releaseDir, previewName)
  const thumbnailName = `${baseName.toLowerCase()}.webp`
  const thumbnailPath = path.join(thumbnailDir, thumbnailName)
  await fs.writeFile(previewPath, preview)
  await sharp(preview).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(thumbnailPath)
  const timestamp = stats.mtime.toISOString()
  images.push({
    id: baseName.toLowerCase(), originalName, baseName,
    raw: { name: originalName, url: urlFor(originalName), size: stats.size },
    preview: { name: previewName, url: urlFor(previewName), size: preview.length },
    thumbnailPath: `thumbnails/${galleryId}/${thumbnailName}`,
    previewQuality: candidate.width >= 3000 && candidate.height >= 2000 ? 'full' : 'reduced',
    metadata: { width: candidate.width, height: candidate.height, rawBytes: stats.size, previewBytes: preview.length, sourceLastModified: timestamp },
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  if ((index + 1) % 10 === 0 || index === names.length - 1) console.log(`Importiert ${index + 1}/${names.length}: ${originalName} (${candidate.width}x${candidate.height})`)
}

const updatedAt = images.reduce((latest, image) => image.updatedAt > latest ? image.updatedAt : latest, new Date(0).toISOString())
const manifest = {
  schemaVersion: 1,
  siteTitle: 'Ostfriesland Bilder',
  owner,
  repository,
  updatedAt,
  galleries: [{ id: galleryId, title: galleryId, releaseTag, coverImageId: images[0]?.id, createdAt: updatedAt, updatedAt, images }],
}
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Fertig: ${images.length} NEFs, ${images.length} Vorschauen, ${images.length} Thumbnails. ZIP-Dateien wurden ignoriert.`)

