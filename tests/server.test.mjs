import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../server/app.mjs'

const sse = (data) => `data: ${JSON.stringify(data)}\n\n`
const complete =
  sse({ type: 'message_start', message: { id: 'test' } }) + sse({ type: 'message_stop' })
async function fixture(t, fetchImpl) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'liubai-test-'))
  const server = createApp({ apiKey: 'test-private-key', dataDir, fetchImpl })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(
    () =>
      new Promise((r) => {
        server.close(r)
        server.closeAllConnections()
      })
  )
  const base = `http://127.0.0.1:${server.address().port}`
  const init = await fetch(`${base}/api/wallet`)
  const cookie = init.headers.get('set-cookie').split(';')[0]
  const call = (route, body, headers = {}) =>
    fetch(`${base}/api/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { cookie, 'Content-Type': 'application/json', ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  return { call, base, dataDir, cookie }
}
const body = {
  messages: [
    { role: 'latest_reminder', content: '2026-11-17,中文' },
    { role: 'user', content: 'hello' },
  ],
  thinking: { type: 'disabled' },
}
test('wallet recharge is in RMB, isolated, idempotent and persisted', async (t) => {
  const { call, base, dataDir, cookie } = await fixture(t)
  assert.equal((await (await call('wallet')).json()).cents, 200)
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await (await call('topup', { amount: 2000, requestId: 'same' })).json()).cents,
      2200
    )
  assert.equal((await call('topup', { amount: -1000, requestId: 'bad' })).status, 400)
  assert.equal((await (await fetch(`${base}/api/wallet`)).json()).cents, 200)
  const restarted = createApp({ dataDir })
  await new Promise((r) => restarted.listen(0, '127.0.0.1', r))
  t.after(
    () =>
      new Promise((r) => {
        restarted.close(r)
        restarted.closeAllConnections()
      })
  )
  assert.equal(
    (
      await (
        await fetch(`http://127.0.0.1:${restarted.address().port}/api/wallet`, {
          headers: { cookie },
        })
      ).json()
    ).cents,
    2200
  )
})
test('complete response debits once; private key and fixed DeepSeek model only reach upstream', async (t) => {
  let captured
  const { call } = await fixture(t, async (_, init) => {
    captured = init
    return new Response(complete)
  })
  const response = await call('anthropic/v1/messages', body, { 'x-request-id': 'one' })
  assert.match(await response.text(), /message_stop/)
  assert.equal((await (await call('wallet')).json()).cents, 199)
  assert.equal(captured.headers['x-api-key'], 'test-private-key')
  assert.equal(JSON.parse(captured.body).model, 'deepseek-v4.1-flash')
  assert.equal(JSON.parse(captured.body).thinking.type, 'disabled')
  assert.equal(JSON.parse(captured.body).messages.length, 1)
  assert.match(JSON.parse(captured.body).system, /2026-11-17,中文/)
  assert.equal((await call('anthropic/v1/messages', body, { 'x-request-id': 'one' })).status, 409)
  assert.doesNotMatch(JSON.stringify(await (await call('status')).json()), /test-private-key/)
})
test('upstream failure and truncated streams never debit', async (t) => {
  let truncated = false
  const { call } = await fixture(t, async () =>
    truncated
      ? new Response(sse({ type: 'message_start', message: {} }))
      : new Response('secret error', { status: 429 })
  )
  assert.equal((await call('anthropic/v1/messages', body, { 'x-request-id': 'bad' })).status, 429)
  truncated = true
  assert.match(
    await (await call('anthropic/v1/messages', body, { 'x-request-id': 'truncated' })).text(),
    /连接中断/
  )
  assert.equal((await (await call('wallet')).json()).cents, 200)
})
test('cross-origin requests and unsupported attachment payloads are rejected', async (t) => {
  const { call } = await fixture(t)
  assert.equal(
    (await call('topup', { amount: 1000, requestId: 'x' }, { origin: 'https://evil.example' }))
      .status,
    403
  )
  assert.equal(
    (
      await call(
        'anthropic/v1/messages',
        { messages: [{ role: 'user', content: [{ type: 'image' }] }] },
        { 'x-request-id': 'x' }
      )
    ).status,
    400
  )
})
