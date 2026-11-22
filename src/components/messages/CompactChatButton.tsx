import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { compactToNewChat } from '../../services/chat/store.js'
import { Button } from '../base/Button.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'

export function CompactChatButton({ sessionId, replyId }: { sessionId: string; replyId: string }) {
  const t = useTranslate()
  const task = useRef<AbortController | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => task.current?.abort(), [sessionId, replyId])
  const start = async () => {
    if (task.current || !ensureApiKey()) {
      return
    }
    const controller = new AbortController()
    task.current = controller
    setWorking(true)
    setError('')
    try {
      await compactToNewChat(sessionId, replyId, controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error && cause.message ? cause.message : t('compactIncomplete'))
      }
    } finally {
      controller.abort()
      task.current = null
      setWorking(false)
    }
  }
  return (
    <div>
      <p>{t('compactHint')}</p>
      <Button variant="outlined" size="s" disabled={working} onClick={() => void start()}>
        {t(working ? 'compactWorking' : 'compactChat')}
      </Button>
      {working && (
        <Button variant="outlined" size="s" onClick={() => task.current?.abort()}>
          {t('cancel')}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
