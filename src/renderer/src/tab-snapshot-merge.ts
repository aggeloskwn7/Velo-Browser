import type { TabSnapshot } from '../../shared/ipc'

function tabFieldsEqual(a: TabSnapshot, b: TabSnapshot): boolean {
  const splitEqual =
    a.split === b.split ||
    (a.split != null &&
      b.split != null &&
      a.split.ratio === b.split.ratio &&
      a.split.focusedPane === b.split.focusedPane &&
      a.split.left.tabId === b.split.left.tabId &&
      a.split.left.url === b.split.left.url &&
      a.split.left.title === b.split.left.title &&
      a.split.right.tabId === b.split.right.tabId &&
      a.split.right.url === b.split.right.url &&
      a.split.right.title === b.split.right.title)

  return (
    a.id === b.id &&
    a.url === b.url &&
    a.title === b.title &&
    a.favicon === b.favicon &&
    a.isLoading === b.isLoading &&
    a.canGoBack === b.canGoBack &&
    a.canGoForward === b.canGoForward &&
    a.isResting === b.isResting &&
    a.pinned === b.pinned &&
    a.muted === b.muted &&
    splitEqual
  )
}

export function mergeTabSnapshots(prev: TabSnapshot[], next: TabSnapshot[]): TabSnapshot[] {
  if (prev.length !== next.length) return next
  const prevById = new Map(prev.map((t) => [t.id, t]))
  let changed = false
  const merged: TabSnapshot[] = []
  for (const n of next) {
    const p = prevById.get(n.id)
    if (p && tabFieldsEqual(p, n)) {
      merged.push(p)
    } else {
      merged.push(n)
      changed = true
    }
  }
  if (!changed && merged.every((t, i) => t === prev[i])) return prev
  return merged
}
