# Calendar リファレンス (gogcli)

## カレンダー一覧・情報

```bash
gog calendar calendars --json        # カレンダー一覧
gog calendar colors --json           # 利用可能な色
gog calendar time --timezone Asia/Tokyo  # 現在時刻
```

## 予定の検索・閲覧

```bash
# 基本的な予定取得
gog calendar events <calendarId> --today --json
gog calendar events <calendarId> --tomorrow --json
gog calendar events <calendarId> --week --json
gog calendar events <calendarId> --days 3 --json

# 相対日付指定
gog calendar events <calendarId> --from today --to friday --json

# 絶対日付指定
gog calendar events <calendarId> \
  --from 2025-01-01T00:00:00Z --to 2025-01-08T00:00:00Z --json

# 全カレンダーから取得
gog calendar events --all --json

# テキスト検索
gog calendar search "会議" --today --json
gog calendar search "standup" --days 365 --max 50 --json

# 個別イベント取得
gog calendar event <calendarId> <eventId> --json
```

> **ヒント**: JSON出力にはタイムゾーンとローカライズ済み時刻が含まれるため、
> AIエージェントでの処理に最適。

## 予定の作成

```bash
# 基本的な作成
gog calendar create <calendarId> \
  --summary "会議" \
  --from 2025-01-15T10:00:00+09:00 \
  --to 2025-01-15T11:00:00+09:00

# 出席者・場所付き
gog calendar create <calendarId> \
  --summary "チーム同期" \
  --from 2025-01-15T14:00:00+09:00 \
  --to 2025-01-15T15:00:00+09:00 \
  --attendees "alice@example.com,bob@example.com" \
  --location "Zoom"

# 通知を送信
gog calendar create <calendarId> \
  --summary "イベント名" \
  --from ... --to ... \
  --send-updates all

# 繰り返し + リマインダー
gog calendar create <calendarId> \
  --summary "支払い" \
  --from 2025-02-11T09:00:00+09:00 \
  --to 2025-02-11T09:15:00+09:00 \
  --rrule "RRULE:FREQ=MONTHLY;BYMONTHDAY=11" \
  --reminder "email:3d" \
  --reminder "popup:30m"

# 終日イベント
gog calendar create primary \
  --event-type out-of-office \
  --from 2025-01-20 --to 2025-01-21 --all-day
```

## 予定の更新・削除

```bash
gog calendar update <calendarId> <eventId> \
  --summary "更新された会議" \
  --from 2025-01-15T11:00:00+09:00 \
  --to 2025-01-15T12:00:00+09:00

# 出席者の追加（既存の出席者を上書きしない）
gog calendar update <calendarId> <eventId> \
  --add-attendee "alice@example.com,bob@example.com"

gog calendar delete <calendarId> <eventId> --send-updates all --force
```

## 招待への応答

```bash
gog calendar respond <calendarId> <eventId> --status accepted
gog calendar respond <calendarId> <eventId> --status declined
gog calendar respond <calendarId> <eventId> --status tentative
```

## 空き時間の確認

```bash
gog calendar freebusy \
  --calendars "primary,work@example.com" \
  --from 2025-01-15T00:00:00Z --to 2025-01-16T00:00:00Z --json

gog calendar conflicts --calendars "primary,work@example.com" --today --json
```
