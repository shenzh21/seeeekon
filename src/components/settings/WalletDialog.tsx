import { useRef, useState } from 'react'
import { closeWallet, money, topupWallet, useWallet, refreshWallet } from '../../services/wallet.js'
import { Modal } from '../base/Modal.js'
import { Button } from '../base/Button.js'
import { nativeApp } from '../../services/native.js'
import { openOfficialAccount } from '../../services/migration/native.js'

export const WalletDialog = () => {
  const wallet = useWallet()
  const [amount, setAmount] = useState(2000)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef<{ amount: number; id: string } | null>(null)
  const lock = useRef(false)
  if (!wallet.open) {
    return null
  }
  if (nativeApp) {
    return (
      <Modal title="DeepSeek 官方余额" closable onClose={closeWallet} className="wallet-dialog">
        <div className="wallet-hero">
          <span>可用余额 · 人民币</span>
          <strong>¥ {wallet.cents === null ? '—' : money(wallet.cents)}</strong>
        </div>
        <p className="quiet-text">充值与计费由 DeepSeek 官方处理。</p>
        <Button onClick={() => void openOfficialAccount('https://platform.deepseek.com/usage')}>
          前往官方充值
        </Button>
        <Button variant="outlined" onClick={() => void refreshWallet()}>
          刷新余额
        </Button>
        <p role="status">{wallet.error}</p>
      </Modal>
    )
  }
  return (
    <Modal title="账户余额" closable onClose={closeWallet} className="wallet-dialog">
      <div className="wallet-hero">
        <span>可用余额 · 人民币</span>
        <strong>¥ {wallet.cents === null ? '—' : money(wallet.cents)}</strong>
        <span className="prototype-badge">体验版 · 模拟账单</span>
      </div>
      <p className="quiet-text">
        这一版不收取真实款项。每条完整回复模拟扣费 ¥0.01，失败或中断不扣费；这不是正式服务价格。
      </p>
      <div className="topup-options">
        {[1000, 2000, 5000].map((value) => (
          <button
            key={value}
            aria-pressed={amount === value}
            disabled={busy}
            onClick={() => setAmount(value)}
          >
            ¥ {value / 100}
          </button>
        ))}
      </div>
      <Button
        disabled={busy || wallet.cents === null}
        onClick={async () => {
          if (lock.current) {
            return
          }
          lock.current = true
          setBusy(true)
          setNotice('')
          if (!pending.current || pending.current.amount !== amount) {
            pending.current = { amount, id: crypto.randomUUID() }
          }
          try {
            await topupWallet(amount, pending.current.id)
            pending.current = null
            setNotice(`已添加 ¥${money(amount)} 模拟余额`)
          } catch {
            setNotice('充值未完成，请重试。')
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        {busy ? '正在处理…' : `模拟充值 ¥${amount / 100}`}
      </Button>
      <p role="status" className="quiet-text">
        {notice || wallet.error || '独立第三方服务，非 DeepSeek 官方充值。'}
      </p>
      {wallet.error ? <Button onClick={() => void refreshWallet()}>重新加载</Button> : null}
      <h3 className="ledger-title">收支明细</h3>
      <div className="ledger">
        {wallet.entries.map((entry) => (
          <div key={entry.id}>
            <span>
              {entry.label}
              <small>{new Date(entry.at).toLocaleString('zh-CN')}</small>
            </span>
            <strong>
              {entry.amount > 0 ? '+' : '−'} ¥{money(Math.abs(entry.amount))}
            </strong>
          </div>
        ))}
      </div>
    </Modal>
  )
}
