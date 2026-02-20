# OpenClaw Gemini Backend

OpenClaw の推論エンジンとして [Gemini CLI](https://github.com/google-gemini/gemini-cli) を使用するためのアダプターです。

**対応OS: Linux / macOS / Windows**

## 仕組み

```
OpenClaw デーモン
    │  (stdin/stdout)
    ▼
adapter.js          ← OpenClawからのプロンプトをGemini CLI用に変換
    │  (子プロセス)
    ▼
Gemini CLI
    │  (MCP stdio)
    ▼
mcp-server.mjs      ← OpenClawのツール群をMCP経由でGemini CLIに公開
    │  (import)
    ▼
OpenClaw tools      ← message, cron, sessions_send, subagents 等
```

## ファイル構成

| ファイル | 役割 |
|---|---|
| `adapter.js` | OpenClaw↔Gemini CLI のブリッジ（CJS、メインアダプター） |
| `adapter-template.md` | Gemini CLIへのシステムプロンプトテンプレート（AIが自己最適化可能） |
| `mcp-server.mjs` | OpenClawツールをMCP経由で公開するサーバー（ESM） |
| `setup.js` | インストールスクリプト（クロスプラットフォーム） |
| `package.json` | 依存関係（`@google/gemini-cli`, `@modelcontextprotocol/sdk`） |

## インストール

**前提条件**
- Node.js v18 以上
- OpenClaw がインストール済みで `~/.openclaw/openclaw.json` が存在すること
- Gemini CLI の認証設定が完了していること（`~/.gemini/` に認証情報があること）

**セットアップ手順（全OS共通）**

```bash
# 1. OpenClaw リポジトリをクローン
git clone <openclaw-repo>
cd openclaw

# 2. OpenClaw 本体のビルド（初回のみ）
npm install && npm run build

# 3. Gemini バックエンドのセットアップ
cd gemini-backend
node setup.js
# または: npm run setup
```

`setup.js` が自動的に:
- npm 依存関係をインストール
- `~/.openclaw/openclaw.json` に `gemini-adapter` バックエンドを登録

## 使い方

セットアップ後、OpenClaw の設定で `provider: "gemini-adapter"` を指定するか、以下のコマンドでテストできます:

```bash
# OpenClaw ルートから（--local で gemini-adapter バックエンドを使用）
node scripts/run-node.mjs agent -m "こんにちは" --local
```

## MCP ツール

Gemini CLI から利用可能な OpenClaw 固有ツール（`mcp-server.mjs` が公開）:

| ツール | 説明 |
|---|---|
| `message` | Discord / Telegram 等へのメッセージ送信 |
| `cron` | スケジュール実行・リマインダー |
| `sessions_send` | 別セッションへのメッセージ送信 |
| `sessions_spawn` | バックグラウンドサブエージェントの起動 |
| `subagents` | サブエージェントの管理 |
| `web_search` | Brave Search API による Web 検索 |
| `web_fetch` | URL からコンテンツ取得 |
| `memory_search` | 記憶の意味的検索 |
| `gateway` | OpenClaw ゲートウェイの設定・再起動 |

Gemini CLI 自身が持つファイル操作・シェル実行ツールと重複するもの (`read`, `write`, `exec` 等) は自動的に除外されます。

## カスタマイズ

### システムプロンプトの編集

`adapter-template.md` を直接編集することで Gemini CLI のティラの振る舞いをカスタマイズできます。
また、Gemini CLI 自身に `adapter-template.md` を分析・改善させる「自己最適化」も可能です。

### プロンプトの変数

| 変数 | 内容 |
|---|---|
| `{{PROVIDED_SYSTEM_PROMPT}}` | OpenClaw が動的生成するコアプロンプト |
| `{{WORKSPACE}}` | ワークスペースディレクトリのパス |
| `{{HEARTBEAT_PROMPT}}` | ハートビートの指示 |
| `{{HEARTBEAT_CONTENT}}` | HEARTBEAT.md の内容 |
