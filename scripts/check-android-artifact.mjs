import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import assert from 'node:assert/strict'
const files = unzipSync(new Uint8Array(await readFile('artifacts/seeeekon-android-preview.apk')))
const names = Object.keys(files)
assert(!names.some(name => /(?:^|\/)\.env(?:\.|$)/.test(name)))
assert(!names.some(name => /(?:^|\/)(server|tests|\.local)\//.test(name)))
const config = JSON.parse(new TextDecoder().decode(files['assets/capacitor.config.json']))
assert.equal(config.appName, 'seeeekon')
assert.equal(config.appId, 'app.liubai.chat')
assert.equal(config.loggingBehavior, 'none')
assert.equal(config.android.webContentsDebuggingEnabled, false)
assert.equal(config.server.url, undefined)
for (const name of names.filter(name => name.endsWith('.dex'))) {
  assert(!Buffer.from(files[name]).includes(Buffer.from('Received message from JavaScript:')), 'WebView bridge logging must be removed from DEX')
}
const env = await readFile('.env', 'utf8').catch(() => '')
for (const line of env.split(/\r?\n/)) {
  const match = /^\s*OPENCODEGO_API\s*=\s*["']?([^\s"']+)/.exec(line)
  if (!match || match[1].length < 12) continue
  const privateValue = Buffer.from(match[1])
  assert(!Object.values(files).some(bytes => Buffer.from(bytes).includes(privateValue)), 'Private server key must not enter APK')
}
console.log('PASS: bundled local UI, debugging/logging disabled, no env/server/tests files or configured server credential in APK')
