import { zipSync, strToU8 } from 'fflate'
import { mkdirSync, writeFileSync } from 'node:fs'
const time = '2026-11-17T02:00:00Z'
const session = {
  id: 'liubai-import-fixture',
  title: '海边的约定 · 导入测试',
  pinned: false,
  current_message_id: 2,
  inserted_at: time,
  updated_at: time,
  messages: [
    {
      id: 1,
      parent_id: null,
      role: 'USER',
      status: 'FINISHED',
      thinking_enabled: false,
      search_enabled: false,
      accumulated_token_usage: 0,
      inserted_at: time,
      fragments: [{ type: 'REQUEST', content: '请记住：我们故事里的灯塔叫白鹭。' }],
    },
    {
      id: 2,
      parent_id: 1,
      role: 'ASSISTANT',
      status: 'FINISHED',
      thinking_enabled: false,
      search_enabled: false,
      accumulated_token_usage: 0,
      inserted_at: time,
      fragments: [{ type: 'RESPONSE', content: '记住了，海边的灯塔叫白鹭。' }],
    },
  ],
}
mkdirSync('tests/fixtures', { recursive: true })
writeFileSync(
  'tests/fixtures/deepseek-history.zip',
  zipSync({
    'manifest.json': strToU8(JSON.stringify({ export_format_version: 3 })),
    [`chat_sessions/${session.id}.json`]: strToU8(JSON.stringify(session)),
    'chat_session_index.json': strToU8(
      JSON.stringify([
        { ...session, messages: undefined, current_message_id: undefined, message_count: 2 },
      ])
    ),
  })
)
writeFileSync('tests/fixtures/invalid.zip', 'not a zip')
