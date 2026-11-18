import { createApp } from './app.mjs'
const port = Number(process.env.PORT || 8091)
createApp().listen(port, '127.0.0.1', () => console.log(`留白服务 http://localhost:${port}`))
