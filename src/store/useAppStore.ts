import { create } from 'zustand'

export interface Note {
  id: string
  content: string
  mtime: number
}

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface AppState {
  notes: Note[]
  currentNoteIndex: number
  themePreset: string
  isHyprland: boolean

  // UI state
  showGraphView: boolean
  showRemindersView: boolean
  showTimersView: boolean
  toasts: Toast[]
  isRenaming: boolean
  renameValue: string
  showNoteSearch: boolean
  noteSearchQuery: string
  searchSelectedIndex: number
  showNoteActionMenu: boolean
  showMainActionMenu: boolean
  actionMenuIndex: number
  showSettingsModal: boolean
  isRecordingShortcut: boolean

  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void
  setCurrentNoteIndex: (index: number) => void
  setThemePreset: (preset: string) => void
  setIsHyprland: (isHyprland: boolean) => void

  setShowGraphView: (show: boolean | ((prev: boolean) => boolean)) => void
  setShowRemindersView: (show: boolean | ((prev: boolean) => boolean)) => void
  setShowTimersView: (show: boolean | ((prev: boolean) => boolean)) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setIsRenaming: (isRenaming: boolean) => void
  setRenameValue: (renameValue: string) => void
  setShowNoteSearch: (show: boolean) => void
  setNoteSearchQuery: (query: string) => void
  setSearchSelectedIndex: (index: number | ((prev: number) => number)) => void
  setShowNoteActionMenu: (show: boolean) => void
  setShowMainActionMenu: (show: boolean | ((prev: boolean) => boolean)) => void
  setActionMenuIndex: (index: number | ((prev: number) => number)) => void
  setShowSettingsModal: (show: boolean) => void
  setIsRecordingShortcut: (isRecording: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  notes: [],
  currentNoteIndex: 0,
  themePreset: (localStorage.getItem('papercache-theme') as string) || 'grid-light',
  isHyprland: false,

  showGraphView: false,
  showRemindersView: false,
  showTimersView: false,
  toasts: [],
  isRenaming: false,
  renameValue: '',
  showNoteSearch: false,
  noteSearchQuery: '',
  searchSelectedIndex: 0,
  showNoteActionMenu: false,
  showMainActionMenu: false,
  actionMenuIndex: 0,
  showSettingsModal: false,
  isRecordingShortcut: false,

  setNotes: (notes) =>
    set((state) => ({
      notes: typeof notes === 'function' ? notes(state.notes) : notes,
    })),
  setCurrentNoteIndex: (currentNoteIndex) => set({ currentNoteIndex }),
  setThemePreset: (themePreset) => set({ themePreset }),
  setIsHyprland: (isHyprland) => set({ isHyprland }),

  setShowGraphView: (showGraphView) =>
    set((state) => ({
      showGraphView:
        typeof showGraphView === 'function' ? showGraphView(state.showGraphView) : showGraphView,
    })),
  setShowRemindersView: (showRemindersView) =>
    set((state) => ({
      showRemindersView:
        typeof showRemindersView === 'function'
          ? showRemindersView(state.showRemindersView)
          : showRemindersView,
    })),
  setShowTimersView: (showTimersView) =>
    set((state) => ({
      showTimersView:
        typeof showTimersView === 'function'
          ? showTimersView(state.showTimersView)
          : showTimersView,
    })),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }],
    })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setIsRenaming: (isRenaming) => set({ isRenaming }),
  setRenameValue: (renameValue) => set({ renameValue }),
  setShowNoteSearch: (showNoteSearch) => set({ showNoteSearch }),
  setNoteSearchQuery: (noteSearchQuery) => set({ noteSearchQuery }),
  setSearchSelectedIndex: (searchSelectedIndex) =>
    set((state) => ({
      searchSelectedIndex:
        typeof searchSelectedIndex === 'function'
          ? searchSelectedIndex(state.searchSelectedIndex)
          : searchSelectedIndex,
    })),
  setShowNoteActionMenu: (showNoteActionMenu) => set({ showNoteActionMenu }),
  setShowMainActionMenu: (showMainActionMenu) =>
    set((state) => ({
      showMainActionMenu:
        typeof showMainActionMenu === 'function'
          ? showMainActionMenu(state.showMainActionMenu)
          : showMainActionMenu,
    })),
  setActionMenuIndex: (actionMenuIndex) =>
    set((state) => ({
      actionMenuIndex:
        typeof actionMenuIndex === 'function'
          ? actionMenuIndex(state.actionMenuIndex)
          : actionMenuIndex,
    })),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  setIsRecordingShortcut: (isRecordingShortcut) => set({ isRecordingShortcut }),
}))
