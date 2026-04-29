import React, { useState, useEffect } from 'react'

interface Session {
  id: string
  title: string
  mode: string
  created_at: string
  updated_at: string
}

interface SessionListProps {
  onBack: () => void
}

export default function SessionList({ onBack }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    const data = await window.electron?.db.getSessions()
    if (data) setSessions(data)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await window.electron?.db.deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP')
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-11 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white">
            ← 戻る
          </button>
          <span className="text-sm font-medium">面接履歴</span>
        </div>
        <span className="text-xs text-slate-400">{sessions.length}件</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            読み込み中...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <p className="mb-2">面接履歴がありません</p>
            <button onClick={onBack} className="btn-primary">
              新しい面接を開始
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-600"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-slate-200">{session.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-slate-700 rounded">
                        {session.mode}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(session.updated_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="text-slate-500 hover:text-red-400 text-sm"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
