import React, { useState, useRef, useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { useSTT } from '../hooks/useSTT'
import { LLMClient, getSystemPrompt, type LLMProvider } from '../llm'
import type { STTTranscript } from '../stt'

interface Transcript {
  id: string
  speaker: 'user' | 'interviewer' | 'unknown'
  text: string
  timestamp: number
  isFinal: boolean
}

interface AIResponse {
  id: string
  question: string
  answer: string
  timestamp: number
  isStreaming?: boolean
}

interface AppState {
  transcripts: Transcript[]
  aiResponses: AIResponse[]
  currentSessionId: string | null
  isRecording: boolean
  addTranscript: (t: Transcript) => void
  addAIResponse: (r: AIResponse) => void
  updateAIResponse: (id: string, answer: string, isStreaming?: boolean) => void
  setSession: (id: string | null) => void
  clearAll: () => void
  setIsRecording: (v: boolean) => void
}

const useAppStore = create<AppState>((set) => ({
  transcripts: [],
  aiResponses: [],
  currentSessionId: null,
  isRecording: false,
  addTranscript: (t) => set((s) => ({ transcripts: [...s.transcripts, t] })),
  addAIResponse: (r) => set((s) => ({ aiResponses: [...s.aiResponses, r] })),
  updateAIResponse: (id, answer, isStreaming) => set((s) => ({
    aiResponses: s.aiResponses.map(r => r.id === id ? { ...r, answer, isStreaming } : r)
  })),
  setSession: (id) => set({ currentSessionId: id }),
  clearAll: () => set({ transcripts: [], aiResponses: [] }),
  setIsRecording: (v) => set({ isRecording: v })
}))

interface MainOverlayProps {
  onNavigate: (view: 'main' | 'settings' | 'sessions') => void
  onModeChange?: (mode: 'full' | 'focus' | 'mini') => void
}

type DisplayMode = 'full' | 'focus' | 'mini'

const MODES = [
  { id: 'general', label: 'General' },
  { id: 'sales', label: 'Sales' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'technical', label: 'Technical' },
  { id: 'lecture', label: 'Lecture' },
  { id: 'negotiation', label: 'Negotiation' }
]

const MODE_LABELS: Record<DisplayMode, string> = {
  full: 'フルモード',
  focus: '集中モード',
  mini: 'ミニモード'
}

export default function MainOverlay({ onNavigate, onModeChange }: MainOverlayProps) {
  const { transcripts, aiResponses, addTranscript, addAIResponse, updateAIResponse, clearAll, isRecording, setIsRecording } = useAppStore()
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState('general')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full')
  const [apiKey, setApiKey] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('deepseek')
  const transcriptRef = useRef<HTMLDivElement>(null)
  const aiResponseRef = useRef<HTMLDivElement>(null)
  const [apiKeyError, setApiKeyError] = useState('')
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    
    const unsubscribe = window.electron?.onSettingsChange((key, value) => {
      console.log(`Setting changed: ${key} = ${value}`)
      if (key === 'deepgram_api_key') {
        setApiKey(value)
      } else if (key === 'llm_provider') {
        setLlmProvider(value as LLMProvider)
      }
    })
    
    return () => {
      unsubscribe?.()
    }
  }, [])

  const loadSettings = async () => {
    const settings = await window.electron?.settings.getAll()
    if (settings) {
      if (settings.deepgram_api_key) setApiKey(settings.deepgram_api_key)
      if (settings.llm_provider) setLlmProvider(settings.llm_provider as LLMProvider)
    }
  }

  const handleTranscript = useCallback((transcript: STTTranscript) => {
    if (transcript.isFinal && transcript.text.trim()) {
      const speaker = transcript.speaker?.includes('話者0') ? 'user' : 'interviewer'
      addTranscript({
        id: Date.now().toString(),
        speaker,
        text: transcript.text,
        timestamp: Date.now(),
        isFinal: true
      })
      generateAIResponse(transcript.text)
    }
  }, [addTranscript])

  const generateAIResponse = async (question: string) => {
    const responseId = (Date.now() + 1).toString()
    setLastResponseId(responseId)
    addAIResponse({
      id: responseId,
      question,
      answer: '',
      timestamp: Date.now(),
      isStreaming: true
    })

    try {
      const settings = await window.electron?.settings.getAll()
      let llmApiKey = ''
      let provider: LLMProvider = llmProvider

      if (provider === 'deepseek') {
        llmApiKey = settings?.deepseek_api_key || ''
      } else if (provider === 'openai') {
        llmApiKey = settings?.openai_api_key || ''
      } else if (provider === 'anthropic') {
        llmApiKey = settings?.anthropic_api_key || ''
      } else if (provider === 'google') {
        llmApiKey = settings?.google_api_key || ''
      }

      if (!llmApiKey) {
        updateAIResponse(responseId, '⚠️ LLM API Keyが設定されていません。設定画面からAPI Keyを設定してください。', false)
        return
      }

      const client = new LLMClient({ provider, apiKey: llmApiKey })
      const systemPrompt = getSystemPrompt(mode)
      
      await client.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        (text, isFinal) => {
          const currentAnswer = useAppStore.getState().aiResponses.find(r => r.id === responseId)?.answer || ''
          updateAIResponse(responseId, currentAnswer + text, !isFinal)
        }
      )
    } catch (err) {
      const error = err instanceof Error ? err.message : '不明なエラー'
      updateAIResponse(responseId, `❌ エラー: ${error}`, false)
    }
  }

  const handleCopyResponse = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleRegenerate = () => {
    if (lastResponseId) {
      const lastResponse = useAppStore.getState().aiResponses.find(r => r.id === lastResponseId)
      if (lastResponse) {
        generateAIResponse(lastResponse.question)
      }
    }
  }

  const { startRecording, stopRecording, devices, refreshDevices, error: sttError } = useSTT({
    apiKey,
    language: 'ja-JP',
    onTranscript: handleTranscript,
    onError: (err) => {
      console.error('STT Error:', err)
      setIsRecording(false)
    }
  })

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcripts])

  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight
    }
  }, [aiResponses])

  const handleMinimize = () => window.electron?.window.minimize()
  const handleClose = () => window.electron?.window.hide()

  const handleDisplayModeChange = (newMode: DisplayMode) => {
    setDisplayMode(newMode)
    onModeChange?.(newMode)
  }

  const handleSend = async () => {
    if (!inputText.trim()) return
    addTranscript({
      id: Date.now().toString(),
      speaker: 'user',
      text: inputText,
      timestamp: Date.now(),
      isFinal: true
    })
    generateAIResponse(inputText)
    setInputText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStart = async () => {
    if (!apiKey) {
      setApiKeyError('Deepgram API Keyを設定してください')
      return
    }
    setApiKeyError('')
    await startRecording(selectedDevice || undefined)
    setIsRecording(true)
  }

  const lastAIResponse = aiResponses[aiResponses.length - 1]

  return (
    <div 
      className="h-full flex flex-col" 
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Title Bar */}
      <div 
        className="h-9 flex items-center justify-between px-3 drag-region border-b"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 no-drag">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600" title="閉じる" />
            <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600" title="最小化" />
            <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600" title="最大化" />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>🎙 AI面接アシスタント</span>
        </div>
        
        <div className="flex items-center gap-2 no-drag">
          <span className="mode-badge">{MODE_LABELS[displayMode]}</span>
          <select
            value={displayMode}
            onChange={(e) => handleDisplayModeChange(e.target.value as DisplayMode)}
            className="text-xs px-2 py-0.5 rounded border-none outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            <option value="full">フル</option>
            <option value="focus">集中</option>
            <option value="mini">ミニ</option>
          </select>
          <button onClick={() => onNavigate('settings')} className="text-xs px-2 py-0.5 rounded hover:bg-slate-700" style={{ color: 'var(--text-secondary)' }} title="設定 (⌘+,)">
            ⚙️
          </button>
          <button onClick={handleClose} className="text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700" style={{ color: 'var(--text-muted)' }} title="非表示">
            ×
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div 
        className="flex items-center gap-1 px-3 py-2 border-b"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="px-3 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: mode === m.id ? 'var(--accent)' : 'transparent',
              color: mode === m.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden" style={{ height: displayMode === 'mini' ? '148px' : '420px' }}>
        {/* Transcript Panel - Hidden in focus/mini mode */}
        {displayMode === 'full' && (
          <div 
            className="w-1/2 flex flex-col border-r"
            style={{ borderColor: 'var(--border)' }}
          >
            <div 
              className="px-3 py-2 border-b flex items-center justify-between"
              style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {isRecording && <span className="live-dot inline-block mr-1.5" />}
                  ライブ文字起こし
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="text-xs px-2 py-1 rounded border outline-none cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                >
                  <option value="">デフォルトマイク</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
                
                {isRecording ? (
                  <button 
                    onClick={() => { stopRecording(); setIsRecording(false) }} 
                    className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--red)', color: '#fff' }}
                  >
                    <span className="w-2 h-2 bg-white rounded-sm" />
                    停止
                  </button>
                ) : (
                  <button 
                    onClick={handleStart} 
                    className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    <span className="w-2 h-2 bg-white rounded-full" />
                    録音
                  </button>
                )}
              </div>
            </div>
            
            {apiKeyError && (
              <div className="px-4 py-1.5 text-xs rounded mx-2 mt-2" style={{ backgroundColor: 'rgba(239,68,68,.15)', color: 'var(--red)' }}>
                {apiKeyError}
              </div>
            )}
            {sttError && (
              <div className="px-4 py-1.5 text-xs rounded mx-2 mt-2" style={{ backgroundColor: 'rgba(239,68,68,.15)', color: 'var(--red)' }}>
                {sttError.message}
              </div>
            )}
            
            <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {transcripts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  <div className="text-center">
                    <p>文字起こしがここに表示されます</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>「録音」ボタンまたはグローバルショートカットでマイクON</p>
                  </div>
                </div>
              ) : (
                transcripts.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg text-sm"
                    style={{
                      backgroundColor: t.speaker === 'user' ? 'rgba(59,130,246,.15)' : 'var(--bg-card)',
                      border: `1px solid ${t.speaker === 'user' ? 'rgba(59,130,246,.3)' : 'var(--border)'}`,
                      marginLeft: t.speaker === 'user' ? '16px' : '0',
                      marginRight: t.speaker === 'user' ? '0' : '16px'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: t.speaker === 'user' ? 'var(--blue)' : 'var(--accent)' }}>
                        {t.speaker === 'user' ? 'あなた' : '面接官'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(t.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{t.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* AI Summary Panel */}
        <div 
          className="flex flex-col"
          style={{ 
            width: displayMode === 'full' ? '50%' : '100%',
            backgroundColor: displayMode !== 'full' ? 'var(--bg-primary)' : 'transparent'
          }}
        >
          <div 
            className="px-3 py-2 border-b"
            style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              ✨ AIサマリー
            </span>
          </div>
          
          <div ref={aiResponseRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {aiResponses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="text-center">
                  <p>質問に対してAI回答が表示されます</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>テキスト入力または音声で質問してください</p>
                </div>
              </div>
            ) : (
              aiResponses.map((r) => (
                <div key={r.id} className="space-y-2">
                  <div 
                    className="p-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--border)'}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Q</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.timestamp).toLocaleTimeString('ja-JP')}</span>
                    </div>
                    <p style={{ color: 'var(--text-primary)' }}>{r.question}</p>
                  </div>
                  
                  <div 
                    className="p-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'rgba(99,102,241,.15)', border: `1px solid rgba(99,102,241,.3)` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>A</span>
                        {r.isStreaming && (
                          <span className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>生成中...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleCopyResponse(r.answer)}
                          className="btn-icon"
                          title="コピー"
                        >
                          📋
                        </button>
                        <button 
                          onClick={handleRegenerate}
                          className="btn-icon"
                          title="再生成"
                        >
                          🔄
                        </button>
                        <button 
                          className="btn-icon"
                          title="展開"
                        >
                          ⬆️
                        </button>
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {r.answer}
                      {r.isStreaming && <span className="animate-pulse">▌</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div 
        className="h-7 px-3 flex items-center justify-between border-t text-xs"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span 
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isRecording ? 'var(--red)' : 'var(--green)', animation: isRecording ? 'pulse 1.4s infinite' : 'none' }}
            />
            <span>{isRecording ? '録音中' : '待機中'}</span>
          </div>
          
          {isRecording && (
            <div className="waveform">
              <span style={{ animationDelay: '0s' }}></span>
              <span style={{ animationDelay: '0.1s' }}></span>
              <span style={{ animationDelay: '0.2s' }}></span>
              <span style={{ animationDelay: '0.15s' }}></span>
              <span style={{ animationDelay: '0.05s' }}></span>
              <span style={{ animationDelay: '0.25s' }}></span>
              <span style={{ animationDelay: '0.08s' }}></span>
            </div>
          )}
          
          <span>Deepgram Nova-2</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>⌘</kbd>
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>Shift</kbd>
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>H</kbd>
            <span>非表示</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>⌘</kbd>
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>M</kbd>
            <span>モード切替</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>⌘</kbd>
            <kbd className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border)` }}>,</kbd>
            <span>設定</span>
          </span>
        </div>
      </div>

      {/* Input Bar - Hidden in mini mode */}
      {displayMode !== 'mini' && (
        <div 
          className="h-14 px-3 flex items-center gap-2 border-t"
          style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力... (Enterで送信)"
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ 
              backgroundColor: 'var(--bg-input)', 
              border: `1px solid var(--border)`,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <button 
            onClick={handleSend} 
            disabled={!inputText.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            送信
          </button>
        </div>
      )}

      {/* Mini mode summary */}
      {displayMode === 'mini' && lastAIResponse && (
        <div 
          className="h-12 px-3 flex items-center justify-between border-t"
          style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
        >
          <div className="flex-1 overflow-hidden">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>A:</span>
            <span className="text-xs ml-1" style={{ color: 'var(--text-primary)' }}>
              {lastAIResponse.answer.slice(0, 60)}{lastAIResponse.answer.length > 60 ? '...' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => handleCopyResponse(lastAIResponse.answer)} className="btn-icon" title="コピー">📋</button>
            <button onClick={handleRegenerate} className="btn-icon" title="再生成">🔄</button>
          </div>
        </div>
      )}
    </div>
  )
}

declare global {
  interface Window {
    electron: import('../preload').ElectronAPI
  }
}