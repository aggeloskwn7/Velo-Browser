import Papa from 'papaparse'
import type { PasswordVaultEntryDto } from '../shared/ipc.js'

function normalizeHostFromUrl(urlRaw: string): string | null {
  const t = urlRaw.trim()
  if (!t) return null
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`
    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export type CsvImportRow = { domain: string; username: string; password: string }


export function parsePasswordCsv(fileContents: string): CsvImportRow[] {
  const csvData = Papa.parse<Record<string, string>>(fileContents, {
    header: true,
    skipEmptyLines: true,
    transformHeader(header) {
      return header.toLowerCase().trim().replace(/["']/g, '')
    }
  })
  const out: CsvImportRow[] = []
  for (const row of csvData.data) {
    const url = row.url || row['login url'] || row['login_url'] || row['loginurl'] || ''
    const username = row.username || row.user || row.login || ''
    const password = row.password || row.pass || ''
    const host = normalizeHostFromUrl(url)
    if (!host || !username) continue
    out.push({ domain: host, username, password })
  }
  return out
}


export function formatPasswordCsv(entries: PasswordVaultEntryDto[]): string {
  return Papa.unparse({
    fields: ['name', 'url', 'username', 'password'],
    data: entries.map((e) => [
      e.domain,
      `https://${e.domain}`,
      e.username,
      e.password
    ])
  })
}
