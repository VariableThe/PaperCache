import { create } from 'zustand'

export interface AIState {
  apiBaseUrl: string
  apiModel: string
  aiSystemPrompt: string

  setApiBaseUrl: (url: string) => void
  setApiModel: (model: string) => void
  setAiSystemPrompt: (prompt: string) => void
}

export const useAIStore = create<AIState>((set) => ({
  apiBaseUrl: localStorage.getItem('papercache-api-base-url') || 'https://openrouter.ai/api/v1',
  apiModel:
    localStorage.getItem('papercache-api-model') || 'nvidia/nemotron-3-super-120b-a12b:free',
  aiSystemPrompt:
    localStorage.getItem('papercache-ai-system-prompt') ||
    'You are a helpful assistant directly inside a markdown note. You can format your responses with markdown.',

  setApiBaseUrl: (apiBaseUrl) => {
    localStorage.setItem('papercache-api-base-url', apiBaseUrl)
    set({ apiBaseUrl })
  },
  setApiModel: (apiModel) => {
    localStorage.setItem('papercache-api-model', apiModel)
    set({ apiModel })
  },
  setAiSystemPrompt: (aiSystemPrompt) => {
    localStorage.setItem('papercache-ai-system-prompt', aiSystemPrompt)
    set({ aiSystemPrompt })
  },
}))
