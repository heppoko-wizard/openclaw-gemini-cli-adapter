# 調査レポート：interactive-setup.js / launch.sh の Windows 互換性

**調査日時**: 2026-03-10
**対象ファイル**:
- `interactive-setup.js` (1086行, 59602バイト)
- `launch.sh` (75行)
- `launch.bat` (73行)
- `setup-openclaw-gemini-cli-adapter.bat` (49行)

---

## 【調査の道筋（仮説と検証のトレイル）】

### ステップ1：sudo の使用箇所の確認

- **仮説**: Linux 向けの `sudo` コマンドが `win32` 分岐なしに呼ばれている箇所がある
- **検証**: `grep_search('sudo', interactive-setup.js)`
- **事実の発見**:
  - L372: `spawnSync('sudo', ['npm', 'install', '-g', 'openclaw@latest'], ...)`
    - `if (process.platform === 'win32')` の **else 側** に存在する → win32 ではこの分岐は実行されない（OK）
  - L397: `spawnSync('sudo', ['cp', '-r', adapterSrc, adapterDest], ...)`
    - L394の `if (process.platform === 'win32')` の **else 側** に存在する → win32 では実行されない（OK）
  - L401: `spawnSync('sudo', ['chown', '-R', ...])`
    - L400の `if (process.platform !== 'win32')` の **中** に存在する → win32 では実行されない（OK）
  - L596: `spawnSync('sudo', ['sh', '-c', dlCmd], ...)` — gogcli Linux インストールパス
    - L577の `else if (process.platform === 'linux')` の **中** に存在する → win32 では実行されない（OK）
  - L909-910: `spawnSync('sudo', ['systemctl', ...])` — Tailscale デーモン起動 (systemd 経路)
    - L897の `if (process.platform !== 'win32')` の **中** に存在する → win32 では実行されない（OK）
  - L914-915: `spawnSync('sudo', ['killall', 'tailscaled'], ...)` および `spawnSync('sudo', ['sh', '-c', 'tailscaled > /dev/null 2>&1 &'], ...)`
    - L897の `if (process.platform !== 'win32')` の **中** に存在する → win32 では実行されない（OK）
  - L991, L994: `spawnSync('sudo', ['ufw', ...])` — UFW ファイアウォール設定
    - L990の `if (process.platform === 'linux')` の **中** に存在する → win32 では実行されない（OK）

**結論**: `sudo` を呼ぶ**全ての箇所**が `win32` 以外の条件分岐の中に存在し、Windows では実行されない。

---

### ステップ2：win32 分岐の存在確認

- **検証**: `grep_search('win32', interactive-setup.js)`
- **事実の発見**: 以下の行に `win32` チェックが存在する

| 行番号 | 内容 |
|---|---|
| L185 | `openBrowser()`: `start "" "URL"` |
| L265 | Node.js パス解決: `where` vs `which` |
| L358 | Bun インストール: `irm bun.sh/install.ps1 | iex` (PowerShell) |
| L369 | OpenClaw インストール: `npm install` (sudo なし) |
| L394 | アダプターコピー: `robocopy` |
| L400 | `chown` スキップ: `if not win32` |
| L604 | gogcli インストール: GitHub Releases から `.zip` ダウンロード |
| L870 | Tailscale インストール: `winget install tailscale.tailscale` |
| L897 | Tailscale デーモン起動ブロック: `if not win32` でスキップ |
| L939-940 | `tailscale up` コマンド: `sudo` なし分岐 |
| L1017 | 自動起動: VBScript を Startup フォルダに配置 |
| L1074-1076 | 起動スクリプト: `launch.bat` + `cmd.exe /c` |

---

### ステップ3：Windows 非互換の残存箇所の確認

- **検証**: `grep_search('sleep', interactive-setup.js)` / `grep_search('/proc/1/comm', ...)` / `grep_search('setRawMode', ...)`
- **事実の発見**:

| 行番号 | 問題の内容 | win32 分岐の有無 |
|---|---|---|
| **L919** | `spawnSync('sleep', ['3'])` — Unix の `sleep` コマンド | なし（L897 `if not win32` の内側には存在するが、該当コードブロック全体が `if not win32` で囲まれているかを要確認 → **L897の `if (process.platform !== 'win32')` の中なのでOK**） |
| **L905** | `fs.readFileSync('/proc/1/comm', 'utf8')` — Linux 疑似ファイル | `try-catch` で囲まれているが win32/非win32 の条件なし。ただし L897 `if not win32` の内側のため **実行されない** |
| **L152, L160** | `process.stdin.setRawMode(true/false)` | `win32` チェックなし。**全プラットフォームで実行される** |

---

### ステップ4：`setRawMode` の Windows 動作について

- **仮説**: `setRawMode` は Windows で未サポートの可能性がある
- **検証**: `search_web` 不要。Node.js 公式では `process.stdin.setRawMode()` は「TTY ストリームでのみ動作し、非 TTY では TypeError をスローする」と記述されている（Node.js docs より既知の仕様）
- **事実**: `setRawMode` は Windows の **Windows Terminal** および **PowerShell** では TTY が有効であるため動作する。`cmd.exe` で直接実行した場合も Node.js 内では TTY として認識されることが多い。ただし CI 環境やパイプ経由での実行では TTY が切れて例外が発生する。
- **コードの現状**: L160 に `process.stdin.setRawMode(true)` があり、この呼び出し前に TTY チェック（`process.stdin.isTTY`）は行われていない。

---

### ステップ5：Bun インストールの PowerShell 実行ポリシー問題

- **コードの現状**: L358-360:
  ```js
  if (process.platform === 'win32') {
      run('powershell', ['-NoProfile', '-Command', "irm bun.sh/install.ps1 | iex"]);
  }
  ```
- **事実**: Windows のデフォルトの PowerShell 実行ポリシーは `Restricted` であり、リモートスクリプトの実行が禁止される環境が存在する。`-NoProfile` フラグは付いているが `-ExecutionPolicy Bypass` は付いていない。`irm bun.sh/install.ps1 | iex` パターンは Web から DL したスクリプトを実行するため、`ExecutionPolicy` が `Restricted` の場合に失敗する可能性がある。
- **コードに `-ExecutionPolicy Bypass` が含まれているか**: `grep_search('ExecutionPolicy')` の結果 → **存在しない**

---

### ステップ6：launch.bat の Windows 互換性確認（既知ファイルの確認）

- **事実（L.21 of launch.bat）**: `start /B "" node src\server.js > logs\adapter.log 2>&1`
  - `start /B` によるバックグラウンド実行は Windows cmd で動作する
- **事実（L.41 of launch.sh）**: `nc -z localhost 18789` — `nc` (netcat) は Windows に標準では存在しない
  - → `launch.bat` では L.16: `netstat -ano | find "LISTENING" | find ":3972"` を使用 → Windows 標準コマンドで代替されている
- **事実（L.45 of launch.sh）**: `nohup openclaw gateway > log &` — `nohup` は Windows に存在しない
  - → `launch.bat` では L.51: `start "OpenClaw Gateway" /B cmd /c "..."` を使用 → 代替されている
- **事実（L.51-57 of launch.sh）**: `for i in {1..30}; do nc -z localhost ...; sleep 2; done` — Bash 構文
  - → `launch.bat` では L.53-59: `:wait_gateway` ラベルによる `goto` ループ + `timeout /t 2 /nobreak` を使用 → 代替されている

---

## 【コードベース・仕様から確認された最終的な事実】

| # | 事実 | ファイル:行 | 影響 |
|---|---|---|---|
| 1 | `sudo` を呼ぶ全箇所はすべて `win32` 以外の条件分岐の内側に存在する | L372, 397, 401, 596, 909-910, 914-915, 991, 994 | **Windows では実行されない** |
| 2 | `/proc/1/comm` 読み込みは `try-catch` + `if not win32` 内にある | L905 | **Windows では実行されない** |
| 3 | `sleep` コマンドは `if not win32` 内にある | L919 | **Windows では実行されない** |
| 4 | `setRawMode` に TTY チェック（`isTTY`）が存在しない | L152, L160 | **非 TTY 環境（パイプ実行等）では例外が発生しうる** |
| 5 | Bun インストールに `-ExecutionPolicy Bypass` が含まれていない | L359 | **実行ポリシーが Restricted の環境で失敗しうる** |
| 6 | `launch.sh` の `nc`, `nohup`, `sleep`, `lsof`, `kill` はすべて `launch.bat` で Windows 代替が実装済み | launch.bat L14-64 | **launch.bat は機能する** |
| 7 | `setup-openclaw-gemini-cli-adapter.bat` の L47: `node "!SETUP_JS!"` の遅延展開変数はバッチの先頭から `setlocal enabledelayedexpansion` が有効であれば動作する。ただし `chcp 65001` との親和性に注意が必要 | setup-openclaw-gemini-cli-adapter.bat L10, L47 | **動作するが環境依存あり** |

---

## 【未検証事項（追加調査が必要な点）】

- `setRawMode` が Windows の `cmd.exe` で実際に動作するかの実機確認
- Bun インストールが `-ExecutionPolicy Bypass` なしで Windows デフォルト環境で成功するかの実機確認
- `interactive-setup.js` が `setup-openclaw-gemini-cli-adapter.bat` から正しく呼ばれ、矢印UI が正常動作するかの実機確認

---

※ 本レポートは事実と検証プロセスの列挙のみであり、推測や修正案の提案は含まれていません。実装・修正を進める場合はご指示をお願いします。
