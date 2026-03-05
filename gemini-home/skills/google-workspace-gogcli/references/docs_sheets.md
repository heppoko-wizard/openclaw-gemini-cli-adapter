# Docs / Sheets / Slides リファレンス (gogcli)

## Google Docs

```bash
gog docs info <docId> --json
gog docs cat <docId> --max-bytes 10000         # テキスト内容を表示
gog docs cat <docId> --all-tabs                # 全タブ
gog docs cat <docId> --tab "ノート"            # 特定タブ
gog docs list-tabs <docId> --json

# 作成
gog docs create "新しいドキュメント"
gog docs create "インポート" --file ./doc.md   # Markdownをインポート
gog docs copy <docId> "コピー名"

# 更新
gog docs update <docId> --format markdown --content-file ./doc.md
gog docs write <docId> --replace --markdown --file ./doc.md
gog docs find-replace <docId> "古い文字列" "新しい文字列"

# エクスポート
gog docs export <docId> --format pdf --out ./doc.pdf
```

## Google Sheets

```bash
# メタデータ
gog sheets metadata <spreadsheetId> --json

# データ読み込み
gog sheets get <spreadsheetId> 'Sheet1!A1:B10' --json

# データ書き込み
gog sheets update <spreadsheetId> 'A1' 'val1|val2,val3|val4'
gog sheets update <spreadsheetId> 'A1' \
  --values-json '[["a","b"],["c","d"]]'

# 行の追加
gog sheets append <spreadsheetId> 'Sheet1!A:C' 'new|row|data'

# クリア
gog sheets clear <spreadsheetId> 'Sheet1!A1:B10'

# 書式設定
gog sheets format <spreadsheetId> 'Sheet1!A1:B2' \
  --format-json '{"textFormat":{"bold":true}}' \
  --format-fields 'userEnteredFormat.textFormat.bold'

# 行・列の挿入
gog sheets insert <spreadsheetId> "Sheet1" rows 2 --count 3

# ノートとリンク
gog sheets notes <spreadsheetId> 'Sheet1!A1:B10' --json
gog sheets links <spreadsheetId> 'Sheet1!A1:B10' --json

# 作成
gog sheets create "新しいスプレッドシート" --sheets "Sheet1,Sheet2"

# コピー・エクスポート
gog sheets copy <spreadsheetId> "コピー名"
gog sheets export <spreadsheetId> --format pdf --out ./sheet.pdf
gog sheets export <spreadsheetId> --format xlsx --out ./sheet.xlsx
```

## Google Slides

```bash
gog slides info <presentationId> --json
gog slides list-slides <presentationId> --json

# 作成
gog slides create "新しいプレゼン"
gog slides create-from-markdown "プレゼン名" --content-file ./slides.md
gog slides copy <presentationId> "コピー名"

# スライド追加・更新
gog slides add-slide <presentationId> ./slide.png --notes "スピーカーノート"
gog slides update-notes <presentationId> <slideId> --notes "更新メモ"
gog slides replace-slide <presentationId> <slideId> ./new-slide.png \
  --notes "新しいメモ"

# エクスポート
gog slides export <presentationId> --format pdf --out ./deck.pdf
```
