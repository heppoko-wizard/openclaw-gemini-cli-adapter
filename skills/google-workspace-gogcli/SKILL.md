---
name: google-workspace-gogcli
description: Google Workspaceの各種サービス（Gmail, Calendar, Drive, Contacts/People, Tasks, Docs, Sheets, Slides）をCLIツール「gogcli」(gog)経由で操作するためのスキル。メール検索・送信、カレンダー予定の確認・作成、Driveファイルの検索・ダウンロード・アップロード、連絡先の検索・管理、タスク管理、ドキュメント/スプレッドシート/スライドの操作をカバーする。「メールを検索して」「今日の予定を教えて」「Driveからファイルを探して」「連絡先を調べて」「タスクを追加して」「スプレッドシートを更新して」等の指示が来た場合に必ずこのスキルを参照すること。
---

# Google Workspace操作ガイド (gogcli)

`gogcli`（コマンド名: `gog`）は、Google Workspaceのほぼ全サービスをターミナルから操作できるCLIツール。

## 基本原則

### 常に `--json` フラグを使用する

AIエージェントとして操作する場合、出力は**必ず `--json` を付けて**構造化JSONで取得すること。
テキスト出力は人間向けであり、パースに不向き。

```bash
# ✅ 常にこの形式
gog gmail search 'newer_than:1d' --max 5 --json

# ❌ JSONなしは使わない
gog gmail search 'newer_than:1d' --max 5
```

### アカウント指定

複数アカウントがある場合は `--account` で明示指定する。

```bash
gog gmail search 'from:boss@company.com' --account work@company.com --json
```

環境変数 `GOG_ACCOUNT` でデフォルトアカウントを設定することも可能。

### 出力サイズの制御

大量の結果を返すコマンドには必ず `--max` で上限を設定する。

```bash
gog gmail search 'label:inbox' --max 10 --json
gog contacts list --max 20 --json
```

## サービス別リファレンス

操作対象に応じて以下のファイルを参照すること。

| サービス | リファレンスファイル | 主な操作 |
| :--- | :--- | :--- |
| **Gmail** | [gmail.md](references/gmail.md) | メール検索・送信・ラベル・下書き・フィルター |
| **Calendar** | [calendar.md](references/calendar.md) | 予定の検索・作成・更新・招待応答・空き時間 |
| **Drive** | [drive.md](references/drive.md) | ファイル検索・アップロード・ダウンロード・権限管理 |
| **Contacts / People** | [contacts.md](references/contacts.md) | 連絡先の検索・作成・更新・ディレクトリ検索 |
| **Tasks** | [tasks.md](references/tasks.md) | タスクリスト管理・タスクの追加・完了・繰り返し |
| **Docs / Sheets / Slides** | [docs_sheets.md](references/docs_sheets.md) | 文書の読み書き・スプレッドシート更新・エクスポート |

## エラー時の対処

- **認証エラー**: `gog auth status --json` で現在の認証状態を確認。期限切れなら `gog auth add <email>` で再認証。
- **権限不足**: 必要なスコープが未認可の場合がある。`gog auth add <email> --services <service> --force-consent` でスコープを追加する。
- **コマンドが見つからない**: `gog` がPATHにあるか確認する。Homebrewなら `brew install steipete/tap/gogcli`。
