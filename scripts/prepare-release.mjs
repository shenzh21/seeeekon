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
    '遇到上下文已满提示，可选择「压缩并新建对话」。原对话和提示保留，摘要完成后可在新对话接着聊。',
    '按当前分支分段总结文字和未答问题，支持取消和重试。生成摘要消耗 API 额度，附件仅引用文件名。',
    '未连接账户时，点击余额、手动刷新或官方充值会进入连接页。',
  ],
}, null, 2) + '\n')
console.log(`Prepared ${name} and GitHub Pages update manifest`)
