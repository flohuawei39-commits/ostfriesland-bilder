export interface JpegCandidate {
  start: number
  end: number
  width: number
  height: number
  bytes: Uint8Array
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function parseJpeg(bytes: Uint8Array, start: number): JpegCandidate | null {
  let cursor = start + 2
  let width = 0
  let height = 0

  while (cursor < bytes.length - 3) {
    if (bytes[cursor] !== 0xff) return null
    while (bytes[cursor] === 0xff) cursor += 1
    const marker = bytes[cursor]
    cursor += 1

    if (marker === 0xd9) {
      return null
    }
    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (cursor + 1 >= bytes.length) return null

    const segmentLength = readUint16(bytes, cursor)
    if (segmentLength < 2 || cursor + segmentLength > bytes.length) return null

    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return null
      height = readUint16(bytes, cursor + 3)
      width = readUint16(bytes, cursor + 5)
      if (width < 160 || height < 160 || width > 20_000 || height > 20_000) return null
    }

    if (marker === 0xda) {
      cursor += segmentLength
      while (cursor < bytes.length - 1) {
        if (bytes[cursor] !== 0xff) {
          cursor += 1
          continue
        }
        const next = bytes[cursor + 1]
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          cursor += 2
          continue
        }
        if (next === 0xd9) {
          const end = cursor + 2
          if (!width || !height) return null
          return { start, end, width, height, bytes: bytes.slice(start, end) }
        }
        cursor += 1
      }
      return null
    }

    cursor += segmentLength
  }
  return null
}

export function findEmbeddedJpegs(input: ArrayBuffer | Uint8Array): JpegCandidate[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const candidates: JpegCandidate[] = []
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] !== 0xff || bytes[index + 1] !== 0xd8) continue
    const candidate = parseJpeg(bytes, index)
    if (!candidate) continue
    candidates.push(candidate)
    index = candidate.end - 1
  }
  return candidates
}

export function extractBestEmbeddedJpeg(input: ArrayBuffer | Uint8Array): JpegCandidate {
  const candidates = findEmbeddedJpegs(input)
  if (!candidates.length) throw new Error('Keine eingebettete JPEG-Vorschau gefunden.')
  return candidates.sort((a, b) => b.width * b.height - a.width * a.height || b.bytes.length - a.bytes.length)[0]
}

export function qualityFor(candidate: Pick<JpegCandidate, 'width' | 'height'>) {
  return candidate.width >= 3000 && candidate.height >= 2000 ? 'full' : 'reduced'
}
