# Gmail リファレンス (gogcli)

## メール検索・閲覧

```bash
# スレッド検索（Gmail検索クエリ構文を使用）
gog gmail search 'newer_than:7d' --max 10 --json
gog gmail search 'from:alice@example.com subject:invoice' --max 5 --json
gog gmail search 'has:attachment filename:pdf' --max 10 --json

# スレッド詳細取得
gog gmail thread get <threadId> --json

# 添付ファイルのダウンロード
gog gmail thread get <threadId> --download --out-dir ./attachments

# 個別メッセージ取得
gog gmail get <messageId> --json
gog gmail get <messageId> --format metadata --json
```

## メール送信

```bash
# プレーンテキスト送信
gog gmail send --to a@b.com --subject "件名" --body "本文"

# ファイルから本文を読み込んで送信
gog gmail send --to a@b.com --subject "件名" --body-file ./message.txt

# HTML本文付き送信
gog gmail send --to a@b.com --subject "件名" \
  --body "テキスト版" --body-html "<p>HTML版</p>"

# 返信（元メッセージを引用）
gog gmail send --reply-to-message-id <messageId> --quote \
  --to a@b.com --subject "Re: 件名" --body "返信内容"
```

## 下書き

```bash
gog gmail drafts list --json
gog gmail drafts create --subject "下書き" --body "本文"
gog gmail drafts create --to a@b.com --subject "下書き" --body "本文"
gog gmail drafts update <draftId> --subject "更新" --body "更新本文"
gog gmail drafts send <draftId>
```

## ラベル管理

```bash
gog gmail labels list --json
gog gmail labels get INBOX --json          # メッセージ数を含む
gog gmail labels create "カスタムラベル"
gog gmail labels delete <labelIdOrName>

# スレッドにラベルを追加/削除
gog gmail thread modify <threadId> --add STARRED --remove INBOX
```

## バッチ操作

```bash
gog gmail batch delete <messageId1> <messageId2>
gog gmail batch modify <messageId1> <messageId2> --add STARRED --remove INBOX
```

## フィルター

```bash
gog gmail filters list --json
gog gmail filters create --from 'noreply@example.com' --add-label 'Notifications'
gog gmail filters delete <filterId>
```

## 不在応答

```bash
gog gmail vacation get --json
gog gmail vacation enable --subject "不在です" --message "○日まで不在にしています。"
gog gmail vacation disable
```
