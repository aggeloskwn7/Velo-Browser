# Remove Velo's per-user default-browser registration (HKCU only).
# Run with Velo closed. Then uninstall Velo from Settings > Apps if you want a clean slate,
# reinstall from a fresh build, and use "Register Velo as default" again.
# Does not touch UserChoice hashes (avoid breaking Windows default-apps UI).

$ErrorActionPreference = 'Stop'

function Remove-KeyIfExists {
    param([string]$LiteralPath)
    if (Test-Path -LiteralPath $LiteralPath) {
        Remove-Item -LiteralPath $LiteralPath -Recurse -Force
        Write-Host "Removed: $LiteralPath"
    }
}

function Remove-PropIfExists {
    param([string]$Path, [string]$Name)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $item = Get-Item -LiteralPath $Path
    if ($item.Property -contains $Name) {
        Remove-ItemProperty -LiteralPath $Path -Name $Name -Force
        Write-Host "Removed property: $Path -> $Name"
    }
}

Write-Host "Cleaning Velo default-browser keys under HKCU..."

Remove-KeyIfExists 'HKCU:\Software\Classes\VeloBrowserHTML'
Remove-KeyIfExists 'HKCU:\Software\VeloBrowser'
Remove-KeyIfExists 'HKCU:\Software\Clients\StartMenuInternet\Velo'
# Value name must match VELO_WINDOWS_REGISTERED_APPLICATIONS_NAME in src/shared/constants.ts
Remove-PropIfExists 'HKCU:\Software\RegisteredApplications' 'Velo.VeloBrowser.1'

# Notify shell to refresh default-apps lists (best-effort).
try {
    Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern System.IntPtr SendMessageTimeout(
    System.IntPtr hWnd, uint Msg, System.IntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out System.IntPtr lpdwResult);
'@ | Out-Null
    [IntPtr]$r = [IntPtr]::Zero
    [void][W.U]::SendMessageTimeout(
        [IntPtr]0xffff, 0x1a, [IntPtr]::Zero,
        'Software\RegisteredApplications',
        2, 5000, [ref]$r
    )
} catch {
    # ignore
}

Write-Host ""
Write-Host "Done."
Write-Host "Next: uninstall Velo from Settings > Installed apps if needed, delete any leftover folder"
Write-Host "  (e.g. under %LOCALAPPDATA%\Programs), reinstall, then register as default again."
