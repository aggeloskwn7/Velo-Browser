import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function readVeloLogoPng(): Buffer | null {
  const name = 'Velo.png'
  const candidates = [
    join(process.cwd(), 'public', name),
    join(__dirname, '../../renderer', name),
    join(app.getAppPath(), 'out', 'renderer', name),
    join(app.getAppPath(), 'renderer', name),
    join(app.getAppPath(), 'public', name)
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try {
      return readFileSync(p)
    } catch {}
  }
  return null
}
