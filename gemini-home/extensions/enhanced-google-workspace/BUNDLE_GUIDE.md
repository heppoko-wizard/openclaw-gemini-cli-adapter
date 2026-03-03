# 配布向けビルドガイド（Build for Distribution）

このドキュメントは、`enhanced-google-workspace` 拡張機能を配布用にビルドする際の手順を記載します。

---

## 現在の動作モード（開発・ソースモード）

現在の構成では、`ts-node` で TypeScript ソースを直接実行しています。
ビルドは不要で、コードの改変もしやすい状態です。

```
workspace-server/src/index.ts  ← ts-node で直接起動
scripts/auth-setup.js          ← ts-node 経由で認証を実行
```

---

## 配布向けビルド手順

配布時は TypeScript をコンパイルして `dist/index.js` に単一バンドルします。
`esbuild` が使用されます。

### 1. 依存パッケージのインストール

```bash
cd enhanced-google-workspace
npm install
```

### 2. サーバー本体のビルド

```bash
npm run build
# または
npm run build --prefix workspace-server
```

→ `workspace-server/dist/index.js` が生成されます。

### 3. `gemini-extension.json` を配布用に切り替える

ビルド後は、MCP サーバーの起動コマンドを `ts-node` から `node` に変更してください。

```json
// ■ 開発モード（現在の設定）
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["ts-node", "src/index.ts"],
      "cwd": "${extensionPath}/workspace-server"
    }
  }
}
```

```json
// ■ 配布モード（ビルド後）
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "${extensionPath}/workspace-server"
    }
  }
}
```

### 4. 認証スクリプト（`scripts/auth-setup.js`）の更新

ビルド後は、`auth-setup.js` のビルドも実行します：

```bash
npm run build:auth-utils -w workspace-server
```

→ `workspace-server/dist/auth-utils.js` が生成されます。

`scripts/auth-setup.js` 冒頭の require パスを変更してください：

```diff
- const { AuthManager } = require('../workspace-server/src/auth/AuthManager');
+ const { AuthManager } = require('../workspace-server/dist/auth-utils');
```

また、`require('ts-node')` の登録コードも削除してください。

### 5. リリースパッケージへの組み込み

`pack_release.sh` の `BUNDLE_WORKSPACE_EXT=true` フラグを有効にすると、
`dist/` ビルド済みの状態でパッケージに含まれます。

---

## ファイル構成（配布後のイメージ）

```
release/openclaw-gemini-cli-adapter/
├── gemini-home/
│   ├── extensions/
│   │   └── enhanced-google-workspace/
│   │       ├── gemini-extension.json   ← "node dist/index.js" に変更済み
│   │       ├── scripts/
│   │       │   └── auth-setup.js       ← dist 参照に変更済み
│   │       └── workspace-server/
│   │           ├── dist/
│   │           │   ├── index.js        ← ビルド済み本体
│   │           │   └── auth-utils.js   ← ビルド済み認証ユーティリティ
│   │           └── node_modules/       ← native modules (keytar等) が必要
```

> [!NOTE]
> `keytar` はネイティブモジュールのため、`node_modules` ごと同梱する必要があります。
> あるいは `GEMINI_CLI_WORKSPACE_FORCE_FILE_STORAGE=true` を設定すると、
> keychain を使わず暗号化ファイルでトークンを保存するフォールバックが有効になります。

---

## 注意事項

- `CLIENT_ID` / `CLIENT_SECRET` は `config.ts` にデフォルト値としてハードコードされています。
  配布前に有効な GCP プロジェクトのクレデンシャルに差し替えてください。
- `cloudFunctionUrl` は現在 `https://google-workspace-extension.geminicli.com` が設定されています。
  自前の Cloud Function を利用する場合はここを変更してください。
