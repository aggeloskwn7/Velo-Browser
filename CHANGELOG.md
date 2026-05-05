# Changelog

All notable changes to Velo are documented here. Edit the **`## [x.y.z]`** section for the version you are about to tag, then commit and push the tag (see `docs/releasing.md`).

The release workflow takes the section matching the tag (e.g. tag `v1.0.2` → heading `## [1.0.2]`) and uses it as the GitHub release description (plus auto-generated contributor/commit notes).

## [1.1.0] - 2026-05-02

### Added

- You can now import data such as History, Downloads etc., from other chromium based browsers (Chrome, Edge, Brave, etc)

### Changed

- Welcome screen is now a 3 step onboarding page, where you can import data from other browsers immediately and also make Velo your default browser

- Completely changed how the Password Manager works, V2 Password Manager

- Wrote a new algorithm for how omnibar suggestions work

### Fixed

- Fixed tons of small bugs

- Fixed some issues with the omnibar

---

## [1.0.5] - 2026-05-02

### Fixed

- Small Github Release bug

---

## [1.0.4] - 2026-05-02

### Fixed

- Bug fixes

---

## [1.0.3] - 2026-05-02

### Added

- You can now reorder the shortcuts on the new tab page just by clicking on it and dragging it.

---

## [1.0.2] - 2026-05-02

### Added

- GitHub Actions workflow to build Windows, macOS, and Linux installers and publish a GitHub Release on version tags (`v*`).

### Changed

- **Password manager**: vault now uses OS-protected storage (Electron `safeStorage`) with automatic setup; one-time migration from legacy passphrase vaults in Settings. Save-password bar skips credentials already stored; autofill fixes for sites like Discord (passkey/WebAuthn form guard relaxed, password-like fields and picker logic improved).
- **Privacy / ad blocking**: default ad-block level off; experimental warning on Privacy settings; stricter compatibility-oriented blocking behavior (ongoing refinements).

### Fixed

- TypeScript/`WebFrameMain` typing for adblock notify bridge.

---

## [1.0.1] - earlier

Prior changes.
