import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.resolve(process.env.SOURCE_DIR || path.join(root, 'ofrila07'))
const previewDir = path.join(root, '.import', 'ofrila07', 'release')
const owner = process.env.GITHUB_OWNER || 'flohuawei39-commits'
const repository = process.env.GITHUB_REPO || 'ostfriesland-bilder'
const repo = `${owner}/${repository}`
const tag = 'gallery-ofrila07'

function gh(args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
    let stdout = ''
    let stderr = ''
    if (capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })
    }
    child.on('exit', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `gh endete mit ${code}`)))
  })
}

await fs.access(previewDir)
try { await gh(['release', 'view', tag, '--repo', repo], true) }
catch { await gh(['release', 'create', tag, '--repo', repo, '--title', 'ofrila07', '--notes', 'Originale und Vorschauen für die Galerie ofrila07.']) }

const releaseJson = JSON.parse(await gh(['api', `repos/${repo}/releases/tags/${tag}`], true))
const remote = new Map(releaseJson.assets.map((asset) => [asset.name.toLowerCase(), asset.size]))
const rawNames = (await fs.readdir(sourceDir)).filter((name) => /\.nef$/i.test(name))
const previewNames = (await fs.readdir(previewDir)).filter((name) => /\.preview\.jpg$/i.test(name))
const files = [...rawNames.map((name) => path.join(sourceDir, name)), ...previewNames.map((name) => path.join(previewDir, name))]
const pending = []
for (const file of files) {
  const stat = await fs.stat(file)
  if (remote.get(path.basename(file).toLowerCase()) === stat.size) continue
  pending.push(file)
}
console.log(`${files.length - pending.length}/${files.length} Assets bereits vorhanden; ${pending.length} werden hochgeladen.`)

let cursor = 0
let done = files.length - pending.length
async function worker() {
  while (cursor < pending.length) {
    const file = pending[cursor++]
    await gh(['release', 'upload', tag, file, '--repo', repo, '--clobber'])
    done += 1
    console.log(`Release ${done}/${files.length}: ${path.basename(file)}`)
  }
}
await Promise.all([worker(), worker()])
console.log(`Release ${tag} vollständig: ${files.length} Assets.`)
