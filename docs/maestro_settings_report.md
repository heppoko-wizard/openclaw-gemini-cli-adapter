# Maestro 拡張機能設定ガイド

Maestro は Gemini CLI のマルチエージェント・オーケストレーションを制御するための高度な設定を多数備えています。本レポートでは、各設定の日本語訳と、どのような状況でどの設定を選ぶべきかのガイドラインをまとめます。

## 設定一覧と解説

| 設定名 (環境変数) | 日本語訳 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| **Execution Mode**<br>`MAESTRO_EXECUTION_MODE` | **実行モード** | `ask` | フェーズ3（実装）の実行方式。`parallel`（並列）、`sequential`（順次）、`ask`（都度確認）から選択します。 |
| **Max Concurrent**<br>`MAESTRO_MAX_CONCURRENT` | **最大同時実行数** | `0` (無制限) | 並列実行時に同時に起動するサブエージェントの最大数。`0` は準備ができたタスクをすべて同時に投げます。 |
| **Validation**<br>`MAESTRO_VALIDATION_STRICTNESS` | **検証の厳格さ** | `normal` | 各フェーズ完了後のバリデーション（ビルド、テスト等）のレベル。`strict` / `normal` / `lenient`。 |
| **Max Retries**<br>`MAESTRO_MAX_RETRIES` | **最大リトライ回数** | `2` | フェーズが失敗した際、ユーザーに確認する前に自動でリトライする回数。 |
| **Agent Timeout**<br>`MAESTRO_AGENT_TIMEOUT` | **エージェント・タイムアウト** | `10` (分) | 1つのサブエージェントが応答を返すまでの制限時間。巨大なタスクでは長くする必要があります。 |
| **Disabled Agents**<br>`MAESTRO_DISABLED_AGENTS` | **無効化エージェント** | (なし) | 使用したくない専門家エージェントの名前をカンマ区切りで列挙します。 |
| **Auto Archive**<br>`MAESTRO_AUTO_ARCHIVE` | **自動アーカイブ** | `true` | セッションが正常終了した際、状態ファイルを自動的に `archive/` フォルダへ移動するかどうか。 |
| **State Directory**<br>`MAESTRO_STATE_DIR` | **状態保存ディレクトリ** | `.gemini` | セッションの状態や実装計画を保存するベースディレクトリ。 |
| **Stagger Delay**<br>`MAESTRO_STAGGER_DELAY` | **並列起動遅延** | `5` (秒) | 並列実行時に、次のエージェントを起動するまでの待ち時間。APIのレート制限回避に有効。 |
| **Default Model**<br>`MAESTRO_DEFAULT_MODEL` | **デフォルトモデル** | (メイン継承) | 並列実行されるサブエージェントが使用するモデル。未指定時はメインセッションと同じモデルを使います。 |

---

## ユースケース別推奨設定

自分の開発スタイルや環境に合わせて、以下の設定傾向を参考にしてください。

### 1. 「高速・自律型」構成 (スピード重視)
とにかく早く実装を終わらせたい、かつ軽微なエラーは無視して進めたい場合。

- **Execution Mode**: `parallel` (並列実行をデフォルトに)
- **Max Concurrent**: `0` (またはマシンスペックに合わせて `5` 前後)
- **Validation**: `lenient` (多少の警告は無視して次に進む)
- **Max Retries**: `3` (AIに粘り強く修正させる)
- **Auto Archive**: `true`

### 2. 「慎重・高精度型」構成 (品質重視)
基幹システムのコードや、セキュリティが重要なファイルを扱う場合。

- **Execution Mode**: `sequential` (1つずつ挙動を確認し、都度承認する)
- **Validation**: `strict` (テストが1つでも落ちたら即停止・修正)
- **Max Retries**: `1` (勝手なループを防ぎ、原因を自分で確認する)
- **Auto Archive**: `false` (アーカイブ前に成果物をじっくり確認する)

### 3. 「リソース節約型」構成 (API制限・低スペックPC)
APIのトークン制限（Rate Limit）が厳しい場合や、並列実行でPCが重くなる場合。

- **Max Concurrent**: `2` (同時実行を絞る)
- **Stagger Delay**: `15` 〜 `30` (リクエスト間隔を広げる)
- **Execution Mode**: `ask` (状況を見て判断)
- **Default Model**: `gemini-2.0-flash` (軽量モデルを強制指定してコストを抑える)

---

## 設定の変更方法

1. **対話的に設定する**:
   ```bash
   gemini extensions config maestro
   ```
   質問形式で設定を更新できます。

2. **特定の項目だけを更新する**:
   ```bash
   gemini extensions config maestro "Execution Mode"
   ```

3. **環境変数で指定する (一時的・プロジェクト固有)**:
   `.env` ファイルやシェルで `export MAESTRO_MAX_RETRIES=5` のように指定することも可能です。
