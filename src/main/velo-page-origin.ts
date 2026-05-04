import type { WebContents } from 'electron'


const lastCommittedUrl = new WeakMap<WebContents, string>()

export function recordTabCommittedUrl(webContents: WebContents, url: string): void {
  if (url.length > 0) lastCommittedUrl.set(webContents, url)
}

export function getLastTabCommittedUrl(webContents: WebContents): string | undefined {
  return lastCommittedUrl.get(webContents)
}
