import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { InAppBrowser } from '@capgo/capacitor-inappbrowser'
import { isNewArchive, migrationStep, renderMigrationOverlay } from './driver.js'

type Progress = (message: string, automatic?: boolean) => void
const stages: Record<string, string> = {
  login: '请用同一账号登录聊天网站',
  preparing: '正在准备导入',
  exporting: '正在等待 DeepSeek 导出',
  downloading: '正在接收对话',
}

/** Executes bundled code locally. Remote pages receive no host app APIs or API key. */
async function webTask<T>(options: {
  url: string
  title: string
  code: string
  signal: AbortSignal
  onMessage: (
    data: Record<string, unknown>,
    complete: (value: T) => void,
    fail: (error: Error) => void
  ) => void
  onDownload?: (
    event: { fileName: string; localUrl: string },
    complete: (value: T) => void
  ) => Promise<void>
}): Promise<T> {
  const listeners: PluginListenerHandle[] = []
  let id: string | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let injecting = false
  let abort = () => {}
  let setupFinished: Promise<void> | undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      const complete = (value: T) => {
        if (!settled) {
          settled = true
          resolve(value)
        }
      }
      const fail = (error: Error) => {
        if (!settled) {
          settled = true
          reject(error)
        }
      }
      abort = () => fail(new DOMException('已取消', 'AbortError'))
      const setup = async () => {
        options.signal.addEventListener('abort', abort, { once: true })
        if (options.signal.aborted) {
          abort()
          return
        }
        listeners.push(
          await InAppBrowser.addListener('messageFromWebview', (event) => {
            if (!id || event.id !== id || settled || !event.detail) {
              return
            }
            if (event.detail.kind === 'cancel') {
              fail(new DOMException('已取消', 'AbortError'))
              return
            }
            options.onMessage(event.detail, complete, fail)
          })
        )
        listeners.push(
          await InAppBrowser.addListener('closeEvent', (event) => {
            if (id && event.id === id) {
              fail(new DOMException('已关闭官方页面', 'AbortError'))
            }
          })
        )
        if (options.onDownload) {
          listeners.push(
            await InAppBrowser.addListener('downloadCompleted', (event) => {
              if (id && event.id === id && !settled && options.onDownload) {
                void options
                  .onDownload(event, complete)
                  .catch((error) =>
                    fail(error instanceof Error ? error : new Error('无法读取下载文件。'))
                  )
              }
            })
          )
          listeners.push(
            await InAppBrowser.addListener('downloadFailed', (event) => {
              if (id && event.id === id && (!event.fileName || isNewArchive(event.fileName))) {
                fail(new Error('归档下载失败，请重试。'))
              }
            })
          )
        }
        const opened = await InAppBrowser.openWebView({
          url: options.url,
          title: options.title,
          visibleTitle: true,
          javascriptBridgeOrigins: [new URL(options.url).origin],
          handleDownloads: Boolean(options.onDownload),
          persistWebViewData: true,
          allowScreenshotsFromWebPage: false,
          captureConsoleLogs: false,
          isInspectable: false,
        })
        id = opened.id
        if (settled) {
          await InAppBrowser.close({ id })
          return
        }
        const inject = async () => {
          if (!id || settled || injecting) {
            return
          }
          injecting = true
          try {
            await InAppBrowser.executeScript({
              id,
              code: `(() => {
              const report = (phase, message) => {
                (${renderMigrationOverlay.toString()})(phase, message);
                window.mobileApp?.postMessage({detail:{kind:'progress',phase,message}});
              };
              ${options.code}
            })();`,
            })
          } catch {
            /* A navigation invalidates one injection; retry on the next tick. */
          } finally {
            injecting = false
          }
        }
        timer = setInterval(() => void inject(), 1000)
        timeout = setTimeout(() => fail(new Error('等待时间过长，请重新连接后重试。')), 20 * 60_000)
        void inject()
      }
      setupFinished = setup().catch(() => fail(new Error('无法打开官方页面，请稍后重试。')))
    })
  } finally {
    settled = true
    await setupFinished
    clearInterval(timer)
    clearTimeout(timeout)
    options.signal.removeEventListener('abort', abort)
    await Promise.allSettled(listeners.map((listener) => listener.remove()))
    if (id) {
      await InAppBrowser.close({ id }).catch(() => {})
    }
  }
}

export async function downloadOfficialHistory(
  signal: AbortSignal,
  progress: Progress
): Promise<File> {
  return webTask<File>({
    url: 'https://chat.deepseek.com/',
    title: '② 登录聊天网站 · 使用同一账号',
    signal,
    code: `if(location.origin === 'https://chat.deepseek.com') {
      const state = (${migrationStep.toString()})();
      report(state.phase, state.message || (${JSON.stringify(stages)})[state.phase] || '正在导入对话');
    }`,
    onMessage: (data, _complete, fail) => {
      if (data.kind === 'progress') {
        if (data.phase === 'error') {
          fail(new Error(String(data.message)))
          return
        }
        progress(stages[String(data.phase)] || '正在导入对话', data.phase !== 'login')
      }
    },
    onDownload: async (event, complete) => {
      if (!isNewArchive(event.fileName)) {
        return
      }
      if (!event.localUrl.startsWith('file://')) {
        throw new Error('归档地址无效')
      }
      const response = await fetch(Capacitor.convertFileSrc(event.localUrl), { signal })
      if (!response.ok) {
        throw new Error('无法读取下载文件，请重试。')
      }
      const blob = await response.blob()
      if (!blob.size || blob.size > 256 * 1024 * 1024) {
        throw new Error('归档无效或超过 256 MB')
      }
      complete(new File([blob], event.fileName, { type: 'application/zip' }))
    },
  })
}

/** Run only after the user explicitly chooses to create a dedicated paid API connection. */
export async function createOfficialCredential(
  signal: AbortSignal,
  progress: Progress
): Promise<string> {
  progress('正在打开登录页面')
  return webTask<string>({
    url: 'https://platform.deepseek.com/api_keys',
    title: '① 登录开放平台 · 登录后自动继续',
    signal,
    code: `if(location.origin === 'https://platform.deepseek.com') {
      const visible = el => el.getClientRects().length > 0;
      const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
      const ready = location.pathname === '/api_keys' && (window.__liubaiCreated || document.querySelector('input[placeholder="输入 API key 的名称"]') || buttons.some(el=>el.textContent.trim() === '创建 API key'));
      report(ready ? 'preparing' : 'login', '正在连接账户');
      const click = text => buttons.find(el => el.textContent.trim() === text)?.click();
      const later = buttons.find(el=>el.textContent.trim() === '稍后再填');
      if(later) later.click();
      if(location.pathname === '/usage') location.href = 'https://platform.deepseek.com/api_keys';
      if(location.pathname === '/api_keys') {
        if(window.__liubaiCreated) {
          if(Date.now() - window.__liubaiCreated > 60000) {
            window.mobileApp?.postMessage({detail:{kind:'error'}});
          }
          const candidates = [...document.querySelectorAll('input,textarea,code,span,div')].filter(visible);
          for(const el of candidates) {
            const text = ('value' in el ? el.value : el.textContent || '').trim();
            if(/^sk-[A-Za-z0-9_-]{16,200}$/.test(text)) {
              window.mobileApp?.postMessage({detail:{kind:'key',value:text}}); break;
            }
          }
        } else {
          const input = document.querySelector('input[placeholder="输入 API key 的名称"]');
          if(input) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            setter.call(input, 'seeeekon Android'); input.dispatchEvent(new Event('input',{bubbles:true}));
            if(!window.__liubaiNameFilled) window.__liubaiNameFilled = Date.now();
            if(Date.now()-window.__liubaiNameFilled > 1000) {
              const create = buttons.find(el=>el.textContent.trim() === '创建');
              if(create && create.getAttribute('aria-disabled') !== 'true' && !create.disabled) {
                window.__liubaiCreated = Date.now(); create.click();
              }
            }
          } else click('创建 API key');
        }
      }
    }`,
    onMessage: (data, complete, fail) => {
      if (data.kind === 'progress') {
        progress(data.phase === 'login' ? '请登录开放平台' : '正在连接账户', data.phase !== 'login')
      }
      if (data.kind === 'error') {
        fail(new Error('未能接收新密钥。重试前可在官方平台撤销未使用的“seeeekon Android”密钥。'))
      }
      if (
        data.kind === 'key' &&
        typeof data.value === 'string' &&
        /^sk-[A-Za-z0-9_-]{16,200}$/.test(data.value)
      ) {
        complete(data.value)
      }
    },
  })
}

export async function openOfficialAccount(
  url: 'https://platform.deepseek.com/usage' | 'https://platform.deepseek.com/api_keys'
) {
  await InAppBrowser.openWebView({
    url,
    title: 'DeepSeek 官方账户',
    javascriptBridgeOrigins: [],
    visibleTitle: true,
  })
}
