export const SETTINGS_KEYS = {
  THEME_PRESET: 'papercache-theme-preset',
  FONT_FAMILY: 'papercache-font',
  SHOW_RULINGS: 'papercache-rulings',
  BG_TYPE: 'papercache-bg-type',
  BG_COLOR: 'papercache-bg-color',
  BG_IMAGE: 'papercache-bg-image',
  TEXT_COLOR: 'papercache-color-text',
  NUM_COLOR: 'papercache-color-num',
  SYM_COLOR: 'papercache-color-sym',
  AI_COLOR: 'papercache-ai-color',
  MATH_COLOR: 'papercache-math-color',
  API_BASE_URL: 'papercache-api-base-url',
  API_MODEL: 'papercache-api-model',
  AI_SYSTEM_PROMPT: 'papercache-ai-system-prompt',
  SHORTCUT_NEWNOTE: 'papercache-shortcut-newnote',
  SHORTCUT_TOGGLE: 'papercache-shortcut-toggle',
  SHORTCUT_TASKS: 'papercache-shortcut-tasks',
  SHORTCUT_TIMERS: 'papercache-shortcut-timers',
  SHORTCUT_SEARCH: 'papercache-shortcut-search',
  SHORTCUT_GRAPH: 'papercache-shortcut-graph',
  SHORTCUT_ACTION_MENU: 'papercache-shortcut-action-menu',
  SHORTCUT_EXPORT: 'papercache-shortcut-export',
  SHORTCUT_REF: 'papercache-shortcut-ref',
  SHORTCUT_SETTINGS: 'papercache-shortcut-settings',
  SHORTCUT_NEWNOTE_INAPP: 'papercache-shortcut-newnote-inapp',
  LAUNCH_STARTUP: 'papercache-launch-startup',
  NOTIFIED_REMINDERS: 'papercache_notified',
} as const

export function getShortcut(key: string, fallback: string): string {
  const val = localStorage.getItem(key)
  return val !== null ? val : fallback
}
