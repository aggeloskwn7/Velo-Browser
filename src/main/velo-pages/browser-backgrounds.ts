import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])


export function isSafeBackgroundBasename(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,240}$/.test(name) && !name.includes('..')
}

function browserBackgroundDirs(): string[] {
  return [
    join(process.cwd(), 'browser-backgrounds'),
    join(__dirname, '../../../browser-backgrounds'),
    join(app.getAppPath(), 'browser-backgrounds')
  ]
}

export function listBrowserBackgroundBasenames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const dir of browserBackgroundDirs()) {
    if (!existsSync(dir)) continue
    try {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (!ent.isFile()) continue
        const lower = ent.name.toLowerCase()
        const dot = lower.lastIndexOf('.')
        if (dot === -1) continue
        const ext = lower.slice(dot)
        if (!IMAGE_EXT.has(ext)) continue
        if (!isSafeBackgroundBasename(ent.name)) continue
        if (seen.has(ent.name)) continue
        seen.add(ent.name)
        out.push(ent.name)
      }
    } catch {}
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return out
}

export function readBrowserBackgroundFile(basename: string): { buf: Buffer; mime: string } | null {
  if (!isSafeBackgroundBasename(basename)) return null
  const lower = basename.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot === -1 ? '' : lower.slice(dot)
  if (!IMAGE_EXT.has(ext)) return null

  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.avif'
              ? 'image/avif'
              : 'application/octet-stream'

  for (const dir of browserBackgroundDirs()) {
    const full = join(dir, basename)
    if (!existsSync(full)) continue
    try {
      const buf = readFileSync(full)
      return { buf, mime }
    } catch {}
  }
  return null
}
