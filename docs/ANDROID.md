# Seekontinue Android 预览版

本版本以 Android App 为主：复用 React 网页、官方 chat-demo 的聊天与 IndexedDB 导入链，Capacitor 打包本地资源。Android 8.0（API 26）及以上。

## 用户流程

1. 点“连接 DeepSeek”，确认创建本设备专用密钥、官方 API 计费和导入历史的说明。
2. 在官方开放平台登录。App 操作已核验的网页表单，创建“Seekontinue Android”密钥，交给 Android Keystore 加密保存。此前创建的旧名称密钥不自动更名或撤销。
3. 连接成功后弹窗询问是否导入历史；选择“暂不导入”直接回主页。选择导入才打开聊天网站，首次需要第二次登录，请使用同一账号；已有登录态时跳过登录。稍后可从侧栏或设置导入。
4. 程序打开数据管理，优先下载现存有效导出；没有下载按钮时申请导出并轮询等待。仅接收 `deepseek_data-*.zip`，忽略旧版 ZIP。
5. 归档通过原有 `backup.importHistory → replaceHistory → importArchive → commitStaging(merge)` 写入本地。重复 ID 保留本地版本，损坏归档不会清空已有记录；成功后关闭设置并回到主页。
6. 聊天请求直接由手机发送到 `https://api.deepseek.com`，查询官方人民币余额。充值按钮打开官方账户页面，付款由用户操作。不接入留白账号、模拟钱包或中转服务器。

连接完成但导入被取消时，已经保存的 API 连接仍可聊天；稍后从数据管理再次导入。官方网页改版、验证、导出限频或网络错误会中断自动化，不能保证永远只登录一次。

官方余额为 0 时，在主界面提示从侧栏“DeepSeek 官方充值”进入官方平台，可选择稍后再说；读取失败或余额未知不弹此提示。主页不再展示导入快捷文案，侧栏和数据管理保留入口。

会话的“更多”菜单支持置顶/取消置顶，使用现有 Session、摘要及 IndexedDB 写入链；旧记录缺省为不置顶，不变更数据库版本。归档的会话和索引均保留 pinned 元数据，不影响消息和上下文。

设置新增“关于软件”：版本、独立第三方说明、本机数据说明、官方开源来源与离线许可证。许可生成规则见 `licenses/README.md`。

## 本机实现

- `src/services/migration/driver.js`：随 App 打包的 DOM 操作代码，不依赖 Codex、电脑或远程执行服务。依据 2026-11-17 实际页面核验的选择器；页面变化时需更新 App。
- `src/services/migration/native.ts`：Capgo WebView 的公开 API。桥接仅允许相应 DeepSeek 主文档源；注册完成后才操作页面；关闭、取消、超时后释放监听。官方网页始终留在前台，自动步骤在网页内覆盖 Shadow DOM 进度弹窗，取消通过现有任务桥接处理；需要登录时移除遮罩。任务完成后关闭官方网页，本地数据库导入阶段才使用 App 内弹窗。最大归档 256 MB。
- 归档接收：恢复最初在手机上成功的 Capgo `handleDownloads → downloadCompleted → convertFileSrc → importHistory` 路径，按文件名仅接收新版 ZIP。撤回另建的归档网络请求和网页链接拦截。MainActivity 通过 Android 公开 startActivity 扩展点，仅消费本 App FileProvider 的 `my_cache_images/inappbrowser-downloads/` 下新版/旧版聊天 ZIP 的 ACTION_VIEW，阻止外部打开；调用正常返回后插件继续发出下载完成事件，其他文件与跳转保持原行为。不修改第三方插件源码，不调用官方私有导出接口。
- `src/services/native.ts` 与 `KeyVaultPlugin.java`：原生 AES-GCM / Android Keystore 保存密钥；恢复时只返回连接状态。API 传输固定 DeepSeek HTTPS 主机，拒绝自动重定向，支持原有 JSON、multipart、SSE、取消和二进制响应。
- API Key 创建时会短暂经过 App 内存，之后不写 localStorage、IndexedDB、日志或聊天记录。没有从旧网页密钥设置自动迁移。关闭 Android 备份和 WebView 调试；R8 移除 Android 日志调用，避免上游插件把桥接内容写入日志。
- 断开连接仅删除本机凭据，不撤销官方密钥，也不删除聊天。官方撤销由用户在官方平台完成。WebView 的官方登录态可能继续保留。
- 主界面内置于 APK；普通网页预览保留此前 Go / 模拟钱包原型，Android 强制采用官方模式。没有部署任何服务器。
- 聊天连接固定官方 API；官方登录和支付页面可能加载微信、支付宝或其他必要资源，因此不是全网络层面的 DeepSeek 域名白名单。

## 构建

`pnpm install --frozen-lockfile`，然后 `pwsh -NoProfile -File scripts/build-android.ps1`。

本机工具放在 `.local/toolchains/`（忽略提交）：JDK 21、Android SDK 36、Gradle 8.14.3。脚本优先使用本机工具，未发现时使用环境的 JDK/SDK 与 Gradle Wrapper。`pnpm build` 和 `pnpm exec cap sync android` 先更新网页资源。

输出 `artifacts/seekontinue-android-preview.apk` 和 SHA-256。使用 Android 调试证书，但关闭应用调试并执行 R8 优化，以实际移除上游插件的日志调用；仅供测试，不是商店发布版本。发布前必须配置独立签名和发行版本号。

预览版签名固定保存在 `.local/signing/debug.keystore`，首次构建优先复制当前用户的标准调试证书，否则生成测试证书。请保留此文件，后续更新使用同一签名。该目录不提交、不打包。此前未固定路径的首版与后续包发生过签名不一致；用户选择自行卸载首版后重新测试，不以卸载作为日常升级方式。

## 验证

- `pnpm type`、`pnpm lint`、`pnpm test`。
- `node scripts/check-upstream-context.mjs`：与项目原始 `upstream.zip` 比较模型、提示词、思考/工具/审核参数、上下文与分支、历史转换、日期提醒、语言默认值。校验本项目采用的官方开源版本，不代表官方托管网页的未公开配置。
- `node tests/mobile-flow.mjs`：在桌面 Edge headless 中加载正式构建产物，模拟原生插件和官方网页，执行连接、自动导出、新旧 ZIP 区分、合并、损坏保护、取消、恢复、续聊与分块流。测试不创建真实密钥、不付款，不能代替 Android 原生或真实官方服务验收。
- Android 编译使用 `assembleDebug`，开启 R8 和日志移除。
- `pnpm android:check`：检查 APK 未包含 `.env`、服务器代码、测试文件或本机服务密钥；检查关闭调试/日志配置，以及 DEX 中不再保留敏感桥接日志文本。APK v2 签名已通过 `apksigner verify`。

官方 API 续聊、支付返回、手机后台恢复仍需设备验证。模拟用例通过不代表这些真实流程已通过。

2026-11-17 电脑验收：Android APK 已构建并验证签名；桌面桥接集成测试包含连接后连续导入、旧 ZIP 忽略、重复合并、损坏保护、取消监听清理、重载恢复、导入上下文续聊、中文 UTF-8 跨分块流和停止生成，均通过。本机 Android Emulator 37.2.13 在加载 Android 前以 `0xC0000005` 退出；软件 CPU 模拟与不同图形参数仍未启动，不能把 APK 编译成功视为原生运行通过。

2026-11-17 真机初步验收：在 Android 16 手机上通过 USB 首次安装成功，启动后进程保持运行，前台连接页面正常显示。未授予额外运行时权限，未清除任何应用数据。官方登录、密钥创建、导入及续聊仍待后续验证。

后续用户真机反馈：连接后能读取官方余额；在聊天网站第二次登录后自动操作并成功导入，但同时弹出系统“打开方式”。插件的原生下载处理会启动外部应用再发送完成事件。已补全归档桥接对 detached anchor `dispatchEvent(click)` 的拦截，原有 `click()` 路径保留；桌面集成测试验证两种路径导入且无下载事件。实际手机上弹窗是否消失仍待更新后复测。

同步恢复 upstream.zip 中官方 chat-demo 的系统提示词 `该助手为DeepSeek，由深度求索公司创造。`，第三方身份仅在界面说明，不额外加入系统提示。已有对话内容保留，可能仍影响回答；这不是对官方网页未公开完整提示配置的复刻。更新采用覆盖安装，不清除应用数据。

后续安装记录：覆盖更新被 Android 因签名不一致拒绝，用户自行卸载旧版重新测试。固定预览签名后，新版已通过 USB 安装成功并启动（Android 16）。两次登录提示、官方配置对齐及下载拦截改动已进入此次安装包；真实导入是否仍出现“打开方式”待用户复测。

最新迭代：用户确认上一版仍出现两次外部打开，但导入成功。检查官方公开网页 JS 后确认导出使用没有 download 属性的 anchor，依次启动新版与旧版链接，因此仅拦截文件名属性不足。当前已实现上述原生归档模式并关闭外部下载处理，桌面测试覆盖不带文件名的链接、响应 Content-Disposition、新旧格式、取消、重复导入、余额侧栏刷新及自动步骤弹窗。显示名改为 Seekontinue，应用 ID、存储标识和固定签名保持不变；用户自行卸载后重新安装成功并启动。新的真实下载及隐藏网页操作仍待手机复测。

随后修正：用户要求弹窗直接覆盖官方网页，已去掉隐藏网页的实现。上一版还遗漏了插件要求的 `preShowScript` 配套参数 `isPresentAfterPageLoad: true`，导致聊天页无法打开，现已修复并纳入测试断言。网页内遮罩、导出等待状态及遮罩取消已通过生产构建集成测试；修订 APK 已成功覆盖安装，并观察到真机官方聊天登录页正常打开。真实账号后续导入结果待验证。

下载回归修复：用户在手机上持续停留“正在接收对话”。该提示原本仅表示已点击下载，不能证明字节开始接收。自建接收路径未能完成真实导入，因此已撤回，恢复之前确实导入成功的插件下载链，只在 MainActivity 阻止聊天 ZIP 的外部查看请求。此次不再使用 preShowScript。遮罩保持覆盖官方页面。恢复下载与抑制外部打开的组合仍需真机验证。

最终反馈及 1.1-preview：用户已确认上述恢复下载版本导入成功。本轮保留下载链，增加可选导入、完成回主页、余额引导、会话置顶和关于页。麦克风修复补齐 Capacitor BridgeWebChromeClient 音频捕获所请求的 MODIFY_AUDIO_SETTINGS（原先仅声明 RECORD_AUDIO），使用现有权限桥接；权限拒绝文案改为 Android 设置指引。电脑集成测试、类型/静态检查、官方配置基线检查、APK 构建与签名校验通过，最终 APK 已核验包含两项录音所需权限。本轮按用户要求只交付 APK，没有安装、操作手机或录制音频；麦克风真机录音仍待用户验证。
