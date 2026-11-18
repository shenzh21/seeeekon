import { useState } from 'react'
import { notices } from '../../generated/notices.js'
import { nativeApp } from '../../services/native.js'

export const AboutApp = () => {
  const [filter, setFilter] = useState('')
  return (
    <section className="about-app">
      <h3>Seekontinue</h3>
      <p className="quiet-text">版本 {notices.version}</p>
      <p>使用自己的 DeepSeek 账户聊天、导入历史的独立第三方客户端，与 DeepSeek 官方无隶属关系。</p>
      <p>{nativeApp
        ? '聊天与余额请求直接发送至 DeepSeek，充值由官方处理。连接密钥加密保存在设备上，对话保存在本机。卸载会清除本地数据，请先在数据管理中导出备份。'
        : '网页预览的服务配置与 Android 版不同，以设置中选择的服务为准。对话保存在当前浏览器中，请在数据管理中导出备份。'}</p>
      <h4>开源与许可</h4>
      <p>
        基于 DeepSeek 官方开源 chat-demo 修改，保留其版权及 MIT 许可证。各依赖按各自许可证使用。
      </p>
      <a href="https://github.com/deepseek-ai/chat-demo" target="_blank" rel="noreferrer">
        DeepSeek chat-demo 源码 ↗
      </a>
      <details>
        <summary>chat-demo · MIT 许可证</summary>
        <pre>{notices.upstream}</pre>
      </details>
      <p className="quiet-text">
        以下包含随包组件的版权与许可文本。Capgo InAppBrowser 依 MPL-2.0 提供，未修改其源文件。
      </p>
      <a
        href="https://github.com/Cap-go/capacitor-inappbrowser/tree/8.27.9"
        target="_blank"
        rel="noreferrer"
      >
        Capgo InAppBrowser 对应源码 ↗
      </a>
      <input
        aria-label="查找开源组件"
        placeholder="查找开源组件"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {notices.entries
        .filter((entry) => entry.name.toLowerCase().includes(filter.toLowerCase()))
        .map((entry) => (
          <details key={entry.name}>
            <summary>
              {entry.name} · {entry.license}
            </summary>
            <p className="quiet-text">来源：{entry.source}</p>
            <pre>{entry.text || '该组件包未附带独立许可文件；许可标识与来源见上方。'}</pre>
          </details>
        ))}
    </section>
  )
}
