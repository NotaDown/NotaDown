// Where the updater looks when github.com itself is unreachable. The channel
// files (latest.yml, latest-linux.yml) are uploaded here at release time; see
// docs/release-process.md.
export const UPDATE_METADATA_BASE_URL = 'https://notadown-dl.brookzhang.com/updater'

// GitHub proxies used for installer bytes only, in path-prefix form
// (<mirror>/https://github.com/...). They are probed concurrently and the
// first one that answers for the expected asset wins.
export const UPDATE_MIRRORS = [
  'https://gh-proxy.com',
  'https://ghproxy.net',
  'https://ghproxy.homeboyc.cn',
  'https://github.akams.cn',
]
