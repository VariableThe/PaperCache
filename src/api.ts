import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ElectronAPI, ReminderPayload } from './types'

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
  onSwipeGesture: () => {
    return () => {}
  },
  getLaunchAtStartup: () => invoke('get_launch_at_startup'),
  setLaunchAtStartup: (value) => invoke('set_launch_at_startup', { enabled: value }),
  updateGlobalShortcut: (action, oldShortcut, newShortcut) =>
    invoke('update_global_shortcut', { action, oldShortcut, newShortcut }),
  onTriggerNewNote: (callback) => {
    let unlisten: (() => void) | undefined
    listen('trigger-new-note', () => callback()).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
    }
  },
  onTriggerTasks: (callback) => {
    let unlisten: (() => void) | undefined
    listen('trigger-tasks', () => callback()).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
    }
  },
  safeStorageEncrypt: (val) => invoke('safe_storage_encrypt', { val }),
  safeStorageDecrypt: (val) => invoke('safe_storage_decrypt', { val }),
  onPowerSuspend: (callback) => {
    let unlisten: (() => void) | undefined
    listen('power:suspend', () => callback()).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
    }
  },
  onPowerResume: (callback) => {
    let unlisten: (() => void) | undefined
    listen('power:resume', () => callback()).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
    }
  },
  pauseShortcuts: () => invoke('pause_shortcuts') as unknown as void,
  resumeShortcuts: () => invoke('resume_shortcuts') as unknown as void,
  onUpdateReady: (callback) => {
    let unlisten: (() => void) | undefined
    listen('update-ready', () => callback()).then((fn) => {
      unlisten = fn
    })
    return () => {
      if (unlisten) unlisten()
    }
  },
}
