import { APP_CONFIG } from '../config'
import type { GalleryManifest } from '../types'

const API = 'https://api.github.com'

interface GitHubReleaseAsset {
  id: number
  name: string
  size: number
  browser_download_url: string
  digest?: string
}

export interface GitHubRelease {
  id: number
  tag_name: string
  upload_url: string
  assets: GitHubReleaseAsset[]
}

async function request<T>(token: string, url: string, init: RequestInit = {}, allow404 = false): Promise<T | null> {
  const response = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...init.headers,
    },
  })
  if (allow404 && response.status === 404) return null
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GitHub ${response.status}: ${detail.slice(0, 500)}`)
  }
  if (response.status === 204) return null
  return (await response.json()) as T
}

export async function validateToken(token: string) {
  const repository = await request<{ full_name: string; permissions?: { push?: boolean } }>(
    token,
    `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}`,
  )
  if (!repository?.permissions?.push) throw new Error('Token hat keinen Schreibzugriff auf dieses Repository.')
  return repository
}

export async function getRelease(token: string, tag: string) {
  return request<GitHubRelease>(
    token,
    `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/releases/tags/${encodeURIComponent(tag)}`,
    {},
    true,
  )
}

export async function ensureRelease(token: string, tag: string, title: string) {
  const existing = await getRelease(token, tag)
  if (existing) return existing
  return request<GitHubRelease>(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: APP_CONFIG.defaultBranch,
      name: title,
      body: 'Bilddateien für Ostfriesland Bilder.',
      draft: false,
      prerelease: false,
    }),
  }) as Promise<GitHubRelease>
}

export async function deleteReleaseAsset(token: string, assetId: number) {
  await request(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/releases/assets/${assetId}`, {
    method: 'DELETE',
  })
}

export async function uploadReleaseAsset(token: string, release: GitHubRelease, name: string, body: Blob) {
  const fresh = (await getRelease(token, release.tag_name)) ?? release
  const duplicate = fresh.assets.find((asset) => asset.name.toLowerCase() === name.toLowerCase())
  if (duplicate) await deleteReleaseAsset(token, duplicate.id)
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(name)}`)
  return request<GitHubReleaseAsset>(token, uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': body.type || 'application/octet-stream' },
    body,
  }) as Promise<GitHubReleaseAsset>
}

export async function deleteGalleryRelease(token: string, release: GitHubRelease) {
  await request(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/releases/${release.id}`, {
    method: 'DELETE',
  })
  await request(
    token,
    `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/refs/tags/${encodeURIComponent(release.tag_name)}`,
    { method: 'DELETE' },
    true,
  )
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

export interface RepositoryChange {
  path: string
  content?: Uint8Array
  delete?: boolean
}

export async function commitRepositoryChanges(token: string, changes: RepositoryChange[], message: string) {
  const ref = await request<{ object: { sha: string } }>(
    token,
    `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/ref/heads/${APP_CONFIG.defaultBranch}`,
  )
  if (!ref) throw new Error('Main-Branch wurde nicht gefunden.')
  const commit = await request<{ tree: { sha: string } }>(
    token,
    `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/commits/${ref.object.sha}`,
  )
  if (!commit) throw new Error('Aktueller Commit wurde nicht gefunden.')

  const treeEntries = []
  for (const change of changes) {
    if (change.delete) {
      treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null })
      continue
    }
    if (!change.content) throw new Error(`Inhalt für ${change.path} fehlt.`)
    const blob = await request<{ sha: string }>(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: bytesToBase64(change.content), encoding: 'base64' }),
    })
    treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: blob?.sha })
  }

  const tree = await request<{ sha: string }>(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: commit.tree.sha, tree: treeEntries }),
  })
  const nextCommit = await request<{ sha: string }>(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree?.sha, parents: [ref.object.sha] }),
  })
  await request(token, `/repos/${APP_CONFIG.owner}/${APP_CONFIG.repository}/git/refs/heads/${APP_CONFIG.defaultBranch}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: nextCommit?.sha, force: false }),
  })
  return nextCommit?.sha
}

export function manifestChange(manifest: GalleryManifest): RepositoryChange {
  return {
    path: APP_CONFIG.manifestPath,
    content: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
  }
}

export function releaseDownloadUrl(tag: string, name: string) {
  return `https://github.com/${APP_CONFIG.owner}/${APP_CONFIG.repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
}

