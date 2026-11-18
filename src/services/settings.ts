import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { KeyVault, nativeApp } from './native.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态 */
type Settings = {
  serviceMode: 'managed' | 'custom'
  apiOrigin: string
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
  updateCheckedAt: number
  updateDeferred: string
}

const KEYS = {
  serviceMode: 'chat-demo:service-mode',
  apiOrigin: 'chat-demo:api-origin',
  apiKey: 'chat-demo:api-key',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
  updateCheckedAt: 'chat-demo:update-checked-at',
  updateDeferred: 'chat-demo:update-deferred',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

export const useSettings = create<Settings>(() => ({
  serviceMode: nativeApp ? 'custom' : read(KEYS.serviceMode) === 'custom' ? 'custom' : 'managed',
  apiOrigin: nativeApp
    ? 'https://api.deepseek.com'
    : read(KEYS.apiOrigin) || 'https://api.deepseek.com',
  apiKey: nativeApp ? null : read(KEYS.apiKey),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
  updateCheckedAt: Number(read(KEYS.updateCheckedAt)) || 0,
  updateDeferred: read(KEYS.updateDeferred) || '',
}))

export const setUpdateCheckedAt = (time: number) => {
  write(KEYS.updateCheckedAt, String(time))
  useSettings.setState({ updateCheckedAt: time })
}

export const setUpdateDeferred = (value: string) => {
  write(KEYS.updateDeferred, value || null)
  useSettings.setState({ updateDeferred: value })
}

export const setServiceMode = (serviceMode: Settings['serviceMode']) => {
  if (nativeApp) {
    return
  }
  write(KEYS.serviceMode, serviceMode)
  useSettings.setState({ serviceMode })
}
export const setApiOrigin = (apiOrigin: string) => {
  if (nativeApp) {
    return
  }
  write(KEYS.apiOrigin, apiOrigin.replace(/\/$/, ''))
  useSettings.setState({ apiOrigin: apiOrigin.replace(/\/$/, '') })
}

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = async (apiKey: string | null) => {
  if (nativeApp) {
    if (apiKey) {
      await KeyVault.set({ value: apiKey })
    } else {
      await KeyVault.remove()
    }
    write(KEYS.apiKey, null)
  } else {
    write(KEYS.apiKey, apiKey)
  }
  useSettings.setState({ apiKey: nativeApp && apiKey ? 'device-key' : apiKey })
}

export const loadNativeCredential = async () => {
  if (!nativeApp) {
    return
  }
  write(KEYS.apiKey, null)
  const { connected } = await KeyVault.get()
  useSettings.setState({ apiKey: connected ? 'device-key' : null })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
