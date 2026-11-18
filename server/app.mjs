import http from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
  createReadStream,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export function createApp({
  apiKey = process.env.OPENCODEGO_API,
  fetchImpl = fetch,
  dataDir = path.join(root, '.local'),
  staticDir = path.join(root, 'dist'),
} = {}) {
  mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'wallets.json')
  const accounts = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const active = new Set()
  const save = () => {
    writeFileSync(`${file}.tmp`, JSON.stringify(accounts))
    renameSync(`${file}.tmp`, file)
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  const fail = (res, status, message) => json(res, status, { error: { message } })
  const readBody = async (req) => {
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      size += chunk.length
      if (size > 4 * 1024 * 1024) throw new Error('请求过大，请缩短本次内容。')
      chunks.push(chunk)
    }
    return JSON.parse(Buffer.concat(chunks).toString())
  }
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (!url.pathname.startsWith('/api/')) {
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
        const target = path.resolve(staticDir, `.${relative}`)
        if (!target.startsWith(`${staticDir}${path.sep}`) || !existsSync(target))
          return fail(res, 404, '页面不存在')
        const mime = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.svg': 'image/svg+xml',
        }
        res.writeHead(200, {
          'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        })
        createReadStream(target).pipe(res)
        return
      }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
        return fail(res, 403, '不允许跨站请求')
      let accountId = /(?:^|;\s*)liubai_session=([a-f0-9-]{36})(?:;|$)/.exec(
        req.headers.cookie || ''
      )?.[1]
      if (!accountId || !Object.hasOwn(accounts, accountId)) {
        accountId = randomUUID()
        accounts[accountId] = {
          cents: 200,
          entries: [{ id: randomUUID(), amount: 200, label: '体验余额（模拟）', at: Date.now() }],
          requests: {},
        }
        save()
        res.setHeader(
          'Set-Cookie',
          `liubai_session=${accountId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`
        )
      }
      const account = accounts[accountId]
      if (url.pathname === '/api/wallet' && req.method === 'GET')
        return json(res, 200, { cents: account.cents, entries: account.entries, simulated: true })
      if (url.pathname === '/api/status' && req.method === 'GET')
        return json(res, 200, {
          configured: Boolean(apiKey),
          model: 'DeepSeek V4.1 Flash',
          simulatedBilling: true,
        })
      if (url.pathname === '/api/topup' && req.method === 'POST') {
        const { amount, requestId } = await readBody(req)
        if (
          ![1000, 2000, 5000].includes(amount) ||
          typeof requestId !== 'string' ||
          requestId.length > 100
        )
          return fail(res, 400, '请选择有效充值金额')
        const id = `topup:${requestId}`
        if (!Object.hasOwn(account.requests, id)) {
          account.cents += amount
          account.requests[id] = true
          account.entries.unshift({ id, amount, label: '充值（模拟）', at: Date.now() })
          save()
        }
        return json(res, 200, { cents: account.cents, entries: account.entries, simulated: true })
      }
      if (url.pathname !== '/api/anthropic/v1/messages' || req.method !== 'POST')
        return fail(res, 404, '当前服务尚未接入此功能')
      if (!apiKey) return fail(res, 503, '聊天服务尚未配置，请检查服务端 OPENCODEGO_API。')
      const body = await readBody(req)
      if (!Array.isArray(body.messages) || !body.messages.length)
        return fail(res, 400, '消息不能为空')
      if (
        body.messages.some(
          (m) =>
            !['user', 'assistant', 'latest_reminder'].includes(m.role) ||
            (typeof m.content !== 'string' &&
              (!Array.isArray(m.content) ||
                m.content.some(
                  (b) =>
                    !['text', 'thinking', 'server_tool_use', 'web_fetch_tool_result'].includes(
                      b.type
                    )
                )))
        )
      )
        return fail(res, 400, '当前通道仅支持文字续聊，请移除附件或使用高级设置中的官方 API。')
      const messages = body.messages
        .filter((m) => m.role !== 'latest_reminder')
        .map(({ role, content }) => ({
          role,
          content:
            typeof content === 'string'
              ? content
              : content
                  .filter((b) => b.type === 'text')
                  .map((b) => ({ type: 'text', text: b.text })),
        }))
      const reminder = body.messages.findLast((m) => m.role === 'latest_reminder')?.content
      const system = [
        typeof body.system === 'string' ? body.system : '',
        reminder ? `用户环境信息：${reminder}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      const requestId = req.headers['x-request-id']
      if (typeof requestId !== 'string' || requestId.length > 100)
        return fail(res, 400, '缺少请求标识')
      if (active.has(accountId)) return fail(res, 409, '上一条回复仍在生成，请稍后再试。')
      if (Object.hasOwn(account.requests, `chat:${requestId}`))
        return fail(res, 409, '这条请求已经完成，请查看历史回复。')
      if (account.cents < 1) return fail(res, 402, '余额不足，请先添加模拟余额。')
      active.add(accountId)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 180_000)
      res.on('close', () => controller.abort())
      try {
        const upstream = await fetchImpl('https://opencode.ai/inference/go/anthropic/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'x-opencode-session': `${accountId}:${String(req.headers['x-chat-session'] || 'new').slice(0, 80)}`,
          },
          body: JSON.stringify({
            model: 'deepseek-v4.1-flash',
            max_tokens: 8192,
            messages,
            system,
            thinking:
              body.thinking?.type === 'enabled'
                ? { type: 'enabled', budget_tokens: 4096 }
                : { type: 'disabled' },
            stream: true,
          }),
        })
        if (!upstream.ok || !upstream.body) {
          const messages = {
            401: '服务端密钥无效，请联系服务提供者。',
            403: '当前服务没有模型访问权限，请检查 OpenCode Go 的地区与模型权限。',
            429: '服务繁忙或上游额度已用完，请稍后再试。',
          }
          return fail(
            res,
            upstream.status >= 400 ? upstream.status : 502,
            messages[upstream.status] || '聊天服务暂时不可用，请稍后重试。本次未扣费。'
          )
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        })
        const decoder = new TextDecoder()
        let buffer = ''
        let completed = false
        for await (const chunk of upstream.body) {
          buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n')
          let end
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const data = frame
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trimStart())
              .join('\n')
            let event
            try {
              event = JSON.parse(data)
            } catch {
              /* heartbeat */
            }
            if (event?.type === 'message_stop' && !completed) {
              completed = true
              account.cents -= 1
              account.requests[`chat:${requestId}`] = true
              account.entries.unshift({
                id: requestId,
                amount: -1,
                label: '对话（模拟计费）',
                at: Date.now(),
              })
              save()
            }
            res.write(`${frame}\n\n`)
          }
        }
        if (!completed && !res.destroyed)
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: { message: '连接中断，已保留收到的内容。本次未扣费。' } })}\n\n`
          )
        res.end()
      } catch {
        if (!res.destroyed) {
          if (res.headersSent) {
            res.write(
              'event: error\ndata: {"error":{"message":"连接中断，请稍后重试。本次未扣费。"}}\n\n'
            )
            res.end()
          } else fail(res, 502, '暂时无法连接聊天服务，请稍后重试。本次未扣费。')
        }
      } finally {
        clearTimeout(timeout)
        active.delete(accountId)
      }
    } catch {
      if (!res.headersSent) fail(res, 400, '请求处理失败，请检查输入后重试。')
      else res.end()
    }
  })
}
