export {}

declare global {
  interface Window {
    electron: import('../../preload').ElectronAPI
  }
}
