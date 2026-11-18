import { useState } from 'react'
import { setApiKey, useSettings } from '../../services/settings.js'
import { nativeApp } from '../../services/native.js'
import { cancelMigration, runMigration, useMigration } from '../../services/migration/store.js'
import { openOfficialAccount } from '../../services/migration/native.js'
import { useWallet } from '../../services/wallet.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export const DeepSeekConnection = ({
  history = false,
  disabled = false,
}: {
  history?: boolean
  disabled?: boolean
}) => {
  const connected = useSettings((s) => Boolean(s.apiKey))
  const task = useMigration()
  const [consent, setConsent] = useState(false)
  const [notice, setNotice] = useState('')
  if (!nativeApp) {
    return null
  }
  return (
    <section className="connection-card">
      <h3>{history ? '把旧对话带过来' : connected ? '已连接 DeepSeek' : '让对话，继续。'}</h3>
      <p className="quiet-text">
        {history
          ? '登录聊天网站，剩下的自动完成。已有对话保留。'
          : '使用你的 DeepSeek 账户与官方余额。'}
      </p>
      {!history && !connected ? <LoginSteps /> : null}
      <div className="connection-actions">
        {history ? (
          <Button disabled={disabled || task.busy} onClick={() => void runMigration('history')}>
            登录并导入对话
          </Button>
        ) : (
          <Button disabled={task.busy} onClick={() => setConsent(true)}>
            {connected ? '重新连接账户' : '连接 DeepSeek'}
          </Button>
        )}
        {!history && connected ? (
          <Button
            variant="outlined"
            disabled={task.busy}
            onClick={() => void openOfficialAccount('https://platform.deepseek.com/usage')}
          >
            官方账户与充值
          </Button>
        ) : null}
        {task.busy && !task.importing ? (
          <Button variant="outlined" onClick={cancelMigration}>
            取消
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="quiet-text">
        {notice || task.message}
      </p>
      {!history && connected ? (
        <Button
          variant="outlined"
          disabled={task.busy}
          onClick={async () => {
            try {
              await setApiKey(null)
              useWallet.setState({ cents: null, entries: [] })
              setNotice('已移除本机密钥。官方密钥仍可在官方账户中撤销；对话保留在本机。')
            } catch {
              setNotice('断开失败，请重试。')
            }
          }}
        >
          断开本机连接
        </Button>
      ) : null}
      {consent ? (
        <Modal
          title="连接你的 DeepSeek 账户"
          onClose={() => setConsent(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConsent(false)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  setConsent(false)
                  setNotice('')
                  void runMigration('connect')
                }}
              >
                同意并连接
              </Button>
            </>
          }
        >
          <LoginSteps />
          <p className="quiet-text">
            将创建本机专用 API 密钥。历史对话可选导入，聊天使用官方余额。
          </p>
          <p className="quiet-text">独立第三方客户端 · 非 DeepSeek 官方</p>
        </Modal>
      ) : null}
    </section>
  )
}

const LoginSteps = () => (
  <div className="login-guide">
    <div className="login-steps" aria-label="登录步骤">
      <div>
        <span aria-hidden="true">①</span>
        <strong>登录开放平台</strong>
        <small>连接账户</small>
      </div>
      <span aria-hidden="true">→</span>
      <div>
        <span aria-hidden="true">②</span>
        <strong>登录聊天网站</strong>
        <small>导入对话 · 可跳过</small>
      </div>
    </div>
    <p className="quiet-text">导入历史需再登录一次，请使用同一账号。</p>
  </div>
)
