import type { BrowserChromeTheme } from './ipc.js'


export function shellContentBackgroundHex(theme: BrowserChromeTheme): string {
  switch (theme) {
    case 'white':
      return '#f4f4f8'
    case 'black':
      return '#0a0a0a'
    case 'grey':
      return '#3a3a42'
    default:
      return '#121218'
  }
}
