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
}

const MODES = [
  { id: 'general', label: 'General' },
  { id: 'sales', label: 'Sales' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'technical', label: 'Technical' },
  { id: 'lecture', label: 'Lecture' },
  { id: 'negotiation', label: 'Negotiation' }
]

export default function MainOverlay({ onNavigate }: MainOverlayProps) {
  const { transcripts, aiResponses, addTranscript, addAIResponse, updateAIResponse, clearAll, isRecording, setIsRecording } = useAppStore()
  const [inputText, setInputText] = useState('')
  const [mode, setMode] = useState('general')
  const [apiKey, setApiKey] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('deepseek')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const aiResponseRef = useRef<HTMLDivElement>(null)
  const [apiKeyError, setApiKeyError] = useState('')
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
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

  const handleStartRecording = async () => {
    if (!apiKey) {
      setApiKeyError('Deepgram API Keyを設定してください')
      return
    }
    setApiKeyError('')
    setIsRecording(true)
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
  const handleClose = () => window.electron?.window.close()

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

  return (
    <div className="h-full flex flex-col bg-slate-900" style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}>
      {/* Title Bar (44px) */}
      <div className="h-11 bg-slate-800 border-b border-white/10 flex items-center justify-between px-4 drag-region">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-200">AI面接ヘルパー</span>
          
          {/* Mode Selection Pill */}
          <div className="flex items-center bg-slate-700 rounded-lg p-0.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === m.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1 no-drag">
          <button 
            onClick={() => onNavigate('sessions')} 
            className="btn-icon text-slate-400 hover:text-white" 
            title="履歴 (⌘+Shift+L)"
          >
            📋
          </button>
          <button 
            onClick={() => onNavigate('settings')} 
            className="btn-icon text-slate-400 hover:text-white" 
            title="設定 (⌘+,)"
          >
            ⚙️
          </button>
          <button onClick={handleMinimize} className="btn-icon text-slate-400 hover:text-white" title="最小化">
            −
          </button>
          <button onClick={handleClose} className="btn-icon text-slate-400 hover:text-red-400" title="非表示 (⌘+Shift+H)">
            ×
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Transcript Panel (Left 50%) */}
        <div className="w-1/2 flex flex-col border-r border-white/10">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">リアルタイム文字起こし</span>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  録音中
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="bg-slate-700 text-xs px-2 py-1 rounded border-none outline-none text-slate-300"
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
                  className="px-3 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
                >
                  <span className="w-2 h-2 bg-white rounded-sm" />
                  停止
                </button>
              ) : (
                <button 
                  onClick={handleStart} 
                  className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                >
                  <span className="w-2 h-2 bg-white rounded-full" />
                  録音
                </button>
              )}
            </div>
          </div>
          
          {apiKeyError && (
            <div className="px-4 py-1.5 bg-red-900/30 text-xs text-red-400 border-b border-red-900/50">
              {apiKeyError}
            </div>
          )}
          {sttError && (
            <div className="px-4 py-1.5 bg-red-900/30 text-xs text-red-400 border-b border-red-900/50">
              {sttError.message}
            </div>
          )}
          
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <p>文字起こしがここに表示されます</p>
                  <p className="text-xs mt-1 text-slate-600">「録音」ボタンまたは ⌘+Shift+M でマイクON</p>
                </div>
              </div>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg text-sm ${
                    t.speaker === 'user' 
                      ? 'bg-blue-900/20 ml-8 border border-blue-800/30' 
                      : 'bg-slate-800/80 mr-8 border border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-medium ${
                      t.speaker === 'user' ? 'text-blue-400' : 'text-emerald-400'
                    }`}>
                      {t.speaker === 'user' ? 'あなた' : '面接官'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(t.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Suggestion Panel (Right 50%) */}
        <div className="w-1/2 flex flex-col bg-slate-900/50">
          <div className="px-4 py-2 border-b border-white/10">
            <span className="text-xs text-slate-400">AI回答提案</span>
          </div>
          
          <div ref={aiResponseRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiResponses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <p>質問に対してAI回答が表示されます</p>
                  <p className="text-xs mt-1 text-slate-600">テキスト入力または音声で質問してください</p>
                </div>
              </div>
            ) : (
              aiResponses.map((r) => (
                <div key={r.id} className="space-y-2">
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-400">Q</span>
                      <span className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleTimeString('ja-JP')}</span>
                    </div>
                    <p className="text-slate-200 text-sm">{r.question}</p>
                  </div>
                  
                  <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400">A</span>
                        {r.isStreaming && (
                          <span className="text-xs text-slate-500 animate-pulse">生成中...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleCopyResponse(r.answer)}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                          title="コピー (⌘+Return)"
                        >
                          📋 コピー
                        </button>
                        <button 
                          onClick={handleRegenerate}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                          title="再生成 (⌘+R)"
                        >
                          🔄 再生成
                        </button>
                        <button 
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                          title="展開"
                        >
                          ⬆️ 展開
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
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

      {/* Footer Bar (32px) */}
      <div className="h-8 border-t border-white/10 px-4 flex items-center justify-between bg-slate-800/50">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">⌘+Shift+H</kbd>
            <span>表示/非表示</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">⌘+Return</kbd>
            <span>コピー</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">⌘+R</kbd>
            <span>再生成</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>モード: {MODES.find(m => m.id === mode)?.label}</span>
        </div>
      </div>

      {/* Input Bar */}
      <div className="h-14 border-t border-white/10 px-4 flex items-center gap-2 bg-slate-800/80">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力... (Enterで送信)"
          className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button 
          onClick={handleSend} 
          disabled={!inputText.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </div>
    </div>
  )
}

declare global {
  interface Window {
    electron: import('../preload').ElectronAPI
  }
}