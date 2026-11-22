import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconPanelLeftOutline16, IconSettingsOutline16, NewChatIcon } from '../base/icons.js'
import { setSiderCollapsed, useSettings } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import { newChat, removeSession, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { BrandMark } from '../base/BrandMark.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'
import { money, openWallet, refreshWallet, useWallet } from '../../services/wallet.js'
import { nativeApp } from '../../services/native.js'
import { openOfficialAccount } from '../../services/migration/native.js'

/** 展开的侧边栏：名称与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const connected = useSettings((state) => Boolean(state.apiKey))
  const cents = useWallet((state) => state.cents)
  const walletLoading = useWallet((state) => state.loading)
  const walletError = useWallet((state) => state.error)
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const groups = useMemo(() => groupSessions(sessions, now, t), [sessions, now, t])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.appName}>
          <BrandMark className="brand-symbol" /> {t('appName')}
        </div>
        <IconButton
          size="m"
          icon={<IconPanelLeftOutline16 />}
          tooltip={t('collapseSiderbarButton')}
          tooltipPlacement="bottom"
          onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
        />
      </div>
      <button
        type="button"
        className={styles.newChat}
        onClick={() => {
          newChat()
          closeMobileSider()
        }}
      >
        <span className={styles.newChatIcon}>
          <NewChatIcon />
        </span>
        {t('newChat')}
      </button>
      <button
        className="import-shortcut"
        onClick={() => {
          openSettings('data')
          closeMobileSider()
        }}
      >
        导入 DeepSeek 对话 <span>↗</span>
      </button>
      <div className={styles.listWrap}>
        <div className={styles.list}>
          {sessions.length === 0 ? (
            <p className="history-empty">
              故事，从一句话开始。
              <br />
              <span>你的对话会保存在这里。</span>
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>{group.label}</div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bottom}>
        <div className="wallet-row">
          <button className="wallet-shortcut" onClick={openWallet}>
            <span>
              账户余额
              <small>
                {nativeApp
                  ? connected
                    ? 'DeepSeek 官方余额'
                    : '未连接 · 点击登录'
                  : '体验版 · 模拟'}
              </small>
            </span>
            <strong>
              {nativeApp && !connected ? '登录' : `¥ ${cents === null ? '—' : money(cents)}`}
            </strong>
          </button>
          <button
            type="button"
            className="wallet-refresh"
            disabled={walletLoading}
            onClick={() => void refreshWallet({ interactive: true })}
            aria-label="刷新余额"
          >
            <span aria-hidden="true">↻</span>
            {walletLoading ? '更新中' : '刷新'}
          </button>
        </div>
        {walletError ? (
          <p className="wallet-error" role="status">
            {walletError}
          </p>
        ) : null}
        <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
          <span className={styles.settingsIcon}>
            <IconSettingsOutline16 />
          </span>
          <span className={styles.settingsLabel}>{t('settings')}</span>
        </button>
        {nativeApp ? (
          <button
            className="import-shortcut"
            onClick={() => void openOfficialAccount('https://platform.deepseek.com/usage')}
          >
            DeepSeek 官方充值 ↗
          </button>
        ) : null}
        <div className="brand-disclosure">独立第三方客户端 · 非 DeepSeek 官方</div>
      </div>
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
