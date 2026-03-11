# Drive リファレンス (gogcli)

## ファイル一覧・検索

```bash
gog drive ls --max 20 --json
gog drive ls --parent <folderId> --max 20 --json
gog drive ls --all --max 20 --json           # 全アクセス可能ファイル
gog drive ls --no-all-drives --json          # マイドライブのみ

gog drive search "請求書" --max 20 --json
gog drive search "mimeType = 'application/pdf'" --raw-query --json

gog drive get <fileId> --json                # メタデータ取得
gog drive url <fileId>                       # Web URL表示
```

## アップロード

```bash
gog drive upload ./path/to/file --parent <folderId>
gog drive upload ./path/to/file --replace <fileId>     # ファイル内容を差し替え（共有リンク保持）
gog drive upload ./report.docx --convert               # Google Docs形式に変換
gog drive upload ./report.docx --convert --name report.docx
```

## ダウンロード・エクスポート

```bash
gog drive download <fileId> --out ./downloaded.bin

# Google Workspace形式のエクスポート
gog drive download <fileId> --format pdf --out ./exported.pdf
gog drive download <fileId> --format docx --out ./doc.docx
gog drive download <fileId> --format pptx --out ./slides.pptx
```

## 整理（フォルダ作成・移動・削除）

```bash
gog drive mkdir "新しいフォルダ"
gog drive mkdir "新しいフォルダ" --parent <parentFolderId>
gog drive rename <fileId> "新しい名前"
gog drive move <fileId> --parent <destinationFolderId>
gog drive copy <fileId> "コピーの名前"
gog drive delete <fileId>                     # ゴミ箱へ
gog drive delete <fileId> --permanent         # 完全削除
```

## 権限管理

```bash
gog drive permissions <fileId> --json
gog drive share <fileId> --to user --email user@example.com --role reader
gog drive share <fileId> --to user --email user@example.com --role writer
gog drive share <fileId> --to domain --domain example.com --role reader
gog drive unshare <fileId> --permission-id <permissionId>
```

## 共有ドライブ

```bash
gog drive drives --max 100 --json
```
