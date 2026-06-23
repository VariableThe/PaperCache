import { create } from 'zustand'

export interface Note {
  id: string
  content: string
  mtime: number
}

interface AppState {
  notes: Note[]
  currentNoteIndex: number
  themePreset: 'grid-light' | 'grid-dark' | 'blueprint' | 'glass'

  // UI state
  showGraphView: boolean
  showRemindersView: boolean
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
  setThemePreset: (preset: 'grid-light' | 'grid-dark' | 'blueprint' | 'glass') => void

  setShowGraphView: (show: boolean | ((prev: boolean) => boolean)) => void
  setShowRemindersView: (show: boolean | ((prev: boolean) => boolean)) => void
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
  themePreset:
    (localStorage.getItem('papercache-theme') as AppState['themePreset']) || 'grid-light',

  showGraphView: false,
  showRemindersView: false,
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
