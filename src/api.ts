import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ElectronAPI, ReminderPayload } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onEvent = (name: string, callback: (payload: any) => void) => {
  let unlisten: (() => void) | undefined
  let disposed = false
  listen(name, (event) => callback(event.payload)).then((fn) => {
    if (disposed) {
      fn()
      return
    }
    unlisten = fn
  })
  return () => {
    disposed = true
    unlisten?.()
  }
}

export const tauriApi: ElectronAPI = {
  // Implemented Phase 2 Commands
  getNotes: async () => {
    try {
      return await invoke('get_notes')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to get notes', e)
      return []
    }
  },
  saveNote: (id, content) => invoke('save_note', { id, content }),
  readNote: (id) => invoke('read_note', { id }),
  deleteNote: (id) => invoke('delete_note', { id }),
  renameNote: (oldId, newId) => invoke('rename_note', { oldId, newId }),
  exportNote: (filename, content) => invoke('export_note', { filename, content }),
  setDialogOpen: (open) => invoke('set_dialog_open', { open }),
  closeWindow: () => invoke('close_window'),
  quitApp: () => invoke('quit_app'),
  openExternal: (url) => invoke('open_external', { url }),
  openFile: (path) => invoke('open_file', { path }),
  scheduleReminders: (reminders: ReminderPayload[]) => invoke('schedule_reminders', { reminders }),
  cancelReminders: () => invoke('cancel_all_reminders'),
  scheduleTimer: (id, durationMs, label) => invoke('schedule_timer', { id, durationMs, label }),
  cancelTimer: (id) => invoke('cancel_timer', { id }),

  removeOnboardingFiles: () => invoke('remove_onboarding_files'),
  openAIChat: (args) => invoke('openai_chat', args),
  setApiKey: (key) => invoke('set_api_key', { key }),
  getApiKeyStatus: () => invoke('get_api_key_status'),
  checkForUpdates: () => invoke('check_for_updates'),
  restoreWindowState: () => invoke('restore_window_state'),
  isHyprland: () => invoke('is_hyprland'),
  getLaunchAtStartup: () => invoke('get_launch_at_startup'),
  setLaunchAtStartup: (value) => invoke('set_launch_at_startup', { enabled: value }),
  updateGlobalShortcut: (action, oldShortcut, newShortcut) =>
    invoke('update_global_shortcut', { action, oldShortcut, newShortcut }),
  onTriggerNewNote: (callback) => onEvent('trigger-new-note', callback),
  onTriggerTasks: (callback) => onEvent('trigger-tasks', callback),
  safeStorageEncrypt: (val) => invoke('safe_storage_encrypt', { val }),
  safeStorageDecrypt: (val) => invoke('safe_storage_decrypt', { val }),
  onPowerSuspend: (callback) => onEvent('power:suspend', callback),
  onPowerResume: (callback) => onEvent('power:resume', callback),
  pauseShortcuts: () => invoke('pause_shortcuts'),
  resumeShortcuts: () => invoke('resume_shortcuts'),
  onUpdateReady: (callback) => onEvent('update-ready', callback),
  restartApp: () => invoke('restart_app'),
  onUpdateStatus: (callback) => onEvent('update-status', callback),
}
