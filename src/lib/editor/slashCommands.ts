export interface SlashCommand {
  label: string
  apply: string
  info: string
  type?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { label: '/ai', apply: '/ai ', info: 'AI completion', type: 'keyword' },
  { label: '/ctx', apply: '/ctx ', info: 'AI completion with context', type: 'keyword' },
  { label: '/context', apply: '/context ', info: 'AI completion with context', type: 'keyword' },
  { label: '/task', apply: '/task ', info: 'Create a task', type: 'keyword' },
  { label: '/check', apply: '/check ', info: 'Create a checkbox', type: 'keyword' },
  { label: '/timer', apply: '/timer ', info: 'Open timer panel', type: 'keyword' },
]
