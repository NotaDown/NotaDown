# 发布流程

[English](./release-process.md) | 简体中文

1. 修改仓库根 [package.json](../package.json) 的 `version`。它是唯一被纳入版本管理的版本号：网页构建把它注入 `__APP_VERSION__`，[apps/desktop/scripts/builder.mjs](../apps/desktop/scripts/builder.mjs) 在打包时写入桌面端清单文件，安装包元数据、`app.getVersion()` 与产物文件名都取自这里。各 workspace 包不再自带版本号。
2. 执行 `pnpm changelog`，由上次发布以来的 conventional commits 生成 `## v1.2.3` 小节并写入 [CHANGELOG.md](../CHANGELOG.md)
3. `git add package.json CHANGELOG.md` → `git commit -m "chore: release v1.2.3"` → `git push`
4. `git tag v1.2.3` → `git push origin v1.2.3`，触发 [release.yml](../.github/workflows/release.yml)：`validate` 校验 tag 与根版本一致，`web` 与 `desktop` 在三个平台并行构建，`publish` 取 CHANGELOG.md 中对应的 `## v1.2.3` 小节，追加各平台下载链接（每个链接附 gh-proxy 国内镜像），然后创建 GitHub Release。
5. 打开验证。

版本号带连字符后缀的 tag（`v1.2.3-beta.1`、`v1.2.3-rc.1`）会把 Release 发布为**预发布版（pre-release）**；不带后缀的 `v1.2.3` 发布为正式版。根 `package.json` 写同一串值，后缀一并带上。

| 用途 | 地址 |
| --- | --- |
| 仓库 | https://github.com/NotaDown/NotaDown |
| Releases | https://github.com/NotaDown/NotaDown/releases |

发布产物（版本号以 `1.2.3` 为例）：

- `notadown-web.zip` — 静态网页构建，解压即可部署
- `NotaDown.1.2.3-x64.exe` — Windows NSIS 安装包
- `NotaDown.1.2.3-x64.dmg` / `NotaDown.1.2.3-arm64.dmg` — macOS 镜像
- `NotaDown.1.2.3-x86_64.AppImage` / `NotaDown.1.2.3-amd64.deb` — Linux

## 说明

- 当前版本的小节已存在时 `pnpm changelog` 会拒绝执行；需要重新生成请先删掉该小节
- 生成起点取"最近一个既有小节又有 tag 的版本"，预发布小节不会被当作起点，因此每个预发布版与最终正式版都概括自上个正式版以来的全部改动
- tag 没有对应小节时仍会发布，正文退化为占位说明
- 只有推送 `v*` tag 才会发布。`workflow_dispatch` 手动运行只构建并上传产物，不发布；它提供可选的 `tag` 输入，让手动构建同样能执行版本校验。
- 安装包未做代码签名：CI 中关闭了 `CSC_IDENTITY_AUTO_DISCOVERY`，Windows 首次安装会出现 SmartScreen 提示，macOS 构建不含公证。
- 打包统一带 `--publish never`，全部产物由 release 任务挂载，electron-builder 不会自行上传到 GitHub。
