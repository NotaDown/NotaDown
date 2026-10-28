# Release Process

English | [简体中文](./release-process.zh-CN.md)

1. Update `version` in the repo root [package.json](../package.json). It is the only tracked version: the web build injects it into `__APP_VERSION__`, and [apps/desktop/scripts/builder.mjs](../apps/desktop/scripts/builder.mjs) writes it into the desktop manifest at packaging time, which is what the installer metadata, `app.getVersion()` and the artifact names use. Workspace packages carry no version of their own.
2. Run `pnpm changelog` to append the `## v1.2.3` section to [CHANGELOG.md](../CHANGELOG.md), generated from the conventional commits since the last release
3. `git add package.json CHANGELOG.md` → `git commit -m "chore: release v1.2.3"` → `git push`
4. `git tag v1.2.3` → `git push origin v1.2.3` to trigger [release.yml](../.github/workflows/release.yml): `validate` checks the tag against the root version, `web` and `desktop` build in parallel on three platforms, `publish` takes the matching `## v1.2.3` section from CHANGELOG.md, appends per-platform download links (each with a gh-proxy mirror), and opens the GitHub Release. On a stable tag `web` also uploads a Pages artifact, which the `pages` job deploys once the release is out.
5. Open and verify.
6. For a stable release, check that the `metadata` job uploaded the channel files to the self-hosted source (prereleases skip it). If it fails, re-run that job on its own, see below.
7. For a stable release, check that the `pages` job deployed the web edition (prereleases skip it). If it fails, re-run that job on its own, see below.

A tag whose version carries a hyphen suffix (`v1.2.3-beta.1`, `v1.2.3-rc.1`) publishes the GitHub Release as a **pre-release**; a plain `v1.2.3` tag publishes it as the stable release. Root `package.json` holds the same string, suffix included.

| Purpose | URL |
| --- | --- |
| Repository | https://github.com/NotaDown/NotaDown |
| Releases | https://github.com/NotaDown/NotaDown/releases |
| Web edition | https://notadown.brookzhang.com |

Release assets (version shown as `1.2.3`):

- `notadown-web.zip` — the static web build, unpacked and served as-is
- `NotaDown.1.2.3-x64.exe` — Windows NSIS installer
- `NotaDown.1.2.3-x64.dmg` / `NotaDown.1.2.3-arm64.dmg` — macOS disk images
- `NotaDown.1.2.3-x86_64.AppImage` / `NotaDown.1.2.3-amd64.deb` — Linux

## Web edition on GitHub Pages

The `pages` job publishes the same `apps/web/dist` build that ships as `notadown-web.zip` to https://notadown.brookzhang.com. Stable tags only: a pre-release leaves the live site on the previous stable version.

One-time setup, in the repository's **Settings**:

- Publishing source: **GitHub Actions**. While another source is selected, `Configure Pages` fails with `Get Pages site failed`.
- Custom domain: `notadown.brookzhang.com`, with **Enforce HTTPS** on. The domain is stored only in this setting — a workflow-published site ignores a `CNAME` file in the artifact, so the build carries none.
- DNS: a `CNAME` record `notadown` → `notadown.github.io`. Where the zone runs behind a CDN (EdgeOne), keep that record DNS-only; a proxied record terminates at the CDN and never reaches Pages.
- **Settings → Environments → `github-pages` → Deployment branches**: **All workflows**, or a rule of type **Tag** with the pattern `v*`. A rule limited to branches rejects the release run with `Tag "v1.2.3" is not allowed to deploy to github-pages due to environment protection rules`. Patterns are glob, not regex, and match the bare tag name without a `refs/tags/` prefix.

No base path is baked in: [apps/web/vite.config.ts](../apps/web/vite.config.ts) uses a relative `base`, so the same artifact also serves correctly from the `notadown.github.io/NotaDown/` project page.

A failed deployment is retried with "Re-run failed jobs" on the `pages` job alone, without rebuilding the release; the Pages artifact lives as long as the run's artifacts, so retry before that retention window closes.

## Self-hosted update metadata

The desktop app reads its channel files (`latest.yml`, `latest-linux.yml`) from GitHub by default. GitHub is probed with a 4-second timeout first (electron-updater's own requests have no short timeout), and when it does not answer the app reads the files from `https://notadown-dl.brookzhang.com/updater/` instead (configured in [apps/desktop/src/update-sources.ts](../apps/desktop/src/update-sources.ts)).

A stable release triggers the `metadata` job in [release.yml](../.github/workflows/release.yml) (`needs: publish`, skipped for prereleases). It runs `node scripts/update-metadata.mjs --tag <tag>`, which fetches both channel files from the GitHub release, checks their version against the tag, rewrites asset URLs to absolute GitHub URLs, then uploads them with a pinned coscli to the `updater/` prefix of the `notadown-1302260381` COS bucket. If the job fails, choose "Re-run failed jobs" to retry only it without rebuilding the release; coscli retries with backoff on its own.

Two repository secrets are required: `TENCENTCLOUD_SECRET_ID` and `TENCENTCLOUD_SECRET_KEY`. The `QcloudCOSDataWriteOnly` preset is enough for the sub-account: the job disables coscli's bucket-type detection, so no `HeadBucket` call is made (use a custom policy limited to `cos:PutObject` on `updater/*` if the scope needs narrowing). When retrying locally with the same sub-account, set `disableautofetchbuckettype: "true"` in the coscli config:

```bash
pnpm update-metadata                    # uses the root package.json version, or --tag v1.2.3
coscli cp update-metadata/latest.yml cos://notadown-1302260381/updater/latest.yml
coscli cp update-metadata/latest-linux.yml cos://notadown-1302260381/updater/latest-linux.yml
```

- The app requests `<base>/latest.yml` (Windows) and `<base>/latest-linux.yml` (Linux AppImage)
- The checksum comes from the self-hosted source; installer bytes still come from GitHub first, then from the probed proxy mirrors
- Publish stable releases only: the generic channel has no prerelease filter, so a beta channel file would upgrade stable clients to a beta
- Clients request the channel files with `?noCache=<random>`, so keep the CDN's default query-in-cache-key behaviour; if query filtering is enabled, give `/updater/*` a very short TTL or it will keep serving the previous channel files

## Notes

- `pnpm changelog` refuses to run when the section for the current version already exists; delete that section before regenerating
- Sections are anchored on the last tagged version that has a section, and prerelease sections are never used as the anchor, so every prerelease and the final release describe the whole range since the previous stable release
- A tag without a matching section still publishes, with a placeholder body instead of the changelog
- Only pushing a `v*` tag publishes. A `workflow_dispatch` run builds and uploads artifacts without publishing and without touching the live site; it takes an optional `tag` input so the version check can still run on a manual build.
- The installers are unsigned: `CSC_IDENTITY_AUTO_DISCOVERY` is disabled in CI, so Windows shows a SmartScreen prompt and macOS builds are produced without notarization.
- Packaging passes `--publish never`; the release job attaches everything, so electron-builder never uploads to GitHub by itself.
