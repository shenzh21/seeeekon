import { useEffect } from 'react'
import { chooseHistoryImport, useMigration } from '../../services/migration/store.js'
import { closeSettings } from './settingsDialogState.js'
import { newChat } from '../../services/chat/store.js'
import { closeMobileSider } from '../sider/mobileSiderState.js'
import { Modal } from '../base/Modal.js'
import { Button } from '../base/Button.js'

export const MigrationProgress = () => {
  const task = useMigration()
  useEffect(() => {
    if (task.completed > 0) {
      closeSettings()
      newChat()
      closeMobileSider()
    }
  }, [task.completed])
  if (task.awaitingImport) {
    return (
      <Modal
        title="要带回以前的对话吗？"
        onClose={() => chooseHistoryImport(false)}
        footer={
          <>
            <Button variant="outlined" onClick={() => chooseHistoryImport(false)}>
              暂不导入
            </Button>
            <Button onClick={() => chooseHistoryImport(true)}>导入对话</Button>
          </>
        }
      >
        <p>再登录一次 DeepSeek 聊天网站，即可自动导入。</p>
        <p className="quiet-text">也可以稍后从侧栏或设置中导入。</p>
      </Modal>
    )
  }
  // Official-page automation has its own overlay in the foreground WebView.
  if (!task.busy || !task.importing) {
    return null
  }
  return (
    <Modal title="请稍候" onClose={() => {}} className="migration-progress">
      <div className="migration-spinner" aria-hidden="true" />
      <p role="status" aria-live="polite">
        {task.message}
      </p>
      <p className="quiet-text">正在自动处理，无需操作</p>
    </Modal>
  )
}
