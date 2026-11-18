import { useState } from 'react'
import { setApiOrigin, setServiceMode, useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
export const ServiceSettings = () => {
  const mode = useSettings((s) => s.serviceMode)
  const origin = useSettings((s) => s.apiOrigin)
  const [value, setValue] = useState(origin)
  const [error, setError] = useState('')
  return (
    <div className="service-settings">
      <h3>API 服务</h3>
      <p className="quiet-text">默认服务开箱即用。自备接口不会扣除这里的余额，聊天记录保持不变。</p>
      <label>
        <input
          type="radio"
          checked={mode === 'managed'}
          onChange={() => setServiceMode('managed')}
        />{' '}
        默认服务
      </label>
      <label>
        <input type="radio" checked={mode === 'custom'} onChange={() => setServiceMode('custom')} />{' '}
        自备 API（高级）
      </label>
      {mode === 'custom' ? (
        <>
          <p className="quiet-text">
            需兼容 DeepSeek Anthropic Messages
            API。密钥仅保存在本机；聊天将发送到你填写的服务。其他服务不保证支持搜索、文件与语音。
          </p>
          <label>
            服务地址
            <input
              className="service-origin"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://api.deepseek.com"
            />
          </label>
          <Button
            onClick={() => {
              try {
                const url = new URL(value)
                if (
                  url.protocol !== 'https:' ||
                  url.username ||
                  url.password ||
                  url.search ||
                  url.hash
                ) {
                  throw new Error()
                }
                setApiOrigin(value)
                setError('已保存服务地址')
              } catch {
                setError('请输入不含账号、查询参数的 HTTPS 服务地址')
              }
            }}
          >
            保存地址
          </Button>
          <p role="status">{error}</p>
        </>
      ) : (
        <p className="quiet-text">
          预览阶段使用 OpenCode Go 的 DeepSeek V4.1 Flash。搜索、附件和语音尚未接入。
        </p>
      )}
      <Button
        variant="outlined"
        onClick={() => {
          setServiceMode('managed')
          setApiOrigin('https://api.deepseek.com')
          setValue('https://api.deepseek.com')
          setError('已恢复默认服务')
        }}
      >
        恢复默认服务
      </Button>
    </div>
  )
}
