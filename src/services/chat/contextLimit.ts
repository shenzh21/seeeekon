import type { AssistantMessage } from './types.js'

// Match server errors and archived notices only. A normal answer can discuss these same words.
const limitNotice =
  /context_length_exceeded|maximum context length|context (?:length|window|limit).{0,48}(?:exceed|reached|full)|(?:exceed\w*|reached).{0,36}context (?:length|window|limit)|(?:input|prompt|conversation) is too long|(?:上下文|对话|会话).{0,18}(?:已满|过长|(?:达到|超[出过]).{0,6}(?:限制|上限|最大长度))|^(?:已满|context full)$/i

export const isContextLimit = (reply: AssistantMessage) => {
  if (reply.contextLimit) {
    return true
  }
  if (
    reply.status === 'error' &&
    reply.error &&
    (reply.error.kind === 'http' || reply.error.kind === 'stream') &&
    limitNotice.test(reply.error.message)
  ) {
    return true
  }
  return (
    reply.stopReason !== 'refusal' &&
    reply.blocks.some(
      (block) => block.type === 'text' && block.isTemplate && limitNotice.test(block.text)
    )
  )
}
