import fs from 'fs';
import path from 'path';
import { rcedit } from 'rcedit';

function toWindowsFourPartVersion(semver) {
  const raw = String(semver).replace(/^v/i, '');
  const parts = raw.split(/[.+]/).map((x) => {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const p = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) p[i] = parts[i] ?? 0;
  return p.join('.');
}

/**
 * After ASAR integrity: set icon and PE version strings so Windows shows "Velo"
 * in Default apps and HTTP/HTTPS picker. With signAndEditExecutable disabled, the stock Electron
 * file description would otherwise stay on the binary.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const { appOutDir, packager } = context;
  const exeName = `${packager.appInfo.productFilename}.exe`;
  const exePath = path.join(appOutDir, exeName);
  const icoPath = path.join(packager.projectDir, 'public', 'Velo.ico');

  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) return;

  const productName = packager.appInfo.productName;
  const fileDescription = productName;
  const copyright = packager.config.copyright || '';
  const winVer = toWindowsFourPartVersion(packager.appInfo.version || '1.0.0');
  const internal = path.basename(exeName, '.exe');

  await rcedit(exePath, {
    icon: icoPath,
    'file-version': winVer,
    'product-version': winVer,
    'version-string': {
      FileDescription: fileDescription,
      FileVersion: winVer,
      ProductName: productName,
      ProductVersion: winVer,
      CompanyName: `${productName} Browser`,
      InternalName: internal,
      OriginalFilename: exeName,
      LegalCopyright: copyright
    }
  });
}
