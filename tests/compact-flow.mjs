// Production UI, isolated browser storage and a simulated API. No credentials or paid calls.
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'msedge' })
try {
  const page = await browser.newPage({ locale: 'zh-CN' })
  page.setDefaultTimeout(7000)
  await page.addInitScript(() => {
    localStorage.setItem('chat-demo:service-mode', 'custom')
    localStorage.setItem('chat-demo:api-key', 'fixture')
    localStorage.setItem('chat-demo:api-origin', 'https://fixture.invalid')
  })
  const requests = []
  const summaryInputs = []
  let failSummary = true
  let holdSummary
  let resumeSummary
  const sse = (text, stop_reason = 'end_turn') => ({
    contentType: 'text/event-stream',
    body: [
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text } },
      { type: 'message_delta', delta: { stop_reason } },
      { type: 'message_stop' },
    ]
      .map((event) => 'data: ' + JSON.stringify(event) + '\n\n')
      .join(''),
  })
  await page.route('https://fixture.invalid/**', async (route) => {
    const request = route.request().postDataJSON()
    if (request.system.startsWith('Update a concise')) {
      if (holdSummary) {
        holdSummary()
        await new Promise((resolve) => {
          resumeSummary = resolve
        })
        return route.fulfill(sse('已取消的摘要'))
      }
      if (failSummary)
        return route.fulfill({ status: 429, json: { error: { message: '稍后重试' } } })
      const input = JSON.parse(request.messages[0].content)
      summaryInputs.push(input)
      return route.fulfill(sse(input.previousSummary ? '合并摘要，待回答灯塔问题。' : '第一段摘要'))
    }
    requests.push(request)
    switch (requests.length) {
      case 1:
        return route.fulfill(sse('原始回答', 'max_tokens'))
      case 2:
        return route.fulfill({ status: 400, json: { error: { message: '普通参数错误' } } })
      case 3:
        return route.fulfill({
          status: 400,
          json: { error: { code: 'context_length_exceeded', message: '原版提示文本' } },
        })
      default:
        return route.fulfill(sse('续聊成功'))
    }
  })
  const sessions = () =>
    page.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open('chat-demo')
        request.onsuccess = () => resolve(request.result)
      })
      try {
        return await new Promise((resolve) => {
          const request = db.transaction('sessions').objectStore('sessions').getAll()
          request.onsuccess = () => resolve(request.result)
        })
      } finally {
        db.close()
      }
    })
  const send = async (text) => {
    await page.getByRole('textbox').fill(text)
    await page.getByRole('textbox').press('Enter')
  }
  const compact = page.getByRole('button', { name: '压缩并新建对话' })
  await page.goto(pathToFileURL(resolve('dist/index.html')).href)
  await send('开头标记' + '甲'.repeat(16500))
  await page.getByText('原始回答', { exact: true }).waitFor()
  await page.getByRole('button', { name: '继续生成' }).waitFor()
  assert.equal(await compact.count(), 0)
  await send('错误用例')
  await page.getByText('普通参数错误', { exact: true }).waitFor()
  assert.equal(await compact.count(), 0)
  await send('灯塔叫什么？')
  await page.getByText('原版提示文本', { exact: true }).waitFor()
  const [source] = await sessions()
  await compact.click()
  await page.getByRole('alert').filter({ hasText: '稍后重试' }).waitFor()
  assert.deepEqual(await sessions(), [source])
  failSummary = false
  const started = new Promise((resolve) => {
    holdSummary = resolve
  })
  await compact.click()
  await started
  await page.getByRole('button', { name: '取消', exact: true }).click()
  holdSummary = undefined
  resumeSummary()
  await compact.waitFor()
  assert.deepEqual(await sessions(), [source])
  await compact.click()
  await page.getByText('合并摘要，待回答灯塔问题。', { exact: true }).waitFor()
  assert.equal(summaryInputs.length, 2)
  assert.equal(summaryInputs[1].previousSummary, '第一段摘要')
  assert.match(summaryInputs[1].excerpt, /灯塔叫什么/)
  assert.doesNotMatch(summaryInputs.map((s) => s.excerpt).join(''), /普通参数错误|原版提示文本/)
  await send('接着说')
  await page.getByText('续聊成功', { exact: true }).waitFor()
  assert.match(JSON.stringify(requests.at(-1).messages), /合并摘要/)
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /开头标记/)
  await page.reload()
  const saved = await sessions()
  assert.equal(saved.length, 2)
  assert.deepEqual(
    saved.find((s) => s.id === source.id),
    source
  )
  console.log(
    'PASS: original notices, opt-in, chunked summary, retry, continued context and persisted source'
  )
} finally {
  await browser.close()
}
