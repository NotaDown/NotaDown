import config from '../../../project.config.json'

export const PROJECT_REPOSITORY = config.repository

const PROJECT_REPOSITORY_SLUG = `${config.repository.owner}/${config.repository.repo}`

export const GITHUB_REPO_URL = `https://github.com/${PROJECT_REPOSITORY_SLUG}`
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`
export const GITHUB_LATEST_RELEASE_URL = `${GITHUB_RELEASES_URL}/latest`
export const GITHUB_RELEASES_FEED_URL = `${GITHUB_RELEASES_URL}.atom`

export function githubReleaseTagUrl(tag: string): string {
  return `${GITHUB_RELEASES_URL}/tag/${tag}`
}

export function githubReleaseDownloadUrl(tag: string, asset: string): string {
  return `${GITHUB_RELEASES_URL}/download/${tag}/${asset}`
}

// Where the updater looks when github.com itself is unreachable. The channel
// files (latest*.yml, alpha*.yml) are uploaded here at release time; see
// docs/release-process.md.
export const UPDATE_METADATA_BASE_URL = config.update.metadataBaseUrl

// GitHub proxies used for installer bytes only, in path-prefix form
// (<mirror>/https://github.com/...). They are probed concurrently and the
// first one that answers for the expected asset wins.
export const UPDATE_MIRRORS: readonly string[] = config.update.mirrors
