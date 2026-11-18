import { useUpdates, deferUpdate, openProjectPage } from '../../services/updates.js'
import { useMigration } from '../../services/migration/store.js'
import { useWallet } from '../../services/wallet.js'
import { useChatStore } from '../../services/chat/store.js'
import { useSettingsDialog } from './settingsDialogState.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'

export const UpdateNotice = () => {
  const { release, prompt } = useUpdates()
  const settingsOpen = useSettingsDialog((s) => s.open)
  const migrating = useMigration((s) => s.busy)
  const wallet = useWallet()
  const ready = useChatStore((s) => s.ready)
  const streaming = useChatStore((s) => Object.keys(s.streaming).length > 0)
  if (
    !release ||
    !prompt ||
    settingsOpen ||
    migrating ||
    wallet.open ||
    wallet.loading ||
    !ready ||
    streaming
  ) {
    return null
  }
  return (
    <Modal
      title={`发现新版本 ${release.versionName}`}
      onClose={deferUpdate}
      footer={
        <>
          <Button variant="outlined" onClick={deferUpdate}>
            稍后再说
          </Button>
          <Button
            onClick={() => {
              void openProjectPage(release.releaseUrl)
                .then(deferUpdate)
                .catch(() => showToast('暂时无法打开下载页，请稍后重试。'))
            }}
          >
            前往更新
          </Button>
        </>
      }
    >
      <ul>
        {release.notes.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
      <p className="quiet-text">下载新版 APK 后，按手机提示安装即可。</p>
    </Modal>
  )
}
