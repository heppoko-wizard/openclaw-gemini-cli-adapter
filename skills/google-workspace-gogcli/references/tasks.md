# Tasks リファレンス (gogcli)

## タスクリスト管理

```bash
gog tasks lists --max 50 --json
gog tasks lists create "買い物リスト"
```

## タスク操作

```bash
# 一覧
gog tasks list <tasklistId> --max 50 --json

# 詳細取得
gog tasks get <tasklistId> <taskId> --json

# 作成
gog tasks add <tasklistId> --title "タスク名"
gog tasks add <tasklistId> --title "週次ミーティング" \
  --due 2025-02-01 --repeat weekly --repeat-count 4
gog tasks add <tasklistId> --title "デイリースタンドアップ" \
  --due 2025-02-01 --repeat daily --repeat-until 2025-02-05

# 更新
gog tasks update <tasklistId> <taskId> --title "新しいタイトル"

# 完了/未完了
gog tasks done <tasklistId> <taskId>
gog tasks undo <tasklistId> <taskId>

# 削除
gog tasks delete <tasklistId> <taskId>

# 完了済みタスクの一括削除
gog tasks clear <tasklistId>
```

> **注意**: Google Tasksの期日は日付のみ。時刻の指定は無視される場合がある。
