# 🚨 Issue: OpenClaw Gemini CLI Adapter - gogcli Auth Flow 🚨

## 【概要: Executive Summary】
現在、`openclaw-gemini-cli-adapter` の対話型セットアップ (`interactive-setup.js`) において、**gogcli (Google Workspace API 連携用CLI)** の認証フローが期待通りの動作になっていません。
ユーザーに対して不要なストレス（長いURLのコピペ、予期しないプロンプトの出現）を与えてしまっており、これらを完全に排除したスマートな認証フローに再構築する必要があります。

これまでのデバッグの過程で複数の修正が入りましたが、最終的なゴールを見失いコードが破綻しています。このイシューファイルは次のLLM（作業者）へ向けた完全な引継ぎ資料です。

---

## 【現在のシステムの状況と問題点】

### 1. ディレクトリとパスの前提
OpenClawのバイナリ版をインストールした場合、通常 `/usr/lib/node_modules/openclaw/` に配置されます。
`interactive-setup.js` は、実行開始時に自分自身を上記のOpenClawインストールフォルダ内にコピーし (`/usr/lib/node_modules/openclaw/openclaw-gemini-cli-adapter`)、そこで以後の処理を継続します。
また、プラグイン専用の隔離環境として `GEMINI_CREDS_DIR`（パス：`.../openclaw-gemini-cli-adapter/gemini-home`）を作成し、以後の認証データは全てこの配下の `.gemini/` 等に保存しなければなりません。

### <問題1> メールアドレスの自動検知とプロンプトの出現
セットアップの前半でGemini CLIの認証 (`scripts/setup-gemini-auth.js`) を行い、そこで取得したメールアドレスを `gemini-home/.gemini/google_accounts.json` に書き込んでいます。
後半の gogcli の認証 (`gog auth add...`) で、そのアドレスを読み取って自動的に `email` を決定し、ユーザーに手打ちさせない（プロンプトをバイパスする）設計になっています。
**現状の挙動**: うまくアドレスが特定・引き継がれないケースがあり、`連携するGoogleアカウント(Gmailアドレス等)を入力してください:` という手入力プロンプトが出てしまいます。

### <問題2> ブラウザ自動起動とURL表示の喪失
以前は、独自に小さなローカルサーバーを立て、ターミナルに「短縮URL（http://localhost:xxxxx/auth）」を表示するフローが存在していました。
**現状の挙動**: 直近のリファクタリングの過程でこの表示ロジックを私が誤って削除してしまいました。
結果として、**認証用のURL自体がターミナルに一切表示されず**、ユーザーがどこにアクセスすればよいか分からない状態になっています。もちろんブラウザも自動で開きません。

### <問題3> gogcli の client_secret.json とリダイレクト
gogcli はデフォルトの設定ファイル (`~/.config/gogcli/client_secret.json`) に `client_id` と `client_secret` を必要とし、デスクトップアプリとしてOAuthフロー（`urn:ietf:wg:oauth:2.0:oob` や `localhost` リダイレクト）を行います。
現状、スクリプト内で `client_secret` を生成・配置させていますが、gogcli本体が立ち上げるリダイレクトサーバー（`http://127.0.0.1:ランダムポート/oauth2/callback`）との連携や標準出力のフックがうまく機能しておらず、UIが壊れています。

---

## 【ゴール: 達成すべき動作要件】
次のLLM（作業者）は、`interactive-setup.js`（必要に応じてその他のスクリプト）を改修し、以下の挙動を**完全に実現**してください。

1. **シームレスなメールアドレス連携**
   前半のGemini認証で保存された `GEMINI_CREDS_DIR/.gemini/google_accounts.json` から正確にアカウント情報を読み取り、gogcli のセットアッププロセスで一切のプロンプト（メールアドレス入力等）を出さずに自動で次のステップに進むこと。
   （※万が一ファイルが無い場合のみプロンプトを出すのは許容されるが、正常系では絶対に出さないこと）

2. **スマートなURL表示・ブラウザの自動起動の復元**
   gogcli を `spawn` または `exec` で呼び出す際、gogcli が出力する「https://accounts.google.com/o/oauth2/auth?...」の長いURLを直接ユーザーに見せないこと。
   - 以前のようにローカルの Express/http サーバー等でワンクッション置く「短縮URL (http://localhost:PORT)」をターミナルに表示する。
   - または、その長いURLを正規表現等で抽出し、`openBrowser()` 関数等を使って裏側で自動的にブラウザを開く（`opener`等の挙動）。

3. **環境変数と隔離環境の徹底**
   `~/.gemini/` や `~/.config/gogcli/` のようなグローバルなパスへのフォールバックや誤参照を絶つこと。
   全てのクレデンシャル操作は `GEMINI_CREDS_DIR`（および必要なら独自に設定した gogcli 用設定フォルダ）に限定されているか厳格にチェックすること。

4. **ゼロクリック / ノーストレス**
   ユーザーは基本的に「はい」を選ぶだけで、あとはブラウザでGoogleアカウントを選択し「許可」をクリックするだけ。ターミナルに戻れば「認証完了しました」と出るのが理想です。

## 【作業にあたってのヒント / チェックリスト】
- `interactive-setup.js` の 610行目付近にある `email` 取得ロジックと、`promptUser` の部分を点検する。
- `spawnSync('gog', ['auth', 'add'...])` の部分。これを非同期 (`spawn`) にして stdout をリアルタイムに監視し、GoogleのURLが含まれていたらキャッチして自動でブラウザを開く実装 (`setup-gemini-auth.js` で使っている `openBrowser` のような関数) を導入すると良い。
- GitHub Secret Scanning 対策として `client_id` 等の復号ロジックが既に入っているので、そこはそのまま活かすこと。

## 【ユーザー様の声】
> 「じゃあこれは自動入力されて勝手にブラウザが開くようになってるんだよな？ 短縮URLも表示されないし。もうだめだ。イシューファイルを作ってくれ。ほかのLLMに依頼する。完璧に引き継ぐためにはどんな情報が必要をか、どんな動作がゴールになるかをしっかり明記してくれ。」
