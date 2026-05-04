# Changelog

All notable changes to Velo are documented here. Edit the **`## [x.y.z]`** section for the version you are about to tag, then commit and push the tag (see `docs/releasing.md`).

The release workflow takes the section matching the tag (e.g. tag `v1.0.2` → heading `## [1.0.2]`) and uses it as the GitHub release description (plus auto-generated contributor/commit notes).

## [1.0.2] - 2026-05-02

### Added

- GitHub Actions workflow to build Windows, macOS, and Linux installers and publish a GitHub Release on version tags (`v*`).

### Changed

- **Password manager**: vault now uses OS-protected storage (Electron `safeStorage`) with automatic setup; one-time migration from legacy passphrase vaults in Settings. Save-password bar skips credentials already stored; autofill fixes for sites like Discord (passkey/WebAuthn form guard relaxed, password-like fields and picker logic improved).
- **Privacy / ad blocking**: default ad-block level off; experimental warning on Privacy settings; stricter compatibility-oriented blocking behavior (ongoing refinements).
- **Misc**: `ERR_BLOCKED_BY_CLIENT` error page copy; adblock debug env notes.

### Fixed

- TypeScript/`WebFrameMain` typing for adblock notify bridge.

---

## [1.0.1] - earlier

Prior changes (no consolidated changelog entry in-repo). Use git history for details.
