# seeeekon 品牌资源

锦鲤图案基于用户提供并确认的图片整理：清除背景纹理，统一为红色，保留原造型和留白。主资源为 `src/assets/seeeekon-koi.png`，并非从 DeepSeek 官方图标复制。

- `seeeekon-avatar-2048.png`：2048 × 2048 暖白底头像，适合上传小红书，已留出圆形裁切边距。
- `seeeekon-avatar-1024.png`：同图的 1024 × 1024 版本。
- `seeeekon-avatar-round-preview.png`：圆形裁切效果预览；上传建议使用方形原图。
- `seeeekon-logo-transparent.png`：透明底图标。

运行 `node scripts/generate-brand.mjs` 使用项目现有 Playwright 与本机 Edge 生成以上文件和 Android 各尺寸图标。Android 沿用原来的资源引用入口，适配圆形、自适应及系统主题图标；前景保留遮罩安全区。品牌配色在现有 `src/app/brand.css` 中维护，不改变主题存储或聊天配置。

本次验证：类型检查、lint、官方上下文配置对照、浅色/深色移动网页预览、头像尺寸及圆形裁切、Android 编译、APK 内容和 v2 签名均通过。1.4-preview 已生成，未安装到手机；原生启动图和桌面效果尚未真机验收。
