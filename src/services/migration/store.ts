import { create } from 'zustand'
import { importHistory } from '../chat/backup.js'
import { setApiKey, useSettings } from '../settings.js'
import { refreshWallet } from '../wallet.js'
import { createOfficialCredential, downloadOfficialHistory } from './native.js'

export const useMigration = create(() => ({
  busy: false,
  importing: false,
  automatic: false,
  message: '',
  error: false,
  awaitingImport: false,
  completed: 0,
}))
let controller: AbortController | undefined
let importChoice: ((value: boolean) => void) | undefined
export const chooseHistoryImport = (value: boolean) => importChoice?.(value)
export const cancelMigration = () => {
  if (!useMigration.getState().importing) {
    controller?.abort()
  }
}
export async function runMigration(kind: 'connect' | 'history') {
  if (useMigration.getState().busy) {
    return
  }
  controller = new AbortController()
  const signal = controller.signal
  useMigration.setState({ busy: true, automatic: true, error: false, message: '正在打开登录页面' })
  const progress = (message: string, automatic = true) =>
    useMigration.setState({ message, automatic })
  try {
    if (kind === 'connect') {
      const key = await createOfficialCredential(signal, progress)
      signal.throwIfAborted()
      await setApiKey(key)
      await refreshWallet()
      useMigration.setState({ awaitingImport: true, automatic: false, message: '账户已连接' })
      const shouldImport = await new Promise<boolean>((resolve) => {
        const abort = () => finish(false)
        const finish = (value: boolean) => {
          signal.removeEventListener('abort', abort)
          importChoice = undefined
          useMigration.setState({ awaitingImport: false })
          resolve(value)
        }
        importChoice = finish
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) {
          finish(false)
        }
      })
      signal.throwIfAborted()
      if (!shouldImport) {
        useMigration.setState((state) => ({ completed: state.completed + 1 }))
        return
      }
    }
    const file = await downloadOfficialHistory(signal, progress)
    signal.throwIfAborted()
    useMigration.setState({ importing: true, automatic: true, message: '正在整理对话' })
    const count = await importHistory(file)
    progress(`导入完成，现在共有 ${count} 个对话。`)
    useMigration.setState((state) => ({ completed: state.completed + 1 }))
  } catch (error) {
    useMigration.setState({
      error: !signal.aborted && !(error instanceof Error && error.name === 'AbortError'),
      message:
        signal.aborted || (error instanceof Error && error.name === 'AbortError')
          ? useSettings.getState().apiKey
            ? '已取消导入，账户仍已连接。'
            : '已取消，可随时重试。'
          : error instanceof Error
            ? error.message
            : '连接未完成，请重试。',
    })
  } finally {
    controller = undefined
    useMigration.setState({
      busy: false,
      importing: false,
      automatic: false,
      awaitingImport: false,
    })
  }
}
