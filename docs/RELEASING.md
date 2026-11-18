# 发布与更新

项目：https://github.com/shenzh21/seeeekon

下载主页：https://shenzh21.github.io/seeeekon/

GitHub Pages 从 `main` 分支的 `/docs` 发布，入口为 `docs/index.html`；`.nojekyll` 让静态文件原样提供。无需自建服务器或自定义 Actions 工作流。不要在 docs 中放入密钥或真实聊天归档。

## 维护一次发布

1. 在 `android/app/build.gradle` 增加 versionCode，更新 versionName。保持 `app.liubai.chat` 和现有签名。预览签名位于 `.local/signing/debug.keystore`，务必在本地安全备份，绝不上传。
2. 运行类型检查、lint、相关流程测试，使用 `scripts/build-android.ps1` 构建，并验证 `scripts/check-android-artifact.mjs` 及签名。当前使用固定预览证书，尚非应用商店发行配置。
3. 更新 `scripts/prepare-release.mjs` 的本次说明，再运行它。它从已构建 APK 生成带版本号的文件、SHA256SUMS 和 `docs/latest.json`。发布前核实 APK 的 versionCode/versionName 确实对应当前源码。
4. 提交与 APK 对应的源码，创建 `v<versionName>` 标签，上传 `.local/release/seeeekon-<versionName>.apk`、`SHA256SUMS.txt` 到 GitHub Release。预览版标为 prerelease。
5. 仅在 Release 资产已经可公开下载后，将新的 `docs/latest.json` 推送到 main。避免 App 提示一个尚未上传的版本。不要修改已经发布的同版本 APK；修复请升版。
6. 检查 Pages 已构建、版本 JSON 可匿名读取且带 CORS 响应头、下载链接返回 200、远端 APK 哈希与本机一致。

版本文件 schema 1 包含 appId、versionCode、versionName、releaseUrl、downloadUrl、sha256 与 notes。客户端只接受本项目 HTTPS 的指定 Release/资产路径，按 versionCode 比较。静态主页展示哈希用于手工校验；当前 App 跳转下载页，不在 App 内执行 APK 哈希校验或静默安装。Android 负责安装包签名校验。

不使用 `/releases/latest` 作为预览版检测入口，因为 GitHub 此接口排除 prerelease；采用 Pages 静态 JSON 也避免所有用户共享出口 IP 时触发匿名 REST API 每小时 60 次的额度。

## 客户端行为与验证

- 1.5-preview 起在启动和页面回到前台时检查，每 6 小时至多一次；后台不轮询。
- “稍后再说”保存到现有 settings/localStorage 机制，为该版本推迟 24 小时；后续更高版本不受该延迟影响。手动“检查更新”始终可以检查。
- 检查失败不会显示“已是最新版本”，不会阻塞聊天或重复自动弹错。用户可从关于页打开下载主页。
- 自动弹窗复用现有 Modal、设置/迁移/回复状态；下载链接使用已安装的 Capgo 插件 Custom Tabs。
- `node tests/updates-flow.mjs` 验证启动提醒、重载节流、延后持久化、手动检查、当前/旧版本、不可信 URL、失败处理和原生打开链接调用。原生桥接为模拟，不代替真机安装测试。
- 老版本没有该逻辑，需要先手动安装包含更新检查的新 APK，之后才能收到前台提醒。

来源：[GitHub Releases API](https://docs.github.com/en/rest/releases/releases)、[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Android 更新要求](https://developer.android.com/google/play/app-updates)。
