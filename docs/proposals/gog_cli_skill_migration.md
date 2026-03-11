# 提案: GWS CLI スキルの gog CLI 向け移行計画

## 背景・目的

現在のプロジェクト（OpenClaw Gemini CLI Adapter）では、Google Workspace との連携に **GWS CLI（`googleworkspace/cli`）** を使用している。
しかし、GWS CLIには以下の制約がある：

- **スコープのカスタマイズができない**: `gws auth login` のインタラクティブUIに `drive.appdata` など非機密スコープの選択肢がない
- **制限付きスコープ（`auth/drive` 等）を要求する**: Google APIの公開審査（CASA）に引っかかるリスクがある

これに対し **gog CLI（`gogcli.sh`）** は `--extra-scopes` フラグで任意のスコープを指定でき、審査不要の非機密スコープのみで認証できるため、将来的な公開を見越したスキル移行を提案する。

---

## gog CLI の優位点

| 比較項目 | GWS CLI | **gog CLI** |
|---|---|---|
| スコープのカスタマイズ | ❌ UIで手動選択のみ | ✅ `--extra-scopes` フラグで完全指定可能 |
| `drive.appdata` の取得 | ❌ 選択肢なし | ✅ `--extra-scopes https://www.googleapis.com/auth/drive.appdata` |
| 複数アカウント対応 | 不明 | ✅ 対応 |
| Google公式メンテナンス | ✅ | ❌（個人OSS） |
| Gemini CLIとの統合設計 | ✅ skills/完備 | ❌（スキルのgog対応は自前実装が必要） |

**→ 結論: 両方インストールして用途で使い分ける（gog: Drive保存 / gws: Geminiエージェント連携）**

---

## 採用スキル一覧（プロジェクトスコープとの対応）

プロジェクトの GCP OAuth 同意画面に登録したスコープに対応するスキルのみを採用する。

| スキル（元GWSスキル名） | 対応スコープ | 移行後コマンド | 備考 |
|---|---|---|---|
| `gws-calendar` | `auth/calendar` | `gog calendar` | イベント管理全般 |
| `gws-calendar-agenda` | `auth/calendar` | `gog calendar events list` | 予定確認ヘルパー |
| `gws-calendar-insert` | `auth/calendar` | `gog calendar events insert` | 予定作成ヘルパー |
| `gws-docs` | `auth/documents` | `gog docs` | ドキュメント管理 |
| `gws-docs-write` | `auth/documents` | `gog docs documents batchUpdate` | ドキュメント書き込み |
| `gws-sheets` | `auth/spreadsheets.readonly` | `gog sheets` | スプレッドシート読み込み |
| `gws-sheets-read` | `auth/spreadsheets.readonly` | `gog sheets spreadsheets.values.get` | 値の取得ヘルパー |
| `gws-tasks` | `auth/tasks` | `gog tasks` | タスク管理 |
| `gws-people` | `auth/contacts`, `auth/contacts.readonly` | `gog people` | 連絡先管理 |
| `gws-chat` | `auth/chat.spaces`, `auth/chat.memberships` | `gog chat` | Chat スペース管理 |
| `gws-chat-send` | `auth/chat.spaces` | `gog chat messages create` | メッセージ送信ヘルパー |
| `gws-drive` | `auth/drive.file`, `auth/drive.appdata` | `gog drive` | ファイル操作 |
| `gws-drive-upload` | `auth/drive.file` | `gog drive files create` | アップロードヘルパー |

---

## 除外スキル一覧（スコープ外・制限付きスコープ）

| スキル（除外） | 除外理由 |
|---|---|
| `gws-gmail`, `gws-gmail-send`, `gws-gmail-triage`, `gws-gmail-watch` | `auth/gmail.modify` は**制限付きスコープ**。現状GCPに未登録 |
| `gws-admin-reports` | 管理者権限（ドメイン管理者のみ）が必要 |
| `gws-modelarmor*` | GCP特化機能。今回のスコープ外 |
| `gws-meet` | Google Meet APIは別途OAuth設定が必要 |
| `gws-forms` | `auth/forms` は今回のスコープに未登録 |
| `gws-keep` | Google Keep APIは一般提供外（制限あり） |
| `gws-classroom` | 教育機関向け。スコープ外 |
| `gws-events*`, `gws-workflow-*` | 複合シェルスクリプト。個別スキルと重複するため不採用 |

---

## 実装ステップ

1. **gog CLI のインストールと動作確認**
   ```bash
   # macOS
   brew install benmatselby/tap/gog
   # Linux
   # https://gogcli.sh から最新バイナリを取得
   gog --version
   ```

2. **gog CLI の認証（審査不要スコープのみで）**
   ```bash
   gog auth credentials ~/Downloads/client_secret.json
   gog auth add yourname@gmail.com calendar
   gog auth add yourname@gmail.com drive \
     --extra-scopes https://www.googleapis.com/auth/drive.appdata
   gog auth add yourname@gmail.com docs
   gog auth add yourname@gmail.com sheets
   gog auth add yourname@gmail.com tasks
   gog auth add yourname@gmail.com people
   gog auth add yourname@gmail.com chat
   ```

3. **スキルファイルのコピーと書き換え**
   - 元ファイル: `~/.gemini/skills/gws-<name>/SKILL.md`
   - コピー先: `~/DEV/openclaw-gemini-cli-adapter/gemini-home/skills/gog-<name>/SKILL.md`
   - 変更内容:
     - `name: gws-xxx` → `name: gog-xxx`
     - `requires: bins: ["gws"]` → `requires: bins: ["gog"]`
     - コマンド例の `gws <resource>` → `gog <resource>`
     - `gws-shared/SKILL.md` の参照先を `gog-shared/SKILL.md` に更新

4. **`gog-shared/SKILL.md` の新規作成（認証方法・グローバルフラグのドキュメント化）**

5. **`interactive-setup.js` に gog CLI のインストール・認証フローを追加**
   - gog CLIのバイナリを自動インストール
   - `gog auth credentials` に Vercel プロキシ用の `client_secret.json` を渡す
   - `gog auth add` を各サービスに対して実行

---

## 今後の検討事項（Gmailについて）

Gmail連携（`auth/gmail.modify`）は制限付きスコープのため、現状の一般公開を前提とした構成では回避している。
将来的に Gmail 連携を追加する場合は、[Google Chatの着信Webhookを用いた通知機能の実装方針](./chat_webhook_integration.md) と合わせて設計を検討すること。
