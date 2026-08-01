export const APP_CONFIG = {
  owner: 'flohuawei39-commits',
  repository: 'ostfriesland-bilder',
  defaultBranch: 'main',
  siteTitle: 'Ostfriesland Bilder',
  manifestPath: 'public/data/gallery-manifest.json',
  maxImagesPerGallery: 450,
  sessionDays: 30,
} as const

export const pagesAsset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

