# 上游与改动边界

Android 扩展：经用户确认新增 Capacitor 8、Capgo InAppBrowser 和开发测试用 Playwright；利用 Capacitor 原生插件注册接入设备凭据和官方 HTTP 请求。手机壳采用官方个人账户直连，不使用旧 Go 中转与模拟账务。没有修改 node_modules 上游源码；通过 Android R8 构建规则移除插件日志。详见 `ANDROID.md`。

来源：https://github.com/deepseek-ai/chat-demo ，main 分支 ZIP，2026-11-17 下载，package version 0.1.1。保留 LICENSE 及原中英文说明。

原生机制：React 18 + Zustand + IndexedDB + Rspack。公开构建工厂 `createConfig` 支持 API origin 和代理。聊天调用链：ChatInput → store.sendMessage/streamReply → api.client.streamMessage → reply.applyEvent → IndexedDB。导入链：SettingsDialog → backup.importHistory → store.replaceHistory → importArchive → db.commitStaging。

用户要求：官方公开的对话配置必须沿用。Android 官方直连的模型、系统提示词、思考/搜索/审核参数、上下文构造、消息分支、历史转换及 latestReminder 保持所采用官方开源版本的行为，不注入品牌身份或自行替换提示。语言默认值也恢复为上游跟随系统语言。对照基线为项目原始 `upstream.zip`；运行 `node scripts/check-upstream-context.mjs` 检查这些边界。界面品牌、设备凭据保存、官方登录导入和历史合并属于已授权客户端扩展。开源配置对齐不等于已取得官网未公开配置，也不保证模型逐字输出一致。

局部改动：品牌样式与入口；现有设置增加默认/自备服务；API client 选择 origin；服务端 Go 兼容适配；现有导入事务增加 merge 模式（清空历史仍使用默认 replace 模式）。模拟钱包是新增的业务域，未替换原有会话存储。未加入新的运行时依赖。

1.1-preview 的置顶扩展仅保留归档已有 pinned 字段并写入 Session/摘要，旧记录缺省 false。`check-upstream-context.mjs` 仅允许 schema 两处 pinned 校验及 toLocal 一处 pinned 赋值，其余历史转换、消息、上下文与提示配置仍逐项对照原始上游。关于页复用现有设置分组和构建机制，未新增依赖。

默认服务与官方模式差异：Go 使用 deepseek-v4.1-flash；latest_reminder 转为系统环境说明；历史思考和官方网页工具块不传递到 Go，保留文字内容；默认通道不提供 Files/ASR/TTS/搜索工具。自备模式保留原官方接口协议。
