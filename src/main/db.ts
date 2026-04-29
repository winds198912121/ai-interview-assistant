import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import log from 'electron-log/main.js'

export interface Session {
  id: string
  title: string
  mode: string
  created_at: string
  updated_at: string
  summary?: string
  duration_secs?: number
}

export interface TranscriptSegment {
  id: number
  session_id: string
  speaker: string
  text: string
  start_ms: number
  end_ms: number
  confidence: number
  source: string
}

export interface AIResponse {
  id: number
  session_id: string
  prompt_text: string
  response_text: string
  model_used: string
  tokens_in: number
  tokens_out: number
  created_at: string
}

export class DatabaseManager {
  private db: Database.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'ai-interview.db')
    log.info(`Database path: ${dbPath}`)
    
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        summary TEXT,
        duration_secs INTEGER DEFAULT 0,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS transcript_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        speaker TEXT DEFAULT 'unknown',
        text TEXT NOT NULL,
        start_ms INTEGER DEFAULT 0,
        end_ms INTEGER DEFAULT 0,
        confidence REAL DEFAULT 1.0,
        source TEXT DEFAULT 'mic',
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        response_text TEXT NOT NULL,
        model_used TEXT DEFAULT 'unknown',
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_segments(session_id);
      CREATE INDEX IF NOT EXISTS idx_ai_session ON ai_responses(session_id);
    `)

    const defaultSettings = [
      ['deepgram_api_key', ''],
      ['openai_api_key', ''],
      ['anthropic_api_key', ''],
      ['google_api_key', ''],
      ['default_model', 'gemini-2.0-flash-exp'],
      ['stt_provider', 'deepgram'],
      ['language', 'ja-JP'],
      ['stealth_mode', 'true']
    ]

    const insertSetting = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    )
    for (const [key, value] of defaultSettings) {
      insertSetting.run(key, value)
    }

    log.info('Database tables initialized')
  }

  getSessions(): Session[] {
    return this.db
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all() as Session[]
  }

  createSession(data: { title?: string; mode?: string }): Session {
    const id = crypto.randomUUID()
    const title = data.title || `面接 ${new Date().toLocaleString('ja-JP')}`
    const mode = data.mode || 'general'

    this.db
      .prepare('INSERT INTO sessions (id, title, mode) VALUES (?, ?, ?)')
      .run(id, title, mode)

    return this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as Session
  }

  getSession(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  addTranscript(data: Omit<TranscriptSegment, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO transcript_segments 
        (session_id, speaker, text, start_ms, end_ms, confidence, source) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.session_id,
        data.speaker,
        data.text,
        data.start_ms,
        data.end_ms,
        data.confidence,
        data.source
      )
  }

  getTranscripts(sessionId: string): TranscriptSegment[] {
    return this.db
      .prepare('SELECT * FROM transcript_segments WHERE session_id = ? ORDER BY start_ms')
      .all(sessionId) as TranscriptSegment[]
  }

  addAIResponse(data: Omit<AIResponse, 'id' | 'created_at'>): void {
    this.db
      .prepare(
        `INSERT INTO ai_responses 
        (session_id, prompt_text, response_text, model_used, tokens_in, tokens_out) 
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.session_id,
        data.prompt_text,
        data.response_text,
        data.model_used,
        data.tokens_in,
        data.tokens_out
      )
  }

  getAIResponses(sessionId: string): AIResponse[] {
    return this.db
      .prepare('SELECT * FROM ai_responses WHERE session_id = ? ORDER BY created_at')
      .all(sessionId) as AIResponse[]
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  }
}
