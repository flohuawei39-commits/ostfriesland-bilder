export type Role = 'admin' | 'viewer'

export interface Session {
  role: Role
  username: string
  expiresAt: number
}

export interface AssetRef {
  id?: number
  name: string
  url: string
  size: number
  digest?: string
}

export interface ImageMetadata {
  capturedAt?: string
  camera?: string
  width: number
  height: number
  rawBytes: number
  previewBytes: number
  sourceLastModified?: string
  [key: string]: string | number | boolean | undefined
}

export interface GalleryImage {
  id: string
  originalName: string
  baseName: string
  raw: AssetRef
  preview: AssetRef
  thumbnailPath: string
  previewQuality: 'full' | 'reduced'
  metadata: ImageMetadata
  createdAt: string
  updatedAt: string
}

export interface Gallery {
  id: string
  title: string
  releaseId?: number
  releaseTag: string
  coverImageId?: string
  createdAt: string
  updatedAt: string
  images: GalleryImage[]
}

export interface GalleryManifest {
  schemaVersion: 1
  siteTitle: string
  owner: string
  repository: string
  updatedAt: string
  galleries: Gallery[]
}

export interface UploadProgress {
  id: string
  fileName: string
  stage: 'queued' | 'extracting' | 'uploading-raw' | 'uploading-preview' | 'committing' | 'done' | 'error'
  percent: number
  message?: string
}

