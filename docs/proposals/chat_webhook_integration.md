# 機能提案: Google Chat の「着信 Webhook (Incoming Webhook)」を利用した通知機能

## 目的
一般公開するアプリ（Gemini CLI等のAI連携アプリ）から Google Chat にメッセージを自動送信したい場合、ユーザーのOAuth権限（`chat.messages` スコープ等）を要求すると、高額な **第三者セキュリティー監査（CASA）の対象** になってしまう問題があります。

この問題を回避し、かつスムーズに全ユーザーがChat通知機能を利用できるようにするため、Google Chat の標準機能である**「着信 Webhook (Incoming Webhook)」** を利用した通知機能の実装を提案します。

---

## 仕組みとメリット

### 仕組み
API経由で「本人」や「正式なBot」として発言するのではなく、特定のスペースに専用の「投稿口（URL）」を作り、そこにPOSTリクエストを投げるだけのシンプルな設計です。

### メリット
- **監査・審査費用がゼロ:** ユーザーのアカウント情報や他のメッセージへの読み取り権限などを一切要求しないため、アプリとしてはGoogleのセキュリティ審査の対象外になります。
- **実装が極めて容易:** OAuth認証やサービスアカウントの管理といった複雑なサーバー処理は不要で、単純なHTTP POSTリクエストだけで完結します。

---

## ユーザー側の設定フロー（想定）

一般ユーザー（パンピー）でも、以下の操作のみで簡単にセットアップできる仕様とします。

1. **Google Chat で URL を発行してもらう:**
   - パソコンで Google Chat を開き、通知を受け取りたいスペース名の横のメニュー（▼）をクリック。
   - 「アプリと統合 (Apps & integrations)」＞「Webhook を追加 (Add webhooks)」を選択。
   - 名前（例: "Gemini通知"）を入力して保存し、生成された長い専用URLをコピーする。
2. **アプリ（当システム）に URL を登録する:**
   - 初期セットアップ時、または設定コマンド（例: `npm run setup` や `gemini chat --config`）にて、「Google Chat に通知を送りたい場合は、発行したWebhook URLを入力してください」とプロンプトで促し、そのURLをローカルまたはDBの `user_configs` に保存する。

---

## アプリ側の実装方針（コードイメージ）

アプリ側は、保存されたURLに対してJSONデータをPOSTするだけで動作します。

```javascript
/**
 * 登録されているWebhook URLにメッセージを送信する処理
 * @param {string} userWebhookUrl - ユーザーが手動で登録したGoogle Chatの着信Webhook URL
 * @param {string} textMessage - 送信したいテキスト（Markdownが一部使用可能）
 */
async function sendToGoogleChat(userWebhookUrl, textMessage) {
    if (!userWebhookUrl) {
        console.warn("Webhook URLが設定されていません。通知をスキップします。");
        return;
    }

    try {
        const payload = {
            text: textMessage // Chat APIの仕様に準拠するキー
        };

        const response = await fetch(userWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Chatへの送信に失敗しました:", response.status, response.statusText);
        } else {
            console.log("Chatへの通知が完了しました。");
        }
    } catch (error) {
        console.error("Chat Webhook エラー:", error);
    }
}
```

## 今後のタスク
- [ ] `interactive-setup.js` などの設定画面に、Webhook URL の入力ステップ（任意）を追加する。
- [ ] 設定されたURLを `.gemini/configs` 等に保存する処理を実装する。
- [ ] アプリのイベント完了時や、AIの自発的アクションとして `sendToGoogleChat` を呼び出せるインターフェース（ツール等）を実装する。
