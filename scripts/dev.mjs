import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const envArgs = existsSync('.env') ? ['--env-file=.env'] : []
const server = spawn(process.execPath, [...envArgs, 'server/index.mjs'], { stdio: 'inherit' })
const web = spawn(
  process.execPath,
  ['node_modules/@rspack/cli/bin/rspack.js', 'serve', '-c', 'rspack.config.ts'],
  { stdio: 'inherit' }
)
const stop = () => {
  server.kill()
  web.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', () => web.kill())
web.on('exit', () => server.kill())
