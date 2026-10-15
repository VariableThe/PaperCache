import { create } from 'zustand'
import { SETTINGS_KEYS } from '../lib/settingsKeys'

export const DEFAULT_AI_SYSTEM_PROMPT =
  'You are a helpful assistant directly inside a markdown note. You can format your responses with markdown.'

export interface AIState {
  apiBaseUrl: string
  apiModel: string
  aiSystemPrompt: string

  setApiBaseUrl: (url: string) => void
  setApiModel: (model: string) => void
  setAiSystemPrompt: (prompt: string) => void
}

export const useAIStore = create<AIState>((set) => ({
  apiBaseUrl: localStorage.getItem(SETTINGS_KEYS.API_BASE_URL) || 'https://openrouter.ai/api/v1',
  apiModel:
    localStorage.getItem(SETTINGS_KEYS.API_MODEL) || 'nvidia/nemotron-3-super-120b-a12b:free',
  aiSystemPrompt: localStorage.getItem(SETTINGS_KEYS.AI_SYSTEM_PROMPT) || DEFAULT_AI_SYSTEM_PROMPT,

  setApiBaseUrl: (apiBaseUrl) => {
    localStorage.setItem(SETTINGS_KEYS.API_BASE_URL, apiBaseUrl)
    set({ apiBaseUrl })
  },
  setApiModel: (apiModel) => {
    localStorage.setItem(SETTINGS_KEYS.API_MODEL, apiModel)
    set({ apiModel })
  },
  setAiSystemPrompt: (aiSystemPrompt) => {
    localStorage.setItem(SETTINGS_KEYS.AI_SYSTEM_PROMPT, aiSystemPrompt)
    set({ aiSystemPrompt })
  },
}))
