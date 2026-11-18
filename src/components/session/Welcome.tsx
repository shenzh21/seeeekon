import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

/** 新对话：问候语 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className="welcome-intro">
          <div className="welcome-mark" aria-hidden>
            ◒
          </div>
          <div className={styles.greeting}>让对话，继续。</div>
          <p>熟悉的回应，值得好好延续。</p>
        </div>
        <ChatInput sessionId={null} />
        <div className="welcome-footer">{t('contentCaveat')}</div>
      </div>
    </div>
  )
}
