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

Pushing the tag starts the **Release** workflow: three runners build installers, then **Publish GitHub Release** creates the GitHub Release and uploads every file (Windows, macOS, Linux). **Your builds are still published** to GitHub Releases.

### Do I need a `GH_TOKEN` secret?

**No.** The job **Create release and upload assets** uses `GITHUB_TOKEN`, which GitHub injects into every workflow. You do **not** need a Personal Access Token unless you change the workflow.

### Then why `--publish never` on the build commands?

Your `package.json` tells electron-builder to use the **GitHub** publisher. After each build, electron-builder would try to upload to Releases itself and insists on an env var named **`GH_TOKEN`**. That is **separate** from the final job that already publishes everything with **`GITHUB_TOKEN`**.

So:

- **`--publish never`** = “only build the installers on this runner; do not upload yet.”
- **`publish-release`** = “one job uploads all installers + release notes to GitHub Releases.”

Without `--publish never`, you would need to set `GH_TOKEN` on **three** runners at once, and those uploads could **fight each other** for the same release. One publish step at the end is the intended setup.

## 5. Check GitHub

- **Actions** → confirm the workflow succeeded.
- **Releases** → confirm assets (Windows `.exe`, macOS `.dmg`/`.zip`, Linux `.AppImage`, plus updater metadata if present).

## Manual workflow run

**Workflow dispatch** only runs builds and uploads artifacts; the **Publish** job runs only for `refs/tags/v*`. To ship binaries, always push a matching `v*` tag.
