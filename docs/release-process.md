# Release Process

English | [简体中文](./release-process.zh-CN.md)

1. Update `version` in the repo root [package.json](../package.json). It is the only tracked version: the web build injects it into `__APP_VERSION__`, and [apps/desktop/scripts/builder.mjs](../apps/desktop/scripts/builder.mjs) writes it into the desktop manifest at packaging time, which is what the installer metadata, `app.getVersion()` and the artifact names use. Workspace packages carry no version of their own.
2. Run `pnpm changelog` to append the `## v1.2.3` section to [CHANGELOG.md](../CHANGELOG.md), generated from the conventional commits since the last release
3. `git add package.json CHANGELOG.md` → `git commit -m "chore: release v1.2.3"` → `git push`
4. `git tag v1.2.3` → `git push origin v1.2.3` to trigger [release.yml](../.github/workflows/release.yml): `validate` checks the tag against the root version, `web` and `desktop` build in parallel on three platforms, `publish` takes the matching `## v1.2.3` section from CHANGELOG.md, appends per-platform download links (each with a gh-proxy mirror), and opens the GitHub Release.
5. Open and verify.

A tag whose version carries a hyphen suffix (`v1.2.3-beta.1`, `v1.2.3-rc.1`) publishes the GitHub Release as a **pre-release**; a plain `v1.2.3` tag publishes it as the stable release. Root `package.json` holds the same string, suffix included.

| Purpose | URL |
| --- | --- |
| Repository | https://github.com/NotaDown/NotaDown |
| Releases | https://github.com/NotaDown/NotaDown/releases |

Release assets (version shown as `1.2.3`):

- `notadown-web.zip` — the static web build, unpacked and served as-is
- `NotaDown.1.2.3-x64.exe` — Windows NSIS installer
- `NotaDown.1.2.3-x64.dmg` / `NotaDown.1.2.3-arm64.dmg` — macOS disk images
- `NotaDown.1.2.3-x86_64.AppImage` / `NotaDown.1.2.3-amd64.deb` — Linux

## Notes

- `pnpm changelog` refuses to run when the section for the current version already exists; delete that section before regenerating
- Sections are anchored on the last tagged version that has a section, and prerelease sections are never used as the anchor, so every prerelease and the final release describe the whole range since the previous stable release
- A tag without a matching section still publishes, with a placeholder body instead of the changelog
- Only pushing a `v*` tag publishes. A `workflow_dispatch` run builds and uploads artifacts without publishing; it takes an optional `tag` input so the version check can still run on a manual build.
- The installers are unsigned: `CSC_IDENTITY_AUTO_DISCOVERY` is disabled in CI, so Windows shows a SmartScreen prompt and macOS builds are produced without notarization.
- Packaging passes `--publish never`; the release job attaches everything, so electron-builder never uploads to GitHub by itself.
