# 調査依頼: アダプター起動ハングの特定と解消

## 1. 概要
OpenClaw Gemini CLI アダプターのセットアップ後、`launch.sh`（または直叩きの `start.sh`）を実行すると、Gemini CLI アダプター（Node.jsサーバー、ポート3972）の起動が特定の位置でハングし、サービスが開始されない。
OpenClaw Gateway (18789) は正常に起動している。

## 2. 現在の状況（Status Quo）
- **環境**: Linux
- **Gateway (Port 18789)**: **Running**
- **Adapter (Port 3972)**: **Not Running** (Connection Refused)
- **ログ**: `logs/adapter.log` には以前の成功時の記録（2026-02-28）しか残っておらず、今回の起動試行はログ出力手前で止まっている。

## 3. 疑われる原因（Suspected Causes）
`start.sh` の実行トレースによると、以下のセクションで停止している：

```bash
# start.sh:52-53
echo "[start.sh] Syncing models to OpenClaw config..."
$RUNTIME "$SCRIPT_DIR/scripts/update_models.mjs" || echo "[start.sh] Warning: Failed to sync models"
```

- **ハングポイント**: `node scripts/update_models.mjs` の実行。
- **仮説**:
  1. **ネットワーク待機**: モデル情報の取得（Gemini API等）でタイムアウトせずに無限待機している。
  2. **ファイルロック**: `openclaw.json` または関連設定ファイルへのアクセスでデッドロックが発生している。
  3. **Node.js バージョン/依存関係**: `v24.14.0` での ESM 実行やモジュール読み込みにおける不整合。
  4. **gogcli 干渉**: 今日実施した `gogcli` の設定変更やエイリアス設定が、モデル同期に悪影響（予期せぬ認証待機など）を与えている。

## 4. 調査依頼事項（Request for Investigation Agent）
以下の項目を重点的に調査し、修正してください。

1. **`update_models.mjs` の単体テスト**: 
   - 直接 `node scripts/update_models.mjs` を実行し、どの行で止まっているか特定すること。
2. **タイムアウトの導入**:
   - `update_models.mjs` が外部通信を行う場合、適切なタイムアウトを設定し、失敗してもアダプター本体の起動を妨げないようにすること（`start.sh` 側でのエラー無視は既に記述されているが、コマンド自体が終了しないと意味がない）。
3. **ゾンビプロセスの確認**:
   - `ps aux | grep node` や `lsof -i :3972` を再確認し、見えないゾンビプロセスがポートやファイルを掴んでいないか精査すること。
4. **.bashrc エイリアスの影響**:
   - `~/.bashrc` から `gog` エイリアスを削除したが、現在のシェル環境に古いパス（通信端点が接続されていない Google Drive パス）が残っていないか、それがスクリプト内の `gog` 呼び出しを壊していないか。

## 5. 関連ファイル
- [start.sh](file:///home/heppo/ドキュメント/DEV/openclaw/openclaw-gemini-cli-adapter/start.sh)
- [scripts/update_models.mjs](file:///home/heppo/ドキュメント/DEV/openclaw/openclaw-gemini-cli-adapter/scripts/update_models.mjs)
- [logs/adapter.log](file:///home/heppo/ドキュメント/DEV/openclaw/openclaw-gemini-cli-adapter/logs/adapter.log)
