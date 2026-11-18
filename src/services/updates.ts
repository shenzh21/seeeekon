import { create } from 'zustand'
import { InAppBrowser } from '@capgo/capacitor-inappbrowser'
import { notices } from '../generated/notices.js'
import { nativeApp } from './native.js'
import { setUpdateCheckedAt, setUpdateDeferred, useSettings } from './settings.js'

export const PROJECT_URL = 'https://github.com/shenzh21/seeeekon'
export const DOWNLOAD_URL = 'https://shenzh21.github.io/seeeekon/'
const MANIFEST_URL = `${DOWNLOAD_URL}latest.json`
const CHECK_INTERVAL = 6 * 60 * 60 * 1000
type Release = {
  schema: 1
  appId: 'app.liubai.chat'
  versionCode: number
  versionName: string
  releaseUrl: string
  downloadUrl: string
  sha256: string
  notes: string[]
}

export const useUpdates = create(() => ({
  loading: false,
  checked: false,
  error: '',
  release: null as Release | null,
  prompt: false,
}))

function parseRelease(value: unknown): Release {
  const r = value as Release | null
  if (
    !r ||
    r.schema !== 1 ||
    r.appId !== 'app.liubai.chat' ||
    !Number.isSafeInteger(r.versionCode) ||
    r.versionCode <= 0 ||
    typeof r.versionName !== 'string' ||
    !/^[\w.-]{1,40}$/.test(r.versionName) ||
    r.releaseUrl !== `${PROJECT_URL}/releases/tag/v${r.versionName}` ||
    r.downloadUrl !==
      `${PROJECT_URL}/releases/download/v${r.versionName}/seeeekon-${r.versionName}.apk` ||
    typeof r.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(r.sha256) ||
    !Array.isArray(r.notes) ||
    r.notes.length > 12 ||
    !r.notes.every((n) => typeof n === 'string' && n.length <= 300)
  ) {
    throw new Error('Invalid release manifest')
  }
  return r
}

export async function checkForUpdates(manual = false) {
  if (useUpdates.getState().loading) {
    return
  }
  const now = Date.now()
  const last = useSettings.getState().updateCheckedAt
  if (!manual && (!nativeApp || (now >= last && now - last < CHECK_INTERVAL))) {
    return
  }
  setUpdateCheckedAt(now)
  useUpdates.setState({ loading: true, error: '', prompt: false })
  try {
    // Public metadata only: no DeepSeek credentials, cookies or device identifier.
    const response = await fetch(MANIFEST_URL, {
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      throw new Error('Update service unavailable')
    }
    const text = await response.text()
    if (text.length > 16000) {
      throw new Error('Manifest too large')
    }
    const release = parseRelease(JSON.parse(text))
    const newer = release.versionCode > notices.versionCode ? release : null
    const [deferredCode, deferredUntil] = useSettings
      .getState()
      .updateDeferred.split(':')
      .map(Number)
    const deferred = release.versionCode === deferredCode && now < deferredUntil
    useUpdates.setState({
      checked: true,
      release: newer,
      prompt: Boolean(newer && !manual && !deferred),
    })
  } catch {
    useUpdates.setState({ checked: false, error: '暂时无法检查更新，请稍后重试，或打开下载主页。' })
  } finally {
    useUpdates.setState({ loading: false })
  }
}

export function deferUpdate() {
  const code = useUpdates.getState().release?.versionCode
  if (code) {
    setUpdateDeferred(`${code}:${Date.now() + 24 * 60 * 60 * 1000}`)
  }
  useUpdates.setState({ prompt: false })
}

export async function openProjectPage(url: string) {
  const release = useUpdates.getState().release
  if (![PROJECT_URL, DOWNLOAD_URL, release?.releaseUrl].includes(url)) {
    return
  }
  if (nativeApp) {
    // Existing plugin uses Android Custom Tabs, separate from the official login WebView.
    await InAppBrowser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function bindUpdateChecks() {
  if (!nativeApp) {
    return
  }
  const check = () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdates()
    }
  }
  check()
  document.addEventListener('visibilitychange', check)
  return () => document.removeEventListener('visibilitychange', check)
}
