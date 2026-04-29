[AI_Interview_Assistant_設計書.docx](https://github.com/user-attachments/files/27190966/AI_Interview_Assistant_.docx)
[AI_Interview_Assistant_設計書.md](https://github.com/user-attachments/files/27190969/AI_Interview_Assistant_.md)
**AI INTERVIEW & MEETING ASSISTANT**

技術設計規格書 / Technical Design Specification

────────────────────────────────────────────────────

Version: 1.0.0

作成日: 2026年4月

対象プラットフォーム: macOS 12.0+

開発言語: TypeScript / Rust

**第1章　製品概要**

**1.1　プロダクトビジョン**

本アプリケーションは、AI技術を活用したリアルタイム面接・会議支援デスクトップアプリです。音声を自動認識し、LLMが即座に最適な回答候補を生成します。画面録画・スクリーンシェアからは完全に不可視（ステルスモード）で動作します。

**1.2　主要機能一覧**

|                   |                                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| **リアルタイム音声認識**    | システム音声・マイクを同時キャプチャし、話者を自動識別しながらテキスト化（Deepgram WebSocket / Google STT）         |
| **AI即時提案**        | 文字起こしをLLMに送信し、面接回答・会議メモ・交渉アドバイスをストリーミングで表示（Gemini / OpenAI / Claude / Groq）   |
| **ステルスモード**       | setContentProtection(true) によりZoom / Meet / Teams の画面共有に映らない不可視オーバーレイ         |
| **BYOK（自前APIキー）** | 全LLM・STTプロバイダーへの自前APIキー対応。月額課金なし                                              |
| **RAGナレッジベース**    | PDF/DOCXを読み込み、@xenova/transformersでローカル埋め込み→文脈注入                              |
| **ウェブ検索統合**       | Tavily API経由でリアルタイム検索。企業情報・求人票を瞬時に調査                                          |
| **モード管理**         | General / Sales / Recruiting / Technical / Lecture / Negotiation など7種類のAIペルソナ |
| **セッション記録**       | 全会議を SQLite に保存。過去のトランスクリプト・AI回答を検索・再生可能                                      |

**1.3　競合比較**

|           |            |            |                    |                     |
| --------- | ---------- | ---------- | ------------------ | ------------------- |
| **機能**    | **本アプリ**   | **Cluely** | **Final Round AI** | **Interview Coder** |
| 月額料金      | 無料 (BYOK)  | $29〜       | $24〜               | $60〜                |
| オープンソース   | ✅          | ❌          | ❌                  | ❌                   |
| データプライバシー | 完全ローカル     | サーバ送信      | サーバ送信              | サーバ送信               |
| ステルスモード   | ✅          | ✅          | ✅                  | ✅                   |
| ローカルLLM   | ✅ (Ollama) | ❌          | ❌                  | ❌                   |
| RAG/文書    | ✅          | 有料プランのみ    | 有料プランのみ            | ❌                   |

**第2章　システムアーキテクチャ**

**2.1　全体アーキテクチャ図**

![architecture.png](media/03909dc19c4e4b30f2537c3ed83762f6e79de24e.png "architecture.png")

*図2-1 全体アーキテクチャ（Electron Main Process / Renderer / External Services）*

**2.2　プロセスモデル**

Electronアプリは2つのプロセスで構成されます：

  - Main Process（Node.js）: ウィンドウ管理・音声キャプチャ・DB・IPC・ライセンス管理を担当

  - Renderer Process（React）: UI描画・ユーザーインタラクション・状態管理（Zustand）を担当

> *💡 セキュリティ上、APIキーはMain Processのみが保持。Rendererとの通信はIPC経由のみ。*

**2.3　技術スタック選定**

|          |                       |                                            |
| -------- | --------------------- | ------------------------------------------ |
| **技術**   | **選定**                | **理由**                                     |
| デスクトップ基盤 | Electron 33+          | クロスプラットフォーム・豊富なエコシステム                      |
| フロントエンド  | React 18 + TypeScript | コンポーネント指向・型安全・大規模開発                        |
| ビルドツール   | electron-vite         | HMR対応・高速ビルド・Electron特化                     |
| UIスタイリング | Tailwind CSS v4       | ユーティリティファースト・デザイン一貫性                       |
| 状態管理     | Zustand               | 軽量・boilerplate最小・React外からも参照可              |
| ローカルDB   | better-sqlite3        | 同期API・高速・Electron組み込みに最適                   |
| 音声キャプチャ  | Rust + napi-rs        | macOS Core Audio/ScreenCaptureKit への直接アクセス |
| STT（主）   | Deepgram WebSocket    | 最低遅延・Nova-3モデル・話者分離対応                      |
| LLM      | Vercel AI SDK         | 複数プロバイダー統一・ストリーミング対応                       |
| RAGベクトル  | @xenova/transformers  | ブラウザ/Node実行・オフライン・all-MiniLM-L6            |
| 検索API    | Tavily API            | LLM向け最適化・高精度・構造化レスポンス                      |
| パッケージング  | electron-builder      | macOS .dmg / Windows .exe 自動ビルド            |

**第3章　UI / UX デザイン仕様**

**3.1　デザイン原則**

  - 最小視覚フットプリント: 常時画面上に浮遊するため、透過度・サイズを最小限に

  - ダークモード必須: 長時間使用・ステルス性のためダークテーマのみサポート

  - ゼロクリック操作: 主要機能はすべてキーボードショートカットでアクセス可能

  - 非破壊的: アプリが前面に来ても背景操作（面接）を妨げない設計

**3.2　カラーシステム**

|                    |                                    |
| ------------------ | ---------------------------------- |
| **背景 Primary**     | \#0F172A （Slate 900） — メインオーバーレイ背景 |
| **背景 Secondary**   | \#1E293B （Slate 800） — パネル・サイドバー   |
| **アクセント Blue**     | \#2563EB （Blue 600） — ボタン・アクティブ状態  |
| **テキスト Primary**   | \#F1F5F9 （Slate 100） — メインテキスト     |
| **テキスト Secondary** | \#94A3B8 （Slate 400） — ラベル・サブテキスト  |
| **成功 Green**       | \#22C55E — 接続中・OK状態                |
| **警告 Amber**       | \#F59E0B — Pro機能・注意                |
| **エラー Red**        | \#EF4444 — エラー・録音中インジケーター          |
| **ボーダー**           | \#FFFFFF 8%透過 — パネル境界線             |

**3.3　メインオーバーレイウィンドウ**

![main\_window.png](media/fcc7a4a88122230ce8c2e556318f710a0c568dd6.png "main_window.png")

*図3-1 メインオーバーレイウィンドウ（ステルスモード時）*

**ウィンドウ仕様**

|               |                                               |
| ------------- | --------------------------------------------- |
| **デフォルトサイズ**  | 760 × 480 px（ユーザーリサイズ可）                       |
| **透過度**       | 背景色に97%不透明度（rgba使用）                           |
| **常時最前面**     | win.setAlwaysOnTop(true, "floating") を使用      |
| **ドラッグ**      | タイトルバー部分のみ -webkit-app-region: drag           |
| **スクリーン録画除外** | win.setContentProtection(true) — Zoom/Meet不可視 |
| **クリックスルー**   | イベント未捕捉エリアは下レイヤーに通す                           |

**レイアウト構成**

  - タイトルバー（44px）: アプリ名 / モード選択ピル / ツールバーボタン

  - トランスクリプトパネル（左50%）: リアルタイム文字起こし / 話者タグ / 録音インジケーター

  - AI提案パネル（右50%）: LLM回答 / コピー / 再生成 / 展開ボタン

  - フッターバー（32px）: キーボードショートカットヒント

**3.4　設定ウィンドウ**

![settings\_window.png](media/3ea6ee3b97102a5014ef14e4c8d797803dfda8b0.png "settings_window.png")

*図3-2 設定ウィンドウ — APIキー・動作設定*

**設定タブ構成**

|                   |                               |
| ----------------- | ----------------------------- |
| **General**       | 起動設定 / ステルスモード / 自動言語検出       |
| **AI Models**     | LLMプロバイダー選択 / APIキー登録 / モデル選択 |
| **Audio**         | STTプロバイダー / 入出力デバイス選択 / 感度調整  |
| **Language**      | 認識言語設定 / 代替言語 / 自動検出ON/OFF    |
| **Shortcuts**     | カスタムキーバインド設定 / リセット           |
| **Knowledge**     | RAGドキュメント管理（PDF/DOCX追加・削除）    |
| **Pro / License** | ライセンスキー入力 / プラン確認 / 解除        |

**3.5　キーボードショートカット**

|               |              |                      |
| ------------- | ------------ | -------------------- |
| **ショートカット**   | **機能**       | **備考**               |
| ⌘ + Shift + H | ウィンドウ 表示/非表示 | グローバルホットキー（アプリ外でも動作） |
| ⌘ + Shift + C | スクリーンショット取得  | OCR解析してAIに送信         |
| ⌘ + Return    | 回答コピー        | クリップボードに即座にコピー       |
| ⌘ + R         | AI再生成        | 同じプロンプトで再度LLM呼び出し    |
| ⌘ + Shift + M | マイクON/OFF    | トグル                  |
| ⌘ + Shift + A | 全音声ON/OFF    | システム音声キャプチャ トグル      |
| ⌘ + ,         | 設定を開く        | Settings Window表示    |
| Esc           | パネルを閉じる      | サブウィンドウを閉じる          |

**第4章　コアモジュール設計**

**4.1　音声キャプチャモジュール（Rust）**

音声キャプチャはネイティブRustモジュールとして実装します。macOS の ScreenCaptureKit / Core Audio を直接操作することで、低遅延かつシステム音声・マイク同時キャプチャを実現します。

**Rustクレート構成**

> napi-rs = "2.x" \# Node.js ネイティブバインディング
> 
> screencapturekit = "0.x" \# macOS ScreenCaptureKit Rustラッパー
> 
> coreaudio-rs = "0.x" \# マイクキャプチャ
> 
> webrtc-vad = "0.x" \# 音声区間検出（VAD）

**エクスポートAPI**

> // Rustから Node.js に公開する関数
> 
> getHardwareId() -\> String // デバイス固有ID
> 
> getInputDevices() -\> Vec\<AudioDeviceInfo\>
> 
> getOutputDevices() -\> Vec\<AudioDeviceInfo\>
> 
> // SystemAudioCapture クラス
> 
> start(callback: fn, onSpeechEnded?: fn) -\> void
> 
> stop() -\> void
> 
> getSampleRate() -\> u32 // 常に 16000 Hz
> 
> *💡 ビルドコマンド: cargo build --release → dist-native/{arch}/native.node*

**4.2　音声認識（STT）モジュール**

複数のSTTプロバイダーを統一インターフェースで管理します。推奨はDeepgram（最低遅延）です。

|                            |                                                 |
| -------------------------- | ----------------------------------------------- |
| **DeepgramStreamingSTT**   | WebSocketでPCMをストリーミング送信。Nova-3モデル使用。話者分離・中間結果対応 |
| **OpenAIStreamingSTT**     | Whisper v3 Turbo。多言語高精度。REST + チャンクアップロード       |
| **GoogleSTT**              | gRPC streaming。中国語・日本語精度が高い。低コスト                |
| **ElevenLabsStreamingSTT** | Scribe API。話者分離（diarization）に特化                 |
| **LocalWhisperSTT**        | whisper.cpp をNode子プロセスで実行。完全オフライン               |

**STTインターフェース仕様**

> interface ISTTProvider extends EventEmitter {
> 
> start(deviceId?: string): void
> 
> stop(): void
> 
> setLanguage(bcp47: string): void
> 
> // Events:
> 
> // "transcript" -\> { text, isFinal, speaker, confidence }
> 
> // "error" -\> Error
> 
> }

**4.3　LLM推論モジュール**

Vercel AI SDK を使用して複数のLLMプロバイダーを統一します。全プロバイダーでストリーミング出力をサポートします。

**対応プロバイダーと推奨モデル**

|               |                           |        |                   |
| ------------- | ------------------------- | ------ | ----------------- |
| **プロバイダー**    | **モデル**                   | **速度** | **用途**            |
| Google Gemini | gemini-2.0-flash-exp      | ★★★★★  | 推奨デフォルト・無料枠大      |
| Groq          | llama-3.3-70b-versatile   | ★★★★★  | 超低遅延・面接リアルタイム向け   |
| OpenAI        | gpt-4o-mini               | ★★★★☆  | 高品質・コスト効率良好       |
| Anthropic     | claude-3-5-haiku-20241022 | ★★★★☆  | 長文・コーディング問題       |
| Ollama        | llama3.2 / gemma3         | ★★★☆☆  | 完全オフライン・プライバシー最重視 |

**4.4　RAGナレッジベースモジュール（Pro）**

ユーザーのPDF・DOCX・テキストをローカルで埋め込みベクトル化し、面接中の質問に対して関連コンテキストを自動挿入します。

  - ドキュメント解析: mammoth（DOCX）/ pdf-parse（PDF）/ テキスト直接

  - チャンキング: 512トークン / 128トークンオーバーラップ

  - ベクトル化: @xenova/transformers（all-MiniLM-L6-v2, 384次元）— ローカル実行

  - 検索: ハイブリッド（コサイン類似度 + BM25キーワード）

  - コンテキスト注入: 上位3チャンクをLLMプロンプトのsystem部分に追加

> *💡 Ollama埋め込みモデル（nomic-embed-text, 768次元）も選択可能。精度向上*

**4.5　ウィンドウ管理モジュール**

|                         |                                     |
| ----------------------- | ----------------------------------- |
| **MainOverlay**         | 常時最前面 / ステルス / リサイズ可 / 透過背景         |
| **SettingsWindow**      | 通常ウィンドウ / モーダル風 / 660×520px         |
| **ModelSelectorWindow** | ポップオーバー / 320×480px / ドロップダウン風      |
| **CropperWindow**       | フルスクリーン透過 / ドラッグで矩形選択 / スクリーンショット取得 |

**第5章　データベース設計**

**5.1　スキーマ図**

![db\_schema.png](media/6eeeb8c4cdb024b32ac78e38c3a09da3f6f0ee9f.png "db_schema.png")

*図5-1 SQLiteスキーマ設計*

**5.2　テーブル詳細**

**sessions テーブル**

|                               |                                                    |
| ----------------------------- | -------------------------------------------------- |
| **id**                        | TEXT PRIMARY KEY — UUID v4                         |
| **title**                     | TEXT — ユーザー設定タイトル（デフォルト: 日時自動生成）                   |
| **mode**                      | TEXT — general / sales / technical / recruiting など |
| **created\_at / updated\_at** | DATETIME — ISO8601形式                               |
| **summary**                   | TEXT — LLM生成サマリー（セッション終了時）                         |
| **duration\_secs**            | INTEGER — 録音時間（秒）                                  |
| **metadata\_json**            | TEXT — 追加メタ情報（JSON文字列）                             |

**transcript\_segments テーブル**

|                         |                                                |
| ----------------------- | ---------------------------------------------- |
| **id**                  | INTEGER PRIMARY KEY AUTOINCREMENT              |
| **session\_id**         | TEXT REFERENCES sessions(id) ON DELETE CASCADE |
| **speaker**             | TEXT — "user" / "interviewer" / "unknown"      |
| **text**                | TEXT — 認識テキスト                                  |
| **start\_ms / end\_ms** | INTEGER — セッション開始からのミリ秒オフセット                   |
| **confidence**          | REAL — STT信頼度スコア 0.0〜1.0                       |
| **source**              | TEXT — "mic" / "system"                        |
| **embedding**           | BLOB — Float32Array (384次元) — RAG検索用           |

**ai\_responses テーブル**

|                              |                              |
| ---------------------------- | ---------------------------- |
| **session\_id**              | TEXT REFERENCES sessions(id) |
| **prompt\_text**             | TEXT — LLMに送ったプロンプト全文        |
| **response\_text**           | TEXT — LLM回答全文               |
| **model\_used**              | TEXT — 実際に使用したモデル名           |
| **tokens\_in / tokens\_out** | INTEGER — 使用トークン数（コスト計算用）    |

**第6章　API統合仕様**

**6.1　Deepgram STT — WebSocket接続**

> // WebSocket URL
> 
> wss://api.deepgram.com/v1/listen?
> 
> model=nova-3\&language=en-US\&smart\_format=true
> 
> \&diarize=true\&interim\_results=true\&endpointing=300
> 
> // 接続ヘッダー
> 
> Authorization: Token {DEEPGRAM\_API\_KEY}
> 
> // 送信: 16kHz Mono PCM Int16 バイナリフレーム
> 
> // 受信: JSON { channel: { alternatives: \[{ transcript, confidence }\] },
> 
> // is\_final: bool, speech\_final: bool }
> 
> *💡 is\_final=falseは中間結果（リアルタイム表示用）。speech\_final=trueで確定テキストをLLMに送信。*

**6.2　LLM API — Vercel AI SDK**

> import { streamText } from "ai"
> 
> import { google } from "@ai-sdk/google"
> 
> const { textStream } = await streamText({
> 
> model: google("gemini-2.0-flash-exp"),
> 
> system: buildSystemPrompt(mode, ragContext),
> 
> messages: \[{ role: "user", content: transcriptWindow }\],
> 
> maxTokens: 512,
> 
> temperature: 0.7,
> 
> })
> 
> for await (const chunk of textStream) { /\* UI更新 \*/ }

**6.3　Tavily 検索API（Pro）**

> POST https://api.tavily.com/search
> 
> { "query": "...", "search\_depth": "advanced",
> 
> "max\_results": 5, "include\_raw\_content": "markdown" }
> 
> Authorization: Bearer {TAVILY\_API\_KEY}
> 
> *💡 1リクエスト = 1クレジット。$5/月プランで月100クレジット。面接中の企業調査に使用。*

**6.4　IPCハンドラー一覧（主要）**

|                             |                         |
| --------------------------- | ----------------------- |
| **audio:start-capture**     | STT + システム音声キャプチャ開始     |
| **audio:stop-capture**      | キャプチャ停止                 |
| **audio:get-devices**       | 入出力デバイス一覧取得             |
| **llm:generate**            | LLM推論（ストリーミング）          |
| **llm:abort**               | 現在の推論をキャンセル             |
| **session:create**          | 新規セッション作成（DB）           |
| **session:save-transcript** | トランスクリプトセグメント保存         |
| **session:list**            | セッション一覧取得（ページング）        |
| **settings:get / set**      | 設定値の読み書き                |
| **license:activate**        | ライセンスキー認証（Dodo/Gumroad） |
| **license:check**           | Premium状態確認             |
| **knowledge:add-document**  | RAGドキュメント追加（埋め込み生成）     |
| **knowledge:search**        | RAGベクトル検索               |
| **screenshot:capture-area** | クロッパーで選択領域をキャプチャ        |

**第7章　開発環境構築**

**7.1　必要環境**

|                 |                                      |
| --------------- | ------------------------------------ |
| **macOS**       | 12.0 Monterey 以上（ScreenCaptureKit必須） |
| **Node.js**     | 20.x LTS 以上                          |
| **Rust**        | 1.75+ （rustup で管理）                   |
| **Xcode**       | 14+ （macOS SDKのため）                   |
| **napi-rs CLI** | npm install -g @napi-rs/cli          |
| **Git**         | 2.x 以上                               |

**7.2　プロジェクト初期化**

> \# 1. Electronプロジェクト作成
> 
> npm create electron-vite@latest my-ai-assistant
> 
> cd my-ai-assistant && npm install
> 
> \# 2. 主要パッケージインストール
> 
> npm install ai @ai-sdk/google @ai-sdk/openai @ai-sdk/anthropic
> 
> npm install @deepgram/sdk zustand better-sqlite3
> 
> npm install @xenova/transformers mammoth pdf-parse
> 
> npm install @tavily/core ws
> 
> \# 3. Rustネイティブモジュール初期化
> 
> napi new native-module --platform-targets darwin-arm64,darwin-x64
> 
> cd native-module && cargo add screencapturekit coreaudio-rs webrtc-vad
> 
> \# 4. 開発起動
> 
> npm run dev

**7.3　ディレクトリ構成**

> my-ai-assistant/
> 
> ├── electron/ \# Main Process
> 
> │ ├── main.ts
> 
> │ ├── WindowHelper.ts
> 
> │ ├── IPCHandlers.ts
> 
> │ ├── audio/ \# STT プロバイダー群
> 
> │ ├── llm/ \# LLM ヘルパー
> 
> │ ├── db/ \# DatabaseManager + マイグレーション
> 
> │ ├── rag/ \# RAG パイプライン
> 
> │ └── services/ \# CredentialsManager, SessionTracker
> 
> ├── src/ \# Renderer (React)
> 
> │ ├── components/ \# UIコンポーネント
> 
> │ │ ├── MainOverlay/
> 
> │ │ ├── TranscriptPanel/
> 
> │ │ ├── AISuggestionPanel/
> 
> │ │ └── Settings/
> 
> │ ├── stores/ \# Zustand stores
> 
> │ └── hooks/ \# カスタムフック
> 
> ├── native-module/ \# Rust ネイティブ
> 
> │ ├── src/
> 
> │ │ ├── audio.rs
> 
> │ │ ├── hwid.rs
> 
> │ │ └── lib.rs
> 
> │ └── Cargo.toml
> 
> └── resources/
> 
> └── models/ \# Xenova 埋め込みモデル

**7.4　ビルドコマンド**

|                           |                                  |
| ------------------------- | -------------------------------- |
| **npm run dev**           | 開発モード起動（HMR有効）                   |
| **npm run build**         | 本番ビルド（Renderer + Main）           |
| **npm run dist:mac**      | macOS .dmg パッケージ生成（arm64 + x64）  |
| **npm run dist:win**      | Windows .exe パッケージ生成（要Windows環境） |
| **cargo build --release** | Rustネイティブモジュールのリリースビルド           |
| **napi build --release**  | Rustモジュールを .node ファイルにビルド        |
| **npm run test**          | Jest + Playwright E2Eテスト実行       |

**第8章　開発ロードマップ**

**フェーズ1: MVP（目標: 4週間）**

  - Week 1: Electron + React + Zustand 骨格 / 設定画面 / APIキー管理

  - Week 2: Deepgram STT 接続 / リアルタイムトランスクリプト表示

  - Week 3: Gemini / OpenAI LLM ストリーミング / AI提案パネル

  - Week 4: ステルスモード / ショートカット / 基本DB保存

> *💡 この段階でシステム音声はElectron desktopCapturerで代替可能（Rust不要）*

**フェーズ2: システム音声 + Rust（目標: 週3〜6週間）**

  - Rust napi-rs セットアップ / macOS ScreenCaptureKit バインディング

  - マイク + システム音声の同時キャプチャ

  - VAD（音声区間検出）実装 / 無音区間スキップ

  - HWID取得 / ライセンス基盤実装

**フェーズ3: Pro機能（目標: 週3週間）**

  - @xenova/transformers RAGパイプライン構築

  - PDF / DOCX 解析 + チャンキング + ベクトルDB

  - Tavily検索 API 統合

  - モック面試ジェネレーター / STAR生成 / 薪資交渉アドバイザー

**フェーズ4: 品質 + リリース（目標: 2週間）**

  - Playwright E2Eテスト / Jest単体テスト 80%カバレッジ

  - electron-builder による .dmg / .exe 自動生成

  - 自動アップデート（electron-updater + GitHub Releases）

  - コードサイニング（macOS公証・Windowsコードサイン）

**総合工数見積もり**

|                            |                                     |
| -------------------------- | ----------------------------------- |
| **Rust経験あり（1年以上）**         | 全フェーズ合計: 約 8〜10 週間（1人開発）            |
| **Rust経験なし**               | 全フェーズ合計: 約 14〜18 週間（Rustキャッチアップ含む）  |
| **チーム2名（Frontend + Rust）** | 約 6〜8 週間でリリース可能                     |
| **MVP先行リリース（Rust後回し）**     | 約 4 週間でElectron desktopCapturerでMVP |

── END OF DOCUMENT ──
