# Contacts / People リファレンス (gogcli)

## 連絡先の検索・閲覧

```bash
# 個人の連絡先
gog contacts list --max 50 --json
gog contacts search "田中" --max 50 --json
gog contacts get people/<resourceName> --json
gog contacts get user@example.com --json     # メールアドレスで取得

# やりとりのある人（Other Contacts）
gog contacts other list --max 50 --json
gog contacts other search "John" --max 50 --json
```

## 連絡先の作成・更新

```bash
gog contacts create \
  --given "太郎" \
  --family "山田" \
  --email "taro@example.com" \
  --phone "+818012345678"

gog contacts update people/<resourceName> \
  --given "花子" \
  --email "hanako@example.com" \
  --birthday "1990-05-12" \
  --notes "WWDCで出会った"

gog contacts delete people/<resourceName>
```

## People API（プロフィール・ディレクトリ）

```bash
gog people me --json                           # 自分のプロフィール
gog people get people/<userId> --json
gog people search "Ada Lovelace" --max 5 --json  # Workspace ディレクトリ検索
gog people relations --json                    # 自分の関係者
gog people relations people/<userId> --type manager --json
```

## Workspace ディレクトリ（Workspace環境のみ）

```bash
gog contacts directory list --max 50 --json
gog contacts directory search "Jane" --max 50 --json
```
