# XCalendar

A minimal, Apple-style personal calendar built with **Expo SDK 57** — optimized for a **Xiaomi Redmi K80 Pro** (Android 16, 2K 120Hz). Fully standalone: **no external dependencies, no companion apps** (Shizuku-free since v1.3.0).

## Features

- **Calendar** — Year / Month / Week / Day views with swipe navigation, live "now" line, tap-a-slot to create, long-press a day to quick-add
- **Scheduling** — Events, checkable Tasks, Birthdays (yearly + age), Countdowns ("in X days")
- **Categories** — Personal, Work, Study, Business, Birthday, Health (color-coded everywhere)
- **Recurrence** — daily / weekly / monthly / yearly (RRULE-based, imports Google Calendar rules)
- **Reminders** — exact alarms via the native alarm pipeline, rolling 14-day scheduler, per-event offsets (At time / 5 min / 30 min / 1 hour / 1 day)
- **Today tab** — greeting, task progress, overdue tasks, today's agenda
- **Haptics + sounds** — custom tick / complete / save / delete UI sounds, Apple-style haptic feedback (both toggleable)
- **Theme** — System / Light / Dark, applied instantly
- **ICS** — export the whole calendar (with alarms) or import from any `.ics` (Google/Apple/Outlook), UID-deduplicated
- **Widget** — "Up Next" home-screen widget (small + large) that follows system dark mode

## Storage

Everything is local in **SQLite** (`expo-sqlite`, WAL): events, categories, settings. No accounts, no network.

## Development

```bash
npm install
npx expo prebuild --platform android     # generates android/
npx expo start --dev-client              # Metro bundler
cd android && ./gradlew assembleRelease  # build APK
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The app uses a **dev build** (not Expo Go) because of the widget, exact alarms, and native modules. Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Verification: `npm run typecheck` · `npm run test` (vitest).

## HyperOS reliability (important on Xiaomi)

Reminders use a native alarm pipeline (`modules/xcalendar-alarm`): `AlarmManager.setAlarmClock()` → full-screen alarm screen (shows over the lock screen, plays the alarm ringtone, vibrates, Done/Snooze) + heads-up notification with actions + automatic re-scheduling after reboot. This is the same mechanism alarm apps use — it fires exactly and survives Doze.

HyperOS still requires **one-time manual permission grants** (Settings → "Alarms & reminders" deep-links each one, with live green/red status and an 8-second test alarm):

1. **Autostart** — App info → Autostart. Without it HyperOS blocks the app from being started by alarms when killed.
2. **Open new windows while running in the background** — Other permissions. Without it HyperOS silently denies the full-screen alarm activity (logcat: `MIUILOG- Permission Denied Activity`).
3. **Display pop-up windows** — Other permissions. Enables the direct full-screen launch path.
4. **Battery optimization off** + the standard notification / alarms access.

Use **Settings → Alarms & reminders → "Send test alarm (8 seconds)"** to verify the whole pipeline end-to-end at any time.

> **Note:** versions 1.2.0–1.2.1 could additionally mirror the next event onto HyperOS 3's Super Island via a Shizuku-based workaround. That feature was **removed in v1.3.0** — it depended on a companion app (Shizuku) and manipulated the system XMSF service's network at runtime, which was more machinery than a personal calendar wants. The island code remains in git history (`v1.2.1`) if it's ever wanted back.

## Scripts

- `node scripts/generate-sounds.js` — regenerates the bundled UI sounds (`assets/sounds/*.wav`)
- `npm run test` / `npm run typecheck` — vitest suite (occurrence engine, reminder scheduler, date utils) and TypeScript
