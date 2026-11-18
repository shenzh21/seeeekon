import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export const nativeApp = Capacitor.isNativePlatform()
export const KeyVault = registerPlugin<{
  get(): Promise<{ connected: boolean }>
  set(options: { value: string }): Promise<void>
  remove(): Promise<void>
  request(options: {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }): Promise<void>
  cancel(options: { id: string }): Promise<void>
  addListener(
    name: 'http',
    listener: (event: {
      id: string
      type: string
      status?: number
      contentType?: string
      data?: string
    }) => void
  ): Promise<PluginListenerHandle>
}>('KeyVault')

/** Preserve the upstream streaming Response API; credentials never enter the web bundle. */
export async function nativeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (new URL(url).origin !== 'https://api.deepseek.com') {
    throw new Error('仅支持 DeepSeek 官方 API')
  }
  return deviceFetch(url, init)
}

async function deviceFetch(url: string, init: RequestInit): Promise<Response> {
  const id = crypto.randomUUID()
  const headers = new Headers(init.headers)
  let body: string | undefined
  if (init.body != null) {
    const encoded = new Response(init.body)
    const contentType = encoded.headers.get('content-type')
    if (!headers.has('content-type') && contentType) {
      headers.set('content-type', contentType)
    }
    const bytes = new Uint8Array(await encoded.arrayBuffer())
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    body = btoa(binary)
  }
  init.signal?.throwIfAborted()
  return new Promise<Response>((resolve, reject) => {
    let listener: PluginListenerHandle | undefined
    let stream: ReadableStreamDefaultController<Uint8Array>
    let ended = false
    const finish = (error?: Error) => {
      if (ended) {
        return
      }
      ended = true
      init.signal?.removeEventListener('abort', abort)
      void listener?.remove()
      if (error) {
        stream?.error(error)
        reject(error)
      } else {
        stream?.close()
      }
    }
    const abort = () => {
      void KeyVault.cancel({ id })
      finish(new DOMException('已取消', 'AbortError'))
    }
    const readable = new ReadableStream<Uint8Array>({
      start(c) {
        stream = c
      },
      cancel() {
        abort()
      },
    })
    const start = async () => {
      listener = await KeyVault.addListener('http', (event) => {
        if (event.id !== id || ended) {
          return
        }
        if (event.type === 'headers') {
          const status = event.status || 502
          resolve(
            new Response([204, 205, 304].includes(status) ? null : readable, {
              status,
              headers: {
                'Content-Type': event.contentType || '',
              },
            })
          )
        } else if (event.type === 'chunk' && event.data) {
          stream.enqueue(Uint8Array.from(atob(event.data), (c) => c.charCodeAt(0)))
        } else if (event.type === 'end') {
          finish()
        } else if (event.type === 'error') {
          finish(new Error('连接 DeepSeek 失败，请检查网络或重新连接账户。'))
        }
      })
      init.signal?.addEventListener('abort', abort, { once: true })
      if (init.signal?.aborted) {
        abort()
        return
      }
      await KeyVault.request({
        id,
        url,
        method: init.method || 'GET',
        headers: Object.fromEntries(headers.entries()),
        body,
      })
    }
    void start().catch(finish)
  })
}
