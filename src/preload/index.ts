import { contextBridge, ipcRenderer } from 'electron'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: string
}

export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>
    close: () => Promise<void>
    toggle: () => Promise<void>
  }
  settings: {
    open: () => Promise<void>
    close: () => Promise<void>
    get: (key: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
    getAll: () => Promise<Record<string, string>>
  }
  db: {
    getSessions: () => Promise<any[]>
    createSession: (data: { title?: string; mode?: string }) => Promise<any>
    getSession: (id: string) => Promise<any>
    deleteSession: (id: string) => Promise<void>
    addTranscript: (data: any) => Promise<void>
    addAIResponse: (data: any) => Promise<void>
    getTranscripts: (sessionId: string) => Promise<any[]>
    getAIResponses: (sessionId: string) => Promise<any[]>
  }
  capture: {
    getSources: () => Promise<any[]>
  }
  audio: {
    getDevices: () => Promise<AudioDevice[]>
  }
}

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggle: () => ipcRenderer.invoke('window:toggle')
  },
  settings: {
    open: () => ipcRenderer.invoke('settings:open'),
    close: () => ipcRenderer.invoke('settings:close'),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  db: {
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    createSession: (data) => ipcRenderer.invoke('db:createSession', data),
    getSession: (id) => ipcRenderer.invoke('db:getSession', id),
    deleteSession: (id) => ipcRenderer.invoke('db:deleteSession', id),
    addTranscript: (data) => ipcRenderer.invoke('db:addTranscript', data),
    addAIResponse: (data) => ipcRenderer.invoke('db:addAIResponse', data),
    getTranscripts: (sessionId) => ipcRenderer.invoke('db:getTranscripts', sessionId),
    getAIResponses: (sessionId) => ipcRenderer.invoke('db:getAIResponses', sessionId)
  },
  capture: {
    getSources: () => ipcRenderer.invoke('capture:getSources')
  },
  audio: {
    getDevices: async (): Promise<AudioDevice[]> => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        return devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `マイク ${d.deviceId.slice(0, 8)}`,
            kind: d.kind
          }))
      } catch {
        return []
      }
    }
  }
}

contextBridge.exposeInMainWorld('electron', api)
