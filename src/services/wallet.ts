import { create } from 'zustand'
import { nativeApp, nativeFetch } from './native.js'
import { useSettings } from './settings.js'
import { ensureApiKey } from '../components/settings/settingsDialogState.js'

export type WalletEntry = { id: string; amount: number; label: string; at: number }
type Wallet = {
  cents: number | null
  entries: WalletEntry[]
  open: boolean
  error: string | null
  loading: boolean
}
export const useWallet = create<Wallet>(() => ({
  cents: null,
  entries: [],
  open: false,
  error: null,
  loading: false,
}))
export const money = (cents: number) => (cents / 100).toFixed(2)
export const refreshWallet = async ({ interactive = false } = {}) => {
  if (nativeApp && interactive && !ensureApiKey()) {
    useWallet.setState({ open: false, cents: null, entries: [], error: null })
    return
  }
  if (useWallet.getState().loading) {
    return
  }
  useWallet.setState({ loading: true })
  try {
    if (nativeApp) {
      const apiKey = useSettings.getState().apiKey
      if (!apiKey) {
        useWallet.setState({ cents: null, entries: [], error: null })
        return
      }
      const response = await nativeFetch('https://api.deepseek.com/user/balance')
      if (!response.ok) {
        throw new Error('官方余额暂时无法加载')
      }
      const data = await response.json()
      const balance = data.balance_infos?.find(
        (item: { currency: string }) => item.currency === 'CNY'
      )
      if (!balance) {
        throw new Error('当前账户未返回人民币余额')
      }
      useWallet.setState({
        cents: Math.round(Number(balance.total_balance) * 100),
        entries: [],
        error: null,
      })
      return
    }
    const response = await fetch('/api/wallet')
    if (!response.ok) {
      throw new Error('余额暂时无法加载')
    }
    const data = await response.json()
    useWallet.setState({ cents: data.cents, entries: data.entries, error: null })
  } catch {
    useWallet.setState({ error: '余额暂时无法加载，请重试。' })
  } finally {
    useWallet.setState({ loading: false })
  }
}
export const openWallet = () => {
  if (nativeApp && !ensureApiKey()) {
    useWallet.setState({ open: false, cents: null, entries: [], error: null })
    return
  }
  useWallet.setState({ open: true })
  void refreshWallet()
}
export const closeWallet = () => useWallet.setState({ open: false })
export const topupWallet = async (amount: number, requestId: string) => {
  if (nativeApp) {
    throw new Error('请前往 DeepSeek 官方账户充值')
  }
  const response = await fetch('/api/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, requestId }),
  })
  if (!response.ok) {
    throw new Error('充值未完成，请重试。')
  }
  const data = await response.json()
  useWallet.setState({ cents: data.cents, entries: data.entries, error: null })
}
