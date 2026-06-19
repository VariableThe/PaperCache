import { create } from 'zustand'

export interface AIState {
  apiKey: string
  apiBaseUrl: string
  apiModel: string
  aiSystemPrompt: string

  setApiKey: (key: string) => void
  setApiBaseUrl: (url: string) => void
  setApiModel: (model: string) => void
  setAiSystemPrompt: (prompt: string) => void
}

export const useAIStore = create<AIState>((set) => ({
  apiKey: '',
  apiBaseUrl: localStorage.getItem('papercache-api-base-url') || 'https://api.openai.com/v1',
  apiModel: localStorage.getItem('papercache-api-model') || 'gpt-4o',
  aiSystemPrompt:
    localStorage.getItem('papercache-ai-system-prompt') ||
    'You are a helpful assistant directly inside a markdown note. You can format your responses with markdown.',

  setApiKey: (apiKey) => set({ apiKey }),
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
