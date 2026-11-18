import { spawnSync } from 'node:child_process'
import './generate-notices.mjs'
const result = spawnSync(
  process.execPath,
  ['node_modules/@rspack/cli/bin/rspack.js', 'build', '-c', 'rspack.config.ts'],
  { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } }
)
process.exit(result.status ?? 1)
