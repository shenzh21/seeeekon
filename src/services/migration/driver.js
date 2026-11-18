// Shared by the development browser and the native WebView. No account/token APIs.
// Selectors verified against the official page on 2026-11-17; fail closed if it changes.
export function migrationStep() {
  if (location.origin !== 'https://chat.deepseek.com') {
    return { phase: 'login' }
  }
  const visible = (el) => {
    if (!(el instanceof HTMLElement) || !el.getClientRects().length) {
      return false
    }
    const rect = el.getBoundingClientRect()
    return (
      rect.right > 0 &&
      rect.left < innerWidth &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      getComputedStyle(el).visibility !== 'hidden'
    )
  }
  const exact = (text) =>
    [...document.querySelectorAll('button,[role="button"],span,div')].find(
      (el) =>
        visible(el) &&
        el.textContent?.trim() === text &&
        ![...el.children].some((c) => c.textContent?.trim() === text)
    )
  const press = (el) => {
    const target = el.closest('button,[role="button"],[tabindex]') || el
    if (target.getAttribute('aria-disabled') === 'true' || target.hasAttribute('disabled')) {
      return false
    }
    target.click()
    return true
  }
  if (location.pathname.startsWith('/sign_in')) {
    return { phase: 'login' }
  }
  const label = exact('导出所有历史对话')
  if (label) {
    const row = label.parentElement?.parentElement
    const buttons = [...(row?.querySelectorAll('button,[role="button"]') || [])].filter(visible)
    const download = buttons.find((el) => el.textContent?.trim() === '下载')
    if (download) {
      if (!window.__liubaiDownloadClicked) {
        window.__liubaiDownloadClicked = Date.now()
        press(download)
      }
      return { phase: 'downloading' }
    }
    const button = buttons.find((el) =>
      /^(导出|导出所有历史对话|重新导出)$/.test(el.textContent?.trim() || '')
    )
    if (button && !window.__liubaiExportClicked) {
      window.__liubaiExportClicked = true
      press(button)
    }
    const limited = exact('导出过于频繁，请稍后重试。')
    if (limited) {
      return { phase: 'error', message: 'DeepSeek 暂时限制了导出，请稍后重试。' }
    }
    return { phase: 'exporting' }
  }
  const data = exact('数据管理')
  if (data) {
    press(data)
    return { phase: 'preparing' }
  }
  const settings = exact('系统设置')
  if (settings) {
    press(settings)
    return { phase: 'preparing' }
  }
  // Account trigger is unlabelled; this observed class is deliberately narrow.
  const account = document.querySelector('div._2afd28d[tabindex="0"]')
  if (account && visible(account)) {
    press(account)
    return { phase: 'preparing' }
  }
  const menuIcon = document.querySelector('div[role="button"] svg path[d^="M17.2027 4.90034"]')
  const menu = menuIcon?.closest('div[role="button"]')
  if (menu && visible(menu)) {
    press(menu)
    return { phase: 'preparing' }
  }
  return { phase: 'login' }
}

export const isNewArchive = (name) => /^deepseek_data-[^/\\]+\.zip$/i.test(name)

// A visual layer on the official page, not a hidden or background WebView.
// Shadow DOM keeps its controls/styles out of the official selectors.
export function renderMigrationOverlay(phase, message) {
  if (!['https://chat.deepseek.com', 'https://platform.deepseek.com'].includes(location.origin)) {
    return
  }
  const id = 'seekontinue-migration-overlay'
  let host = document.getElementById(id)
  if (phase === 'login' || phase === 'error') {
    host?.remove()
    return
  }
  if (!document.body) {
    return
  }
  if (!host) {
    host = document.createElement('div')
    host.id = id
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:block;'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>
      :host{font-family:system-ui,sans-serif;color:#243b36;color-scheme:light}
      .mask{position:absolute;inset:0;background:rgba(25,38,34,.32);display:grid;place-items:center;padding:24px;touch-action:none}
      .card{box-sizing:border-box;width:min(100%,320px);background:#fff;border-radius:24px;padding:30px 24px 24px;text-align:center;box-shadow:0 8px 40px #0002}
      .spinner{width:30px;height:30px;border:3px solid #62877c30;border-top-color:#62877c;border-radius:50%;margin:0 auto 22px;animation:spin 1s linear infinite}
      h2{font-size:18px;font-weight:600;margin:0 0 12px}p{font-size:13px;color:#6b7773;margin:0 0 24px}
      button{font:inherit;font-size:14px;color:#365d55;border:1px solid #d9e2df;border-radius:20px;background:#fff;padding:9px 22px;cursor:pointer}
      @keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
      </style><div class="mask"><section class="card" role="dialog" aria-modal="true" aria-label="正在自动处理">
      <div class="spinner" aria-hidden="true"></div><h2 role="status" aria-live="polite"></h2>
      <p>无需操作，请稍候</p><button type="button">取消</button></section></div>`
    root.querySelector('button').onclick = () =>
      window.mobileApp?.postMessage({ detail: { kind: 'cancel' } })
    host.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        root.querySelector('button').focus({ preventScroll: true })
      }
      event.stopPropagation()
    })
    document.body.appendChild(host)
    root.querySelector('button').focus({ preventScroll: true })
  }
  host.shadowRoot.querySelector('h2').textContent = message
}
