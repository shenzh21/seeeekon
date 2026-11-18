// Prepare public release files only after building the APK. Never include signing credentials.
import fs from 'node:fs'
import crypto from 'node:crypto'
const gradle = fs.readFileSync('android/app/build.gradle', 'utf8')
const versionName = /versionName\s+"([^"]+)"/.exec(gradle)[1]
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)[1])
const apk = fs.readFileSync('artifacts/seeeekon-android-preview.apk')
const sha256 = crypto.createHash('sha256').update(apk).digest('hex')
const name = `seeeekon-${versionName}.apk`
fs.mkdirSync('.local/release', { recursive: true })
fs.writeFileSync(`.local/release/${name}`, apk)
fs.writeFileSync(`.local/release/SHA256SUMS.txt`, `${sha256}  ${name}\n`)
fs.writeFileSync('docs/latest.json', JSON.stringify({
  schema: 1, appId: 'app.liubai.chat', versionCode, versionName,
  releaseUrl: `https://github.com/shenzh21/seeeekon/releases/tag/v${versionName}`,
  downloadUrl: `https://github.com/shenzh21/seeeekon/releases/download/v${versionName}/${name}`,
  sha256,
  notes: [
    '新增关于软件中的检查更新、下载主页和 GitHub 项目入口。',
    '打开应用时自动检查新版本，支持稍后提醒；检查失败不影响聊天。',
    '采用红白锦鲤图标与淡红主题，保留官方账户连接和历史导入。',
  ],
}, null, 2) + '\n')
console.log(`Prepared ${name} and GitHub Pages update manifest`)
