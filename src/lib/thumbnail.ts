export async function createThumbnail(jpeg: Blob, maxSize = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(jpeg)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Thumbnail-Canvas konnte nicht erstellt werden.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const asBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  return (await asBlob('image/webp', 0.82)) ?? (await asBlob('image/jpeg', 0.84)) ?? jpeg
}

