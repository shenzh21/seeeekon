// Compare against the official chat-demo snapshot used to start this project.
// upstream.zip is a local baseline, not the private configuration of the hosted website.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'

const archive = unzipSync(await readFile('upstream.zip'))
const normalize = (s) => s.replace(/\r\n/g, '\n')
const upstream = (path) => {
  const entry = Object.keys(archive).find((name) => name.endsWith('/' + path))
  assert.ok(entry, `Missing upstream file: ${path}`)
  return normalize(strFromU8(archive[entry]))
}
const local = async (path) => normalize(await readFile(path, 'utf8'))
for (const path of [
  'src/services/chat/reply.ts',
  'src/services/chat/branches.ts',
  'src/services/chat/latestReminder.ts',
  'src/services/chat/history/toLocal.ts',
  'src/services/chat/history/schema.ts',
  'src/services/api/types.ts',
  'src/services/api/parseEvent.ts',
]) {
  let actual = await local(path)
  // Authorized UI-only pin metadata: message conversion and every other field stay exact.
  if (path.endsWith('/toLocal.ts')) actual = actual.replace('    pinned: file.pinned,\n', '')
  if (path.endsWith('/schema.ts')) actual = actual.replaceAll('pinned: item.pinned === undefined ? false : boolean(item.pinned)', 'pinned: false')
  assert.equal(actual, upstream(path), `Context pipeline differs: ${path}`)
}
const checkSections = async (path, patterns) => {
  for (const pattern of patterns) {
    const expected = upstream(path).match(pattern)?.[0]
    assert.ok(expected, `Upstream section not found: ${pattern}`)
    assert.equal(
      (await local(path)).match(pattern)?.[0],
      expected,
      `Configuration differs: ${path} ${pattern}`
    )
  }
}
await checkSections('src/services/chat/store.ts', [
  /const MODEL:[\s\S]*?(?=\/\*\* 允许自动补标题)/,
  /const latestReminder = prepared.prefix[\s\S]*?(?=const events = streamMessage)/,
  /model: initial.model \?\? MODEL,[\s\S]*?\.\.\.\(titleRequests[^\n]+/,
])
await checkSections('src/services/settings.ts', [
  /const initialLocale =[\s\S]*?(?=export const useSettings)/,
  /thinking: read\(KEYS.thinking\)[\s\S]*?siderCollapsed: read[^\n]+/,
])
for (const path of ['src/i18n/zh.ts', 'src/i18n/en.ts']) {
  await checkSections(path, [/latestReminderLanguage:[^\n]+/])
}
console.log(
  'PASS: official snapshot model/system/thinking/tools/safety parameters, context/branch/history conversion, reminder and language defaults match; hosted service configuration is not covered'
)
