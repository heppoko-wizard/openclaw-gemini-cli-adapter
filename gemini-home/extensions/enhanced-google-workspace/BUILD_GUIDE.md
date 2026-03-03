# Google Workspace 拡張機能：ビルド＆配布ガイド (for LLM/AI Agents)

このドキュメントは、AIエージェントが本拡張機能のメンテナンスおよび配布用パッケージングを行うための指示書です。

## 1. バンドル（index.js化）が必要な理由
本拡張機能を「配布用」としてまとめる際は、必ず `workspace-server/dist/index.js` に全ての依存関係をバンドルする必要があります。

*   **ポータビリティの確保**: ユーザー環境に `node_modules` がなくても、単一の JS ファイルだけで動作させるため。
*   **配布サイズの削減**: 数千のファイルからなる `node_modules` を同梱せず、必要なコード（約12MB程度）のみを抽出するため。
*   **認証情報の秘匿準備**: 将来的に Cloud Function 経由での取得に切り替える際、ロジックをバイナリ内に隠蔽しやすくするため。

## 2. 開発と配布の切り替え
`gemini-extension.json` の `mcpServers` 設定を、用途に応じて書き換えてください。

### 開発モード (現在の設定)
ソースコード (`src/*.ts`) を直接実行します。変更が即座に反映されます。
```json
"command": "npm",
"args": ["run", "start"],
"cwd": "${extensionPath}/workspace-server"
```

### 配布モード
ビルド済みのバイナリを実行します。`node_modules` が不要になります。
```json
"command": "node",
"args": ["${extensionPath}/workspace-server/dist/index.js"],
"cwd": "${extensionPath}"
```

## 3. ビルド手順（パッケージング時）
配布用パッケージを作成する際は、必ず以下の手順でビルドを完了させてください。

1.  `workspace-server` ディレクトリへ移動
2.  `npm install` を実行（依存関係の解決）
3.  `npm run build` を実行
    *   内部で `esbuild` が走り、`src/index.ts` を起点に全ての依存関係（`googleapis` 等）を `dist/index.js` に統合します。

## 4. 配布時に「含めるべき」ファイルと「除外すべき」ファイル

### ✅ 含めるもの
*   `gemini-extension.json` (マニフェスト)
*   `workspace-server/dist/index.js` (ビルド済み本体)
*   `commands/` (スラッシュコマンド定義)
*   `scripts/auth-setup.js` (自動認証スクリプト)
*   `WORKSPACE-Context.md` (AI用コンテキスト)

### ❌ 除外するもの（絶対パスに含めない）
*   `node_modules/` (巨大かつOS依存があるため)
*   `src/` (TypeScriptソースコード、ソースを秘匿する場合)
*   `*.token.json`, `*master-key` (開発者の認証キャッシュ)
*   `.git/` フォルダ

## 5. 認証設定の注意
現在、`workspace-server/src/utils/config.ts` には特定の GCP プロジェクトの Client ID/Secret がデフォルト値として埋め込まれています。これを変更する場合は、ソースを修正した後に必ず「再ビルド」を行ってください。
