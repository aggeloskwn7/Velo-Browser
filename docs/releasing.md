# Releasing a new Velo version

## 1. Edit the changelog

Open [CHANGELOG.md](../CHANGELOG.md) and add or update the section:

```markdown
## [1.0.3] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

The heading **must** be `## [x.y.z]` (semver, no `v`). The GitHub Actions release job extracts **only this section** for the release description (tag `v1.0.3` matches `## [1.0.3]`).

## 2. Bump the version

Set the same version in:

- `package.json` → `"version": "x.y.z"`
- `package-lock.json` → top-level `"version"` and `packages[""].version` (or run `npm version patch|minor|major --no-git-tag-version` and adjust CHANGELOG if needed)

## 3. Commit

```bash
git add CHANGELOG.md package.json package-lock.json
git commit -m "chore: release v1.0.2"
```

Use a message you prefer; the **git tag** drives CI, not the commit subject.

## 4. Tag and push

Tag name **must** be `v` plus the same semver as in `package.json`:

```bash
git tag v1.0.2
git push origin main
git push origin v1.0.2
```

(Replace `main` with your default branch if different.)

Pushing the tag starts the **Release** workflow: three platform builds, then a GitHub Release with your CHANGELOG section and generated notes.

## 5. Check GitHub

- **Actions** → confirm the workflow succeeded.
- **Releases** → confirm assets (Windows `.exe`, macOS `.dmg`/`.zip`, Linux `.AppImage`, plus updater metadata if present).

## Manual workflow run

**Workflow dispatch** only runs builds and uploads artifacts; the **Publish** job runs only for `refs/tags/v*`. To ship binaries, always push a matching `v*` tag.
