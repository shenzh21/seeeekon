# 留白 · 网页原型

当前新增 **Android 官方直连预览版**：用户使用自己的 DeepSeek 账号、API Key 和官方余额，无需留白后端。安装、流程、限制和验证见 [Android 说明](docs/ANDROID.md)。下面的启动说明仍用于原先的桌面网页 / Go 模拟钱包原型。

基于 DeepSeek 官方 [chat-demo](https://github.com/deepseek-ai/chat-demo) 的独立第三方网页客户端，非 DeepSeek 官方产品。品牌“留白”为开发占位名。

## 启动

Node.js 22.12+、pnpm。依赖沿用上游；服务端只使用 Node 内置模块。

1. `pnpm install --frozen-lockfile`
2. 项目根目录 `.env` 配置 `OPENCODEGO_API=你的密钥`。
3. `pnpm dev`，访问 http://127.0.0.1:8090 。服务端监听 127.0.0.1:8091。
4. 构建：`pnpm build`；运行构建产物：`pnpm start`，访问 http://127.0.0.1:8091。

`.env` 不参与前端构建，不要提交或分享。后端不会打印密钥。开发服务器与服务端仅监听本机。

## 已实现

- 中文优先的桌面和手机布局、浅色/深色主题；保留官方聊天核心、Markdown、消息分支、编辑与重新生成、停止生成、IndexedDB 持久化。
- 默认服务无需用户填写密钥：本地 Node 后端读取 `.env`，使用 OpenCode Go 的 Anthropic 兼容 API，固定调用 `deepseek-v4.1-flash`。深度思考开关透传到上游。
- 原生历史 ZIP v3 导入、导出；导入使用原有暂存和事务机制合并，不清空已有对话。相同会话 ID 保留本地版本，避免重复导入覆盖后续聊天。显示导入后总会话数。
- 模拟人民币钱包：初始 ¥2.00，模拟充值 ¥10/20/50，完整回复扣 ¥0.01。失败、断流或用户停止时未收到上游 message_stop 不扣费。充值带幂等标识，服务端拒绝已完成的重复聊天请求。
- 模拟账本存放 `.local/wallets.json`，按 HttpOnly Cookie 区分体验会话；刷新和重启后保留。清除 Cookie 会得到新的体验账户，不是正式登录系统。
- 高级设置可切换自备 API。自备服务必须兼容 DeepSeek Anthropic Messages 与相应扩展；密钥仍沿用上游本机设置存储，调用不扣默认服务余额。支持恢复默认服务。

## 原型边界

这不是已上线收费服务：没有真实支付、账号登录、云端历史同步、生产账务、并发部署或公网鉴权。钱包 JSON 为单进程演示存储，不可用于真实支付。调用 DeepSeek 会消耗你的 OpenCode Go 额度，网页“模拟”仅指面向终端用户的账单。

当前默认通道只接文字聊天与思考，不展示未接通的联网搜索、附件上传和语音入口。导入的文字和分支可续聊；导入的历史网页工具签名不能在 Go 恢复网页内容，非文字附件不能继续提交到默认通道。官方导出未包含的原件、未识别内容不能完整恢复。客户端不会静默截断过长文字历史，上游拒绝时显示错误。

官方 Demo 原本是纯静态应用，默认直接请求官方 API；本项目通过它已有的 `createConfig({ apiOrigin, devServer })` 接入本地服务。会话仍使用上游 store/db/backup，不另建聊天存储。上游 `README.md` 和 `README.zh-CN.md` 原样保留，描述的是上游基线，运行本版本以本文为准。MIT LICENSE 随构建产物保留；其他依赖沿用其许可。

## 验证

- `pnpm type`：TypeScript。
- `pnpm lint`：原有静态检查。
- `pnpm test`：Node 后端测试，覆盖充值幂等、账户隔离、重启持久化、完整回复计费、重复请求拒绝、断流及上游失败不计费、跨站与附件拒绝、模型和环境信息适配。
- `node scripts/make-fixture.mjs`：生成官方 v3 格式的无隐私测试 ZIP 及损坏 ZIP，供浏览器导入验证。

真实网页验证记录见 `docs/verification.md`。测试样例不代表所有历史版本与实际导出文件都已验证。
