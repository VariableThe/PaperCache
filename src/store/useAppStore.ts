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
  actionLabel?: string
  onAction?: () => void
}

interface AppState {
  notes: Note[]
  currentNoteIndex: number
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
  showKeybindsModal: boolean
  isRecordingShortcut: boolean

  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void
  setCurrentNoteIndex: (index: number) => void
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
  setShowKeybindsModal: (show: boolean) => void
  setIsRecordingShortcut: (isRecording: boolean) => void
}

export const useAppStore = create<AppState>((set) => {
  const booleanSetter = (key: keyof AppState) => (value: boolean | ((prev: boolean) => boolean)) =>
    set((state) => ({
      [key]: typeof value === 'function' ? value(state[key] as boolean) : value,
    }))

  const simpleSetter =
    <K extends keyof AppState>(key: K) =>
    (value: AppState[K]) =>
      set({ [key]: value } as unknown as Partial<AppState>)

  return {
    notes: [],
    currentNoteIndex: 0,
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
    showKeybindsModal: false,
    isRecordingShortcut: false,

    setNotes: (notes) =>
      set((state) => ({
        notes: typeof notes === 'function' ? notes(state.notes) : notes,
      })),
    setCurrentNoteIndex: simpleSetter('currentNoteIndex'),
    setIsHyprland: simpleSetter('isHyprland'),

    setShowGraphView: booleanSetter('showGraphView'),
    setShowRemindersView: booleanSetter('showRemindersView'),
    setShowTimersView: booleanSetter('showTimersView'),
    addToast: (toast) =>
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }],
      })),
    removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    setIsRenaming: simpleSetter('isRenaming'),
    setRenameValue: simpleSetter('renameValue'),
    setShowNoteSearch: simpleSetter('showNoteSearch'),
    setNoteSearchQuery: simpleSetter('noteSearchQuery'),
    setSearchSelectedIndex: (searchSelectedIndex) =>
      set((state) => ({
        searchSelectedIndex:
          typeof searchSelectedIndex === 'function'
            ? searchSelectedIndex(state.searchSelectedIndex)
            : searchSelectedIndex,
      })),
    setShowNoteActionMenu: simpleSetter('showNoteActionMenu'),
    setShowMainActionMenu: booleanSetter('showMainActionMenu'),
    setActionMenuIndex: (actionMenuIndex) =>
      set((state) => ({
        actionMenuIndex:
          typeof actionMenuIndex === 'function'
            ? actionMenuIndex(state.actionMenuIndex)
            : actionMenuIndex,
      })),
    setShowSettingsModal: simpleSetter('showSettingsModal'),
    setShowKeybindsModal: simpleSetter('showKeybindsModal'),
    setIsRecordingShortcut: simpleSetter('isRecordingShortcut'),
  }
})
