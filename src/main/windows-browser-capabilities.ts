import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import { VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME } from '../shared/constants.js'

const execFile = promisify(execFileCb)

const URL_PROGID = 'VeloBrowserHTML'
const START_MENU_INTERNET_CLIENT = 'Velo'
const CAPABILITIES_REG_VALUE = 'Software\\VeloBrowser\\App\\Capabilities'

const CAPABILITIES_KEY = 'HKCU\\Software\\VeloBrowser\\App\\Capabilities'

async function regAdd(
  key: string,
  opts: { defaultValue?: string; valueName?: string; value?: string; type?: string } = {}
): Promise<void> {
  const args = ['add', key, '/f']
  if (opts.defaultValue != null) {
    args.push('/ve', '/d', opts.defaultValue)
  } else if (opts.valueName != null && opts.value != null) {
    args.push('/v', opts.valueName, '/t', opts.type ?? 'REG_SZ', '/d', opts.value)
  }
  await execFile('reg', args, { windowsHide: true })
}

/**
 * Registers Velo in HKCU so it appears under Windows Settings > Default apps > Web browser.
 * Electron's setAsDefaultProtocolClient does not write ApplicationDescription / RegisteredApplications;
 * without those, the UI lists no entry even when the API returns true.
 *
 * Uses async `reg` calls so the main process can handle UI between subprocess spawns (avoid
 * multi-second "not responding" while registering).
 *
 * @see https://learn.microsoft.com/en-us/windows/win32/shell/default-programs
 */
export async function registerVeloWindowsDefaultProgramsRegistration(
  execPath: string,
  displayName: string,
  applicationDescription: string
): Promise<void> {
  const openCmd = `"${execPath}" "%1"`
  const iconRef = `${execPath},0`

  await regAdd(`HKCU\\Software\\Classes\\${URL_PROGID}`, {
    defaultValue: displayName
  })
  await regAdd(`HKCU\\Software\\Classes\\${URL_PROGID}\\DefaultIcon`, { defaultValue: iconRef })
  await regAdd(`HKCU\\Software\\Classes\\${URL_PROGID}\\shell\\open\\command`, { defaultValue: openCmd })

  await regAdd(CAPABILITIES_KEY)
  await regAdd(CAPABILITIES_KEY, { valueName: 'ApplicationName', value: displayName })
  await regAdd(CAPABILITIES_KEY, { valueName: 'ApplicationDescription', value: applicationDescription })
  await regAdd(CAPABILITIES_KEY, { valueName: 'ApplicationIcon', value: iconRef })

  const urlAssoc = `${CAPABILITIES_KEY}\\UrlAssociations`
  await regAdd(urlAssoc, { valueName: 'http', value: URL_PROGID })
  await regAdd(urlAssoc, { valueName: 'https', value: URL_PROGID })

  const fileAssoc = `${CAPABILITIES_KEY}\\FileAssociations`
  await regAdd(fileAssoc, { valueName: '.htm', value: URL_PROGID })
  await regAdd(fileAssoc, { valueName: '.html', value: URL_PROGID })
  await regAdd(fileAssoc, { valueName: '.shtml', value: URL_PROGID })
  await regAdd(fileAssoc, { valueName: '.xht', value: URL_PROGID })
  await regAdd(fileAssoc, { valueName: '.xhtml', value: URL_PROGID })

  const startMenu = `${CAPABILITIES_KEY}\\Startmenu`
  await regAdd(startMenu, { valueName: 'StartmenuInternet', value: START_MENU_INTERNET_CLIENT })

  const smi = `HKCU\\Software\\Clients\\StartMenuInternet\\${START_MENU_INTERNET_CLIENT}`
  await regAdd(smi, { defaultValue: displayName })
  await regAdd(`${smi}\\DefaultIcon`, { defaultValue: iconRef })
  await regAdd(`${smi}\\shell\\open\\command`, { defaultValue: openCmd })

  await regAdd('HKCU\\Software\\RegisteredApplications', {
    valueName: VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME,
    value: CAPABILITIES_REG_VALUE
  })

  await notifyDefaultAssociationsChanged()
}

async function notifyDefaultAssociationsChanged(): Promise<void> {
  try {
    await execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-Command',
        "Add-Type -Namespace W -Name U -MemberDefinition '[DllImport(\"user32.dll\",SetLastError=true)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr h,uint m,System.IntPtr w,string l,uint f,uint t,out System.IntPtr r);'; [IntPtr]$r=0; [void][W.U]::SendMessageTimeout([IntPtr]0xffff,0x1a,[IntPtr]::Zero,'Software\\RegisteredApplications',2,5000,[ref]$r)"
      ],
      { windowsHide: true }
    )
  } catch {
    /* cant do any better ngl 
    * if anyone knows a better way to do this pls lmk or make a pull request
    */
  }
}
