import { create } from 'zustand'

interface VariableState {
  globals: Record<string, unknown>
  noteScope: Record<string, unknown>
  setGlobals: (globals: Record<string, unknown>) => void
  setNoteScope: (noteScope: Record<string, unknown>) => void
  getGlobals: () => Record<string, unknown>
  getNoteScope: () => Record<string, unknown>
}

export const useVariableStore = create<VariableState>((set, get) => ({
  globals: {},
  noteScope: {},
  setGlobals: (globals) => set({ globals }),
  setNoteScope: (noteScope) => set({ noteScope }),
  getGlobals: () => get().globals,
  getNoteScope: () => get().noteScope,
}))
