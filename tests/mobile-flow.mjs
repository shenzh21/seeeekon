// Desktop integration test of the actual production web bundle + bundled scripts.
// Native bridge and DeepSeek pages are explicit fixtures; no real API key/payment.
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import assert from 'node:assert/strict'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

const root = path.resolve('dist')
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]))
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    const content = await readFile(file)
    res.setHeader(
      'Content-Type',
      file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html; charset=utf-8'
    )
    res.end(content)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', hasTouch: true })
context.setDefaultTimeout(15000)
const app = await context.newPage()
const errors = []
app.on('pageerror', (e) => errors.push(e.message))
let view
let keySaved = false
let archiveMode = 'plain'
let openCount = 0
let chatCount = 0
let cancelled = false
let downloads = 0
let archiveRequests = 0
let balance = '0.00'
const fixtureFiles = unzipSync(await readFile('tests/fixtures/deepseek-history.zip'))
for (const [name, bytes] of Object.entries(fixtureFiles)) {
  if (name === 'chat_session_index.json')
    fixtureFiles[name] = strToU8(
      JSON.stringify(JSON.parse(strFromU8(bytes)).map((item) => ({ ...item, pinned: true })))
    )
  else if (/^chat_sessions\/[^/]+\.json$/.test(name))
    fixtureFiles[name] = strToU8(JSON.stringify({ ...JSON.parse(strFromU8(bytes)), pinned: true }))
}
const fixture = Buffer.from(zipSync(fixtureFiles)).toString('base64')
const pageFor = (url) =>
  url.includes('platform.deepseek')
    ? `<!doctype html><button id="new">创建 API key</button><script>
document.getElementById('new').onclick=()=>{document.body.innerHTML='<input placeholder="输入 API key 的名称"><button id="create">创建</button>';document.getElementById('create').onclick=()=>{document.body.innerHTML='<code>sk-fixture012345678901234567890123456789</code>';};};
</script>`
    : `<!doctype html><meta name="viewport" content="width=device-width"><div id="menu" role="button"><svg><path d="M17.2027 4.90034V6.43655"></path></svg></div><script>
const mode=${JSON.stringify(archiveMode)};
document.getElementById('menu').onclick=()=>{document.body.innerHTML='<div class="_2afd28d" tabindex="0">测试账号</div>';document.querySelector('div').onclick=()=>{document.body.innerHTML='<div role="button"><span>系统设置</span></div>';document.querySelector('div').onclick=()=>{document.body.innerHTML='<button>数据管理</button>';document.querySelector('button').onclick=()=>{document.body.innerHTML='<div><div><span>导出所有历史对话</span></div><button id="export">导出</button></div>';document.getElementById('export').onclick=()=>{document.getElementById('export').outerHTML='<span>正在导出</span>';if(mode==='wait')return;setTimeout(()=>{document.querySelector('body>div').insertAdjacentHTML('beforeend','<button id="download">下载</button>');document.getElementById('download').onclick=()=>{for(const name of ['old-version_conversations.zip','deepseek_data-2026-11-17.zip']){const a=document.createElement('a');if(mode!=='plain')a.download=name;const bytes=Uint8Array.from(atob(mode==='invalid'?'bm90LXppcA==':${JSON.stringify(fixture)}),c=>c.charCodeAt(0));a.href=mode==='plain'?'https://chat.deepseek.com/export/'+(name.startsWith('old-')?'old':'new'):URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));if(mode==='click')a.click();else a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));URL.revokeObjectURL(a.href);}}},250)}}};};};
</script>`
await context.route('https://platform.deepseek.com/**', (route) =>
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: pageFor(route.request().url()) })
)
await context.route('https://chat.deepseek.com/**', (route) =>
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: pageFor(route.request().url()) })
)
await context.route('**/_capacitor_file_/fixture/**', (route) =>
  route.fulfill({
    contentType: 'application/zip',
    body: archiveMode === 'invalid' ? Buffer.from('not zip') : Buffer.from(fixture, 'base64'),
  })
)
await app.exposeFunction('nativeFixture', async (plugin, method, options) => {
  if (plugin === 'KeyVault') {
    if (method === 'get') return { connected: keySaved }
    if (method === 'set') {
      assert.match(options.value, /^sk-fixture/)
      keySaved = true
      return
    }
    if (method === 'remove') {
      keySaved = false
      return
    }
    if (method === 'cancel') {
      cancelled = true
      return
    }
    if (method === 'request') {
      assert.equal(new URL(options.url).origin, 'https://api.deepseek.com')
      if (options.url.endsWith('/anthropic/v1/messages')) {
        const body = JSON.parse(Buffer.from(options.body, 'base64').toString())
        assert.equal(body.model, 'deepseek-flash')
        assert.equal(body.system, '该助手为DeepSeek，由深度求索公司创造。')
        assert.match(JSON.stringify(body.messages), /白鹭/)
        const sequence = [
          {
            type: 'message_start',
            message: { id: 'native-fixture-' + ++chatCount, model: 'deepseek-flash' },
          },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
          {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: chatCount === 1 ? '白鹭灯塔还在，故事继续。' : '正在等待停止。',
            },
          },
          ...(chatCount === 1
            ? [{ type: 'content_block_stop', index: 0 }, { type: 'message_stop' }]
            : []),
        ]
        const encoded = Buffer.from(
          sequence.map((data) => `data: ${JSON.stringify(data)}\n\n`).join('')
        )
        setTimeout(async () => {
          await app.evaluate(
            ({ id }) =>
              window.fixtureEmit('KeyVault', 'http', {
                id,
                type: 'headers',
                status: 200,
                contentType: 'text/event-stream',
              }),
            { id: options.id }
          )
          // Split every few bytes to exercise UTF-8 decoding across native bridge chunks.
          for (let i = 0; i < encoded.length; i += 7)
            await app.evaluate(
              ({ id, data }) => window.fixtureEmit('KeyVault', 'http', { id, type: 'chunk', data }),
              { id: options.id, data: encoded.subarray(i, i + 7).toString('base64') }
            )
          if (chatCount === 1)
            await app.evaluate(
              ({ id }) => window.fixtureEmit('KeyVault', 'http', { id, type: 'end' }),
              { id: options.id }
            )
        }, 10)
        return
      }
      assert.equal(options.url.endsWith('/user/balance'), true)
      setTimeout(async () => {
        await app.evaluate(
          ({ id, balance }) => {
            window.fixtureEmit('KeyVault', 'http', {
              id,
              type: 'headers',
              status: 200,
              contentType: 'application/json',
            })
            window.fixtureEmit('KeyVault', 'http', {
              id,
              type: 'chunk',
              data: btoa(
                JSON.stringify({ balance_infos: [{ currency: 'CNY', total_balance: balance }] })
              ),
            })
            window.fixtureEmit('KeyVault', 'http', { id, type: 'end' })
          },
          { id: options.id, balance }
        )
      }, 10)
      return
    }
  }
  if (plugin === 'CapgoInAppBrowser') {
    if (method === 'openWebView') {
      assert.deepEqual(options.javascriptBridgeOrigins, [new URL(options.url).origin])
      assert.equal(options.handleDownloads, options.url.includes('chat.deepseek.com'))
      assert.notEqual(options.hidden, true, 'Official page must stay in the foreground')
      if (options.preShowScript) assert.equal(options.isPresentAfterPageLoad, true)
      view = await context.newPage()
      const id = 'fixture-' + ++openCount
      view.on('pageerror', (e) => errors.push(e.message))
      view.on('download', () => downloads++)
      await view.exposeFunction('bridgeMessage', async (message) =>
        app.evaluate(
          ({ id, detail }) =>
            window.fixtureEmit('CapgoInAppBrowser', 'messageFromWebview', { id, detail }),
          { id, detail: message.detail }
        )
      )
      await view.exposeFunction('fixtureDownload', async (fileName) => {
        archiveRequests++
        await app.evaluate(
          ({ id, fileName }) =>
            window.fixtureEmit('CapgoInAppBrowser', 'downloadCompleted', {
              id,
              fileName,
              localUrl: 'file:///fixture/' + fileName,
              handledBy: 'external',
            }),
          { id, fileName }
        )
      })
      await view.addInitScript(() => {
        HTMLAnchorElement.prototype.click = function () {
          const old = this.download.startsWith('old-') || this.href.endsWith('/old')
          window.fixtureDownload(
            old ? 'old-version_conversations.zip' : 'deepseek_data-2026-11-17.zip'
          )
        }
        HTMLAnchorElement.prototype.dispatchEvent = function (e) {
          if (e.type === 'click') {
            this.click()
            return false
          }
          return EventTarget.prototype.dispatchEvent.call(this, e)
        }
      })
      await view.addInitScript(
        () => (window.mobileApp = { postMessage: (m) => window.bridgeMessage(m) })
      )
      if (options.preShowScript) await view.addInitScript({ content: options.preShowScript })
      await view.goto(options.url)
      return { id }
    }
    if (method === 'executeScript') {
      if (view && !view.isClosed())
        await view.evaluate((code) => {
          ;(0, eval)(code)
        }, options.code)
      return
    }
    if (method === 'close') {
      if (view && !view.isClosed()) await view.close()
      return
    }
  }
  throw new Error(`Unexpected native call ${plugin}.${method}`)
})
await app.addInitScript(() => {
  window.androidBridge = {}
  const callbacks = new Map()
  window.fixtureEmit = (plugin, event, data) => {
    for (const item of callbacks.values())
      if (item.plugin === plugin && item.event === event) item.fn(data)
  }
  window.Capacitor = {
    convertFileSrc: (url) => location.origin + '/_capacitor_file_' + url.slice('file://'.length),
    PluginHeaders: ['KeyVault', 'CapgoInAppBrowser'].map((name) => ({
      name,
      methods: [
        ...[
          'get',
          'set',
          'remove',
          'request',
          'cancel',
          'openWebView',
          'executeScript',
          'close',
          'hide',
          'show',
          'removeListener',
        ].map((name) => ({ name, rtype: 'promise' })),
        { name: 'addListener', rtype: 'callback' },
      ],
    })),
    nativePromise: async (plugin, method, options) => {
      if (method === 'removeListener') {
        callbacks.delete(options.callbackId)
        return
      }
      return window.nativeFixture(plugin, method, options)
    },
    nativeCallback: (plugin, method, options, fn) => {
      const id = String(Math.random())
      callbacks.set(id, { plugin, event: options.eventName, fn })
      return id
    },
  }
  window.fixtureListenerCount = () => callbacks.size
})
const openImportSettings = async () => {
  await app.getByRole('button', { name: '打开边栏', exact: true }).click()
  await app.getByRole('button', { name: '导入 DeepSeek 对话' }).last().click()
}
// Keep the migration suite independent of the live publication/update service.
await context.route('https://shenzh21.github.io/seeeekon/latest.json', route => route.fulfill({status: 503, body: ''}))
const waitHome = async () => {
  await app.getByRole('dialog').waitFor({ state: 'hidden', timeout: 20000 })
  await app.getByRole('button', { name: '打开边栏', exact: true }).waitFor()
  assert.equal(await app.getByText('带上旧对话，接着聊').count(), 0)
}
try {
  await app.goto(origin)
  await app.getByRole('button', { name: '连接 DeepSeek', exact: true }).click()
  await app.screenshot({ path: 'docs/android-connect-preview.png' })
  await app.getByRole('button', { name: '同意并连接', exact: true }).click()
  await app.getByRole('dialog', { name: '要带回以前的对话吗？' }).waitFor({ timeout: 20000 })
  assert.equal(openCount, 1, 'No chat login until user chooses import')
  assert.equal(await app.getByRole('dialog', { name: '官方余额为 0' }).count(), 0)
  await app.getByRole('button', { name: '暂不导入', exact: true }).click()
  await app.getByRole('dialog', { name: '官方余额为 0' }).waitFor()
  assert.equal(
    await app.getByRole('tab', { name: '通用设置' }).count(),
    0,
    'Already home before balance notice'
  )
  await app.getByRole('button', { name: '打开侧栏', exact: true }).click()
  await app.getByRole('button', { name: 'DeepSeek 官方充值 ↗', exact: true }).last().waitFor()
  balance = '12.98'
  await app.getByRole('button', { name: '刷新余额', exact: true }).last().click()
  await app.getByText('¥ 12.98', { exact: true }).last().waitFor()
  await app.getByRole('button', { name: '设置', exact: true }).last().click()
  await app.getByRole('button', { name: 'DeepSeek 账户 →', exact: true }).click()
  await app.getByRole('button', { name: '重新连接账户', exact: true }).click()
  await app.getByRole('button', { name: '同意并连接', exact: true }).click()
  await app.getByRole('dialog', { name: '要带回以前的对话吗？' }).waitFor({ timeout: 20000 })
  assert.equal(openCount, 2)
  await app.screenshot({ path: 'docs/android-import-choice-preview.png' })
  await app.getByRole('button', { name: '导入对话', exact: true }).click()
  await waitHome()
  assert.equal(keySaved, true)
  assert.ok(archiveRequests >= 1, 'Plain official export links use native download')
  assert.equal(await app.evaluate(() => localStorage.getItem('chat-demo:api-key')), null)
  await openImportSettings()
  archiveMode = 'valid'
  await app.getByRole('button', { name: '登录并导入对话' }).click()
  await waitHome()
  // Reimport merges instead of duplicating. Invalid archives leave committed data intact.
  archiveMode = 'click'
  await openImportSettings()
  await app.getByRole('button', { name: '登录并导入对话' }).click()
  await waitHome()
  archiveMode = 'invalid'
  await openImportSettings()
  await app.getByRole('button', { name: '登录并导入对话' }).click()
  await app.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent === '登录并导入对话' && !b.disabled
      ),
    {},
    { timeout: 20000 }
  )
  assert.match(await app.getByRole('status').first().innerText(), /ZIP|zip|归档|文件|格式/)
  await app.waitForFunction(() => window.fixtureListenerCount() === 0, {}, { timeout: 20000 })
  archiveMode = 'wait'
  await app.getByRole('button', { name: '登录并导入对话' }).click()
  await new Promise((resolve) => setTimeout(resolve, 100))
  await view.getByRole('dialog', { name: '正在自动处理' }).waitFor()
  await view.getByRole('status').filter({ hasText: '正在等待 DeepSeek 导出' }).waitFor()
  await view.screenshot({ path: 'docs/android-progress-preview.png' })
  await view.getByRole('button', { name: '取消', exact: true }).click()
  await app.getByText('已取消导入，账户仍已连接。', { exact: true }).waitFor()
  await app.waitForFunction(() => window.fixtureListenerCount() === 0)
  await app.reload()
  await app.getByRole('button', { name: '打开边栏', exact: true }).click()
  await app.getByText('置顶', { exact: true }).last().waitFor()
  await app.getByRole('button', { name: '更多', exact: true }).last().click()
  await app.getByRole('menuitem', { name: '取消置顶', exact: true }).click()
  await app.getByText('置顶', { exact: true }).waitFor({ state: 'hidden' })
  await app.reload()
  await app.getByRole('button', { name: '打开边栏', exact: true }).click()
  assert.equal(await app.getByText('置顶', { exact: true }).count(), 0, 'Unpin survives reload')
  await app.getByRole('button', { name: '更多', exact: true }).last().click()
  await app.getByRole('menuitem', { name: '置顶对话', exact: true }).click()
  await app.getByText('置顶', { exact: true }).last().waitFor()
  await app.reload()
  await app.getByRole('button', { name: '打开边栏', exact: true }).click()
  await app.getByText('置顶', { exact: true }).last().waitFor()
  await app.getByRole('button', { name: '导入 DeepSeek 对话' }).last().click()
  const exported = app.waitForEvent('download')
  await app.getByRole('button', { name: '下载', exact: true }).click()
  const exportFiles = unzipSync(await readFile(await (await exported).path()))
  assert.equal(JSON.parse(strFromU8(exportFiles['chat_session_index.json']))[0].pinned, true)
  assert.equal(
    JSON.parse(
      strFromU8(
        Object.entries(exportFiles).find(([name]) => /^chat_sessions\/[^/]+\.json$/.test(name))[1]
      )
    ).pinned,
    true
  )
  await app.getByRole('tab', { name: '关于软件' }).click()
  const version = /versionName\s+"([^"]+)"/.exec(await readFile('android/app/build.gradle', 'utf8'))[1]
  await app.getByText(`版本 ${version}`, { exact: true }).waitFor()
  await app.getByText('chat-demo · MIT 许可证', { exact: true }).click()
  await app.getByText('Permission is hereby granted', { exact: false }).first().waitFor()
  await app.getByRole('textbox', { name: '查找开源组件' }).fill('@capgo/capacitor-inappbrowser')
  await app.locator('summary').filter({ hasText: '@capgo/capacitor-inappbrowser@8.27.9' }).click()
  await app.getByText('Mozilla Public License', { exact: false }).waitFor()
  await app.screenshot({ path: 'docs/android-about-preview.png' })
  await app.getByRole('button', { name: '关闭', exact: true }).click()
  await app.getByRole('button', { name: '打开边栏', exact: true }).click()
  await app.getByRole('button', { name: '刷新余额', exact: true }).last().click()
  await app.getByRole('button', { name: '刷新余额', exact: true }).last().waitFor()
  await app.screenshot({ path: 'docs/android-sidebar-preview.png' })
  await app.getByText('海边的约定 · 导入测试', { exact: true }).click()
  await app.getByText('记住了，海边的灯塔叫白鹭。', { exact: true }).waitFor()
  await app.getByRole('textbox').fill('灯塔叫什么？')
  await app.getByRole('textbox').press('Enter')
  await app.getByText('白鹭灯塔还在，故事继续。', { exact: true }).waitFor()
  await app.getByRole('textbox').fill('继续写')
  await app.getByRole('textbox').press('Enter')
  await app.getByText('正在等待停止。', { exact: true }).waitFor()
  await app.getByRole('button', { name: '停止生成', exact: true }).click()
  assert.equal(cancelled, true)
  assert.equal(await app.evaluate(() => localStorage.getItem('chat-demo:api-key')), null)
  assert.equal(
    await app.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('chat-demo')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const count = await new Promise((resolve, reject) => {
        const req = db.transaction('sessions').objectStore('sessions').count()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      db.close()
      return count
    }),
    1
  )
  assert.deepEqual(errors, [])
  assert.equal(downloads, 0, 'ZIP downloads must stay in the import bridge')
  await mkdir('docs', { recursive: true })
  await app.screenshot({ path: 'docs/android-desktop-preview.png' })
  console.log(
    'PASS: optional import/skip, home return, zero balance guidance, official recharge entry, pin/unpin persistence and ZIP metadata, offline licenses, native bridge, new ZIP, duplicate merge, corrupt preservation, cancel cleanup, context continuation, split UTF-8 stream, stop'
  )
} catch (error) {
  console.error('APP', (await app.locator('body').innerText()).slice(-3000), 'ERRORS', errors)
  if (view && !view.isClosed()) console.error('VIEW', await view.locator('body').innerText())
  if (view && !view.isClosed()) {
    await view.screenshot({ path: '.local/mobile-flow-failure.png' })
    console.error(
      'OVERLAY',
      await view.evaluate(
        () => document.getElementById('seekontinue-migration-overlay')?.shadowRoot?.innerHTML
      )
    )
  }
  throw error
} finally {
  await browser.close()
  server.close()
}

