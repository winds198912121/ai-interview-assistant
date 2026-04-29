import React, { useState, useEffect } from 'react'

interface SettingsViewProps {
  onBack: () => void
}

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const all = await window.electron?.settings.getAll()
    if (all) setSettings(all)
  }

  const handleSave = async (key: string, value: string) => {
    setSaving(true)
    await window.electron?.settings.set(key, value)
    setSettings((prev) => ({ ...prev, [key]: value }))
    setTimeout(() => setSaving(false), 500)
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'ai', label: 'AI Models' },
    { id: 'audio', label: 'Audio' },
    { id: 'language', label: 'Language' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'license', label: 'Pro / License' }
  ]

  return (
    <div className="h-full flex flex-col bg-slate-900" style={{ backgroundColor: 'rgba(15, 23, 42, 0.97)' }}>
      {/* Header */}
      <div className="h-11 bg-slate-800 border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white text-sm">
            ← 戻る
          </button>
          <span className="text-sm font-medium text-slate-200">設定</span>
        </div>
        {saving && <span className="text-xs text-green-400">✓ 保存済み</span>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">起動設定</h3>
            
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm text-slate-200">ステルスモード</p>
                <p className="text-xs text-slate-500">Zoom/Meetの画面共有に映らなくなります</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.stealth_mode !== 'false'}
                  onChange={(e) => handleSave('stealth_mode', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm text-slate-200">自動言語検出</p>
                <p className="text-xs text-slate-500">音声認識時に自動的に言語を検出</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_language !== 'false'}
                  onChange={(e) => handleSave('auto_language', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm text-slate-200">起動時にウィンドウを表示</p>
                <p className="text-xs text-slate-500">アプリ起動時にメインウィンドウを自動表示</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.show_on_launch !== 'false'}
                  onChange={(e) => handleSave('show_on_launch', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">LLM プロバイダー設定</h3>
            
            <div className="space-y-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-200">DeepSeek</p>
                <span className="text-xs px-2 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">推奨</span>
              </div>
              <input
                type="password"
                value={settings.deepseek_api_key || ''}
                onChange={(e) => setSettings((p) => ({ ...p, deepseek_api_key: e.target.value }))}
                onBlur={(e) => handleSave('deepseek_api_key', e.target.value)}
                className="input-field"
                placeholder="sk-..."
              />
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <p className="text-sm text-slate-200">OpenAI</p>
              <input
                type="password"
                value={settings.openai_api_key || ''}
                onChange={(e) => setSettings((p) => ({ ...p, openai_api_key: e.target.value }))}
                onBlur={(e) => handleSave('openai_api_key', e.target.value)}
                className="input-field"
                placeholder="sk-..."
              />
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <p className="text-sm text-slate-200">Anthropic</p>
              <input
                type="password"
                value={settings.anthropic_api_key || ''}
                onChange={(e) => setSettings((p) => ({ ...p, anthropic_api_key: e.target.value }))}
                onBlur={(e) => handleSave('anthropic_api_key', e.target.value)}
                className="input-field"
                placeholder="sk-ant-..."
              />
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <p className="text-sm text-slate-200">Google</p>
              <input
                type="password"
                value={settings.google_api_key || ''}
                onChange={(e) => setSettings((p) => ({ ...p, google_api_key: e.target.value }))}
                onBlur={(e) => handleSave('google_api_key', e.target.value)}
                className="input-field"
                placeholder="AIza..."
              />
            </div>

            <div className="space-y-4 py-3">
              <label className="block text-sm text-slate-200">デフォルトモデル</label>
              <select
                value={settings.default_model || 'deepseek-chat'}
                onChange={(e) => handleSave('default_model', e.target.value)}
                className="input-field"
              >
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">音声認識設定</h3>
            
            <div className="space-y-4 py-3 border-b border-white/5">
              <label className="block text-sm text-slate-200">STT プロバイダー</label>
              <select
                value={settings.stt_provider || 'deepgram'}
                onChange={(e) => handleSave('stt_provider', e.target.value)}
                className="input-field"
              >
                <option value="deepgram">Deepgram (推奨 - Nova-3)</option>
                <option value="google">Google STT</option>
                <option value="openai">OpenAI Whisper</option>
              </select>
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <label className="block text-sm text-slate-200">Deepgram API Key</label>
              <input
                type="password"
                value={settings.deepgram_api_key || ''}
                onChange={(e) => setSettings((p) => ({ ...p, deepgram_api_key: e.target.value }))}
                onBlur={(e) => handleSave('deepgram_api_key', e.target.value)}
                className="input-field"
                placeholder="..."
              />
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <label className="block text-sm text-slate-200">入力デバイス</label>
              <select
                value={settings.audio_input_device || ''}
                onChange={(e) => handleSave('audio_input_device', e.target.value)}
                className="input-field"
              >
                <option value="">デフォルト</option>
              </select>
            </div>

            <div className="space-y-4 py-3">
              <label className="block text-sm text-slate-200">感度調整</label>
              <input
                type="range"
                min="0"
                max="100"
                value={parseInt(settings.audio_sensitivity || '70')}
                onChange={(e) => handleSave('audio_sensitivity', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>低</span>
                <span>中</span>
                <span>高</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">言語設定</h3>
            
            <div className="space-y-4 py-3 border-b border-white/5">
              <label className="block text-sm text-slate-200">認識言語</label>
              <select
                value={settings.language || 'ja-JP'}
                onChange={(e) => handleSave('language', e.target.value)}
                className="input-field"
              >
                <option value="ja-JP">日本語</option>
                <option value="en-US">英語</option>
                <option value="zh-CN">中国語</option>
                <option value="ko-KR">韓国語</option>
                <option value="auto">自動検出</option>
              </select>
            </div>

            <div className="space-y-4 py-3 border-b border-white/5">
              <label className="block text-sm text-slate-200">代替言語</label>
              <select
                value={settings.language_fallback || 'en-US'}
                onChange={(e) => handleSave('language_fallback', e.target.value)}
                className="input-field"
              >
                <option value="en-US">英語</option>
                <option value="ja-JP">日本語</option>
                <option value="zh-CN">中国語</option>
              </select>
              <p className="text-xs text-slate-500">主な認識言語で認識できなかった場合に使用</p>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-slate-200">自動検出</p>
                <p className="text-xs text-slate-500">話者の言語を自動的に切り替え</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_language === 'true'}
                  onChange={(e) => handleSave('auto_language', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">キーボードショートカット</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">ウィンドウ 表示/非表示</p>
                  <p className="text-xs text-slate-500">グローバルホットキー（アプリ外でも動作）</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + Shift + H</kbd>
              </div>
              
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">スクリーンショット取得</p>
                  <p className="text-xs text-slate-500">選択範囲をキャプチャしてAIに送信</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + Shift + C</kbd>
              </div>
              
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">回答コピー</p>
                  <p className="text-xs text-slate-500">クリップボードに即座にコピー</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + Return</kbd>
              </div>
              
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">AI再生成</p>
                  <p className="text-xs text-slate-500">同じプロンプトで再度LLM呼び出し</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + R</kbd>
              </div>
              
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">マイクON/OFF</p>
                  <p className="text-xs text-slate-500">音声認識のトグル</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + Shift + M</kbd>
              </div>
              
              <div className="flex justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm text-slate-200">設定を開く</p>
                </div>
                <kbd className="bg-slate-700 px-3 py-1.5 rounded text-sm">⌘ + ,</kbd>
              </div>
            </div>

            <button 
              onClick={() => {}}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
            >
              デフォルトに戻す
            </button>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">RAGナレッジベース</h3>
            
            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700/50">
              <p className="text-sm text-slate-400 mb-2">Pro機能</p>
              <p className="text-xs text-slate-500 mb-4">
                PDF/DOCXを読み込んでローカル埋め込み→文脈注入
              </p>
              <span className="text-xs px-3 py-1 bg-amber-900/50 text-amber-400 rounded">
                ⭐ Premium で利用可能
              </span>
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
              <p className="text-sm text-slate-400 mb-2">ドキュメントを追加</p>
              <p className="text-xs text-slate-500 mb-4">PDF、DOCX、TXT ファイル対応</p>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white">
                ファイルを選択
              </button>
            </div>
          </div>
        )}

        {activeTab === 'license' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-medium text-slate-200 border-b border-white/10 pb-2">ライセンス / プラン</h3>
            
            <div className="bg-gradient-to-r from-blue-900/30 to-slate-800/50 rounded-lg p-6 border border-blue-800/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-blue-400">Free プラン</p>
                  <p className="text-xs text-slate-400">現在おかれているプラン</p>
                </div>
                <span className="text-xs px-3 py-1 bg-blue-900/50 text-blue-300 rounded">アクティブ</span>
              </div>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>✓ リアルタイム音声認識</li>
                <li>✓ AI回答生成</li>
                <li>✓ SQLite セッション保存</li>
                <li>✓ BYOK (自带 API Key)</li>
                <li>✗ RAG ナレッジベース</li>
                <li>✗ Tavily ウェブ検索</li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300">ライセンスキーを入力</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="input-field flex-1"
                />
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white">
                  適用
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}