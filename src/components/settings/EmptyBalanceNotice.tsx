import { useEffect, useState } from 'react'
import { nativeApp } from '../../services/native.js'
import { setSiderCollapsed, useSettings } from '../../services/settings.js'
import { useWallet } from '../../services/wallet.js'
import { useMigration } from '../../services/migration/store.js'
import { useSettingsDialog } from './settingsDialogState.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export const EmptyBalanceNotice = () => {
  const wallet = useWallet()
  const connected = useSettings((s) => Boolean(s.apiKey))
  const settingsOpen = useSettingsDialog((s) => s.open)
  const migrating = useMigration((s) => s.busy)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (wallet.cents !== null && wallet.cents > 0) {
      setDismissed(false)
    }
  }, [wallet.cents])
  if (
    !nativeApp ||
    !connected ||
    wallet.cents !== 0 ||
    wallet.loading ||
    wallet.error ||
    wallet.open ||
    settingsOpen ||
    migrating ||
    dismissed
  ) {
    return null
  }
  return (
    <Modal
      title="官方余额为 0"
      onClose={() => setDismissed(true)}
      footer={
        <>
          <Button variant="outlined" onClick={() => setDismissed(true)}>
            稍后再说
          </Button>
          <Button
            onClick={() => {
              setDismissed(true)
              setSiderCollapsed(false)
              openMobileSider()
            }}
          >
            打开侧栏
          </Button>
        </>
      }
    >
      <p>开始聊天前，请从侧栏点“DeepSeek 官方充值”。</p>
      <p className="quiet-text">充值直接在 DeepSeek 官方平台完成，Seekontinue 不收款。</p>
    </Modal>
  )
}
