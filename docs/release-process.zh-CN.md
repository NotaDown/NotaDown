# 发布流程

[English](./release-process.md) | 简体中文

1. 修改仓库根 [package.json](../package.json) 的 `version`。它是唯一被纳入版本管理的版本号：网页构建把它注入 `__APP_VERSION__`，[apps/desktop/scripts/builder.mjs](../apps/desktop/scripts/builder.mjs) 在打包时写入桌面端清单文件，安装包元数据、`app.getVersion()` 与产物文件名都取自这里。各 workspace 包不再自带版本号。
2. 执行 `pnpm changelog`，由上次发布以来的 conventional commits 生成 `## v1.2.3` 小节并写入 [CHANGELOG.md](../CHANGELOG.md)
3. `git add package.json CHANGELOG.md` → `git commit -m "chore: release v1.2.3"` → `git push`
4. `git tag v1.2.3` → `git push origin v1.2.3`，触发 [release.yml](../.github/workflows/release.yml)：`validate` 校验 tag 与根版本一致，`web` 与 `desktop` 在三个平台并行构建，`publish` 取 CHANGELOG.md 中对应的 `## v1.2.3` 小节，追加各平台下载链接（国内镜像链接经由 EdgeOne 跳转域名），然后创建 GitHub Release。正式版下 `web` 任务还会上传一份 Pages 产物，Release 创建完成后由 `pages` 任务部署。
5. 打开验证。
6. 确认 `metadata` 任务把频道文件传到了自建更新源（正式版刷新 `latest*.yml`，预发布版刷新 `alpha*.yml`）。该任务失败时在 Actions 里单独重跑它即可，见下节。
7. 正式版发布后确认 `pages` 任务把网页版部署上线了（预发布版跳过）。该任务失败时同样在 Actions 里单独重跑它，见下节。

版本号带连字符后缀的 tag（`v1.2.3-beta.1`、`v1.2.3-rc.1`）会把 Release 发布为**预发布版（pre-release）**；不带后缀的 `v1.2.3` 发布为正式版。根 `package.json` 写同一串值，后缀一并带上。客户端只有在当前安装的是预发布版本，或用户在“设置 → 更新”中打开“检查 alpha 版本更新”时才会看到预发布版。

| 用途 | 地址 |
| --- | --- |
| 仓库 | https://github.com/NotaDown/NotaDown |
| Releases | https://github.com/NotaDown/NotaDown/releases |
| 下载跳转 | https://notadown-redirect.brookzhang.com/gh |
| 网页版 | https://notadown.brookzhang.com |

Release 里的国内镜像链接统一走 EdgeOne 跳转域名。镜像目标配置在 [infra/edgeone-redirect/edgeone.json](../infra/edgeone-redirect/edgeone.json)，换镜像只需修改该文件并重新部署 EdgeOne Pages 项目，已发布的 Release 链接不受影响。

发布产物（版本号以 `1.2.3` 为例）：

- `notadown-web.zip` — 静态网页构建，解压即可部署
- `NotaDown.1.2.3-x64.exe` — Windows NSIS 安装包
- `NotaDown.1.2.3-x64.dmg` / `NotaDown.1.2.3-arm64.dmg` — macOS 镜像
- `NotaDown.1.2.3-x86_64.AppImage` / `NotaDown.1.2.3-amd64.deb` — Linux

## 网页版与 GitHub Pages

`pages` 任务把与 `notadown-web.zip` 同源的 `apps/web/dist` 构建部署到 https://notadown.brookzhang.com，只在正式版 tag 运行：预发布版不会改动线上站点，线上始终等于最近的正式版。

一次性配置，位置在仓库的 **Settings**：

- 发布源选 **GitHub Actions**。源不是 GitHub Actions 时，`Configure Pages` 会报 `Get Pages site failed`。
- 自定义域名填 `notadown.brookzhang.com`，并开启 **Enforce HTTPS**。域名只保存在这一处设置里：Actions 发布的站点会忽略产物中的 `CNAME` 文件，构建里无需携带。
- DNS 加一条 `CNAME` 记录 `notadown` → `notadown.github.io`。域名走 CDN（EdgeOne）时该记录必须设为仅 DNS；被代理的记录会终止在 CDN，到不了 Pages。
- **Settings → Environments → `github-pages` → Deployment branches**：选 **All workflows**，或添加一条类型为 **Tag**、模式为 `v*` 的规则。规则只覆盖分支时，tag 触发的运行会被拒：`Tag "v1.2.3" is not allowed to deploy to github-pages due to environment protection rules`。模式用 glob 而非正则，匹配不带 `refs/tags/` 前缀的 tag 名。

构建不写死基础路径：[apps/web/vite.config.ts](../apps/web/vite.config.ts) 的 `base` 是相对路径，同一份产物部署到项目页 `notadown.github.io/NotaDown/` 也能正常访问。

部署失败时在 Actions 里选 "Re-run failed jobs" 只重跑 `pages` 任务，不会重建发行包；Pages 产物与本次运行的其他产物同生命周期，需在保留期内重跑。

## 自建更新元数据源

桌面端默认从 GitHub 读取频道文件（`latest.yml`、`latest-linux.yml`、`alpha.yml`、`alpha-linux.yml`），检查前先用 4 秒超时探测 GitHub（electron-updater 自身的请求没有短超时）；无响应时改读 `https://notadown-dl.brookzhang.com/updater/`（配置在 [project.config.json](../project.config.json)）。

每次发布都会触发 [release.yml](../.github/workflows/release.yml) 的 `metadata` 任务（`needs: publish`）：它运行 `node scripts/update-metadata.mjs --tag <tag>`，从 GitHub Release 拉取频道文件、校验版本与 tag 一致、把安装包地址改写成 GitHub 绝对地址，再用固定版本的 coscli 上传到 COS 桶 `notadown-1302260381` 的 `updater/` 前缀。正式版 tag 刷新 `latest*.yml`，并把 `alpha*.yml` 指向最新的预发布版；预发布 tag 只刷新 `alpha*.yml`，不改动正式版频道。任务失败时在 Actions 里选 "Re-run failed jobs" 只重跑它，不会重建发行包；coscli 自身带退避重试。

需要两个仓库 secret：`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`。子账号附加预设策略 `QcloudCOSDataWriteOnly` 即可：任务关闭了 coscli 的桶类型自动探测，不会调用 `HeadBucket`；要收窄资源范围则改用自定义策略，只授该桶 `updater/*` 的 `cos:PutObject`。本地用同一子账号补传时，coscli 配置需同样设 `disableautofetchbuckettype: "true"`：

```bash
pnpm update-metadata                    # 取根 package.json 的版本，或 --tag v1.2.3
coscli cp update-metadata/latest.yml cos://notadown-1302260381/updater/latest.yml
coscli cp update-metadata/latest-linux.yml cos://notadown-1302260381/updater/latest-linux.yml
coscli cp update-metadata/alpha.yml cos://notadown-1302260381/updater/alpha.yml
coscli cp update-metadata/alpha-linux.yml cos://notadown-1302260381/updater/alpha-linux.yml
```

按脚本实际生成的文件上传；没有预发布版时不会生成 alpha 文件。

- 应用请求 `<base>/latest.yml`（Windows）与 `<base>/latest-linux.yml`（Linux AppImage）；开启 alpha 更新检查时请求 `<base>/alpha.yml` 或 `<base>/alpha-linux.yml`，该频道文件不存在时退回正式版文件
- 校验值来自自建源，安装包字节仍先走 GitHub，失败时依次探测代理镜像
- `latest*.yml` 只来自正式版，稳定版客户端不会跳到预发布版；`alpha*.yml` 只在开启 alpha 检查时读取
- 预发布版同样由自建源提供：`alpha*.yml` 始终指向最新的预发布 Release
- 客户端每次请求带 `?noCache=<随机值>`，CDN 保持默认的“参数参与缓存”即可；若开了“过滤参数”，请给 `/updater/*` 配很短的 TTL，否则会继续返回旧版本的频道文件

## 说明

- 当前版本的小节已存在时 `pnpm changelog` 会拒绝执行；需要重新生成请先删掉该小节
- 生成起点取"最近一个既有小节又有 tag 的版本"，预发布小节不会被当作起点，因此每个预发布版与最终正式版都概括自上个正式版以来的全部改动
- tag 没有对应小节时仍会发布，正文退化为占位说明
- 只有推送 `v*` tag 才会发布。`workflow_dispatch` 手动运行只构建并上传产物，既不发布也不改动线上站点；它提供可选的 `tag` 输入，让手动构建同样能执行版本校验。
- 安装包未做代码签名：CI 中关闭了 `CSC_IDENTITY_AUTO_DISCOVERY`，Windows 首次安装会出现 SmartScreen 提示，macOS 构建不含公证。
- 打包统一带 `--publish never`，全部产物由 release 任务挂载，electron-builder 不会自行上传到 GitHub。
