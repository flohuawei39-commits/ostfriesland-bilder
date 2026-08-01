import { describe, expect, it } from 'vitest'
import { extractBestEmbeddedJpeg, findEmbeddedJpegs, qualityFor } from './nef'

function fakeJpeg(width: number, height: number) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x22, 0x33, 0xff, 0x00, 0x44,
    0xff, 0xd9,
  ])
}

describe('NEF JPEG extraction', () => {
  it('finds embedded JPEGs and chooses the largest dimensions', () => {
    const small = fakeJpeg(640, 424)
    const large = fakeJpeg(6000, 4000)
    const container = new Uint8Array(32 + small.length + 17 + large.length)
    container.set(small, 32)
    container.set(large, 32 + small.length + 17)
    expect(findEmbeddedJpegs(container)).toHaveLength(2)
    const best = extractBestEmbeddedJpeg(container)
    expect([best.width, best.height]).toEqual([6000, 4000])
    expect(qualityFor(best)).toBe('full')
  })

  it('marks small previews as reduced and rejects missing previews', () => {
    expect(qualityFor({ width: 1620, height: 1080 })).toBe('reduced')
    expect(() => extractBestEmbeddedJpeg(new Uint8Array([1, 2, 3]))).toThrow(/Keine eingebettete/)
  })
})
