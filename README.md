# XCalendar

A minimal, Apple-style personal calendar built with **Expo SDK 57** — optimized for a **Xiaomi Redmi K80 Pro** (Android 16, 2K 120Hz), with the next event always live on the phone's **Super Island**.

## Features

- **Calendar** — Year / Month / Week / Day views with swipe navigation, live "now" line, tap-a-slot to create, long-press a day to quick-add
- **Scheduling** — Events, checkable Tasks, Birthdays (yearly + age), Countdowns ("in X days")
- **Categories** — Personal, Work, Study, Business, Birthday, Health (color-coded everywhere)
- **Recurrence** — daily / weekly / monthly / yearly (RRULE-based, imports Google Calendar rules)
- **Reminders** — exact alarms via the native alarm pipeline, rolling 14-day scheduler, per-event offsets (At time / 5 min / 30 min / 1 hour / 1 day)
- **Super Island** — the next event with a live countdown is always on the front-camera island (HyperOS 3, see below)
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

## Super Island (next event on the front-camera pill)

On HyperOS 3, XCalendar keeps the **next upcoming event** on the native Super Island:

- **Pill** — app icon; tap to expand
- **Big island** — event title · date · time (left) and live countdown, e.g. `in 16h 5m` (right)
- **Card** — "Next event" label, title, date · time, countdown, and the following event ("Then · Team sync · 11:00 AM")
- **AOD + ticker** — `Event · 09:30 AM` when the screen is off / in the status bar
- Refreshed automatically on every app open and data change (up to 7 days ahead, honors the 24-hour setting)

### Why Shizuku is needed

Xiaomi gates custom island content behind a **whitelist**: the system's XMSF service verifies an app's signature *online*, and unlisted apps' island payloads are silently discarded. XCalendar defeats this with the "Stardawn workaround" (the same technique as the open-source [HyperBridge](https://github.com/D4vidDf/HyperBridge)): around each island post it **briefly blocks XMSF's network** via a firewall rule, so the whitelist check fails open and the content renders. XMSF is back online ~1 second later. This needs **Shizuku** — ADB-shell privileges, **no root, no bootloader unlock**.

**Safety layers around the block window** (a crash mid-window would otherwise leave XMSF offline): a persisted marker is restored unconditionally on the next app start, a 30-second exact-alarm failsafe restores it even after a process crash, and identical island payloads are never re-posted (persisted dedupe) plus a 60-second throttle for rapid consecutive saves.

### Shizuku setup (one time)

1. Install Shizuku on the phone — from [Google Play](https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api) or the [GitHub releases](https://github.com/RikkaApps/Shizuku/releases) (`shizuku-v*.apk`, then `adb install -r shizuku.apk`)
2. Start the Shizuku server **from the computer** with the phone connected over USB (USB debugging on):
   ```bash
   adb shell "nohup $(adb shell dumpsys package moe.shizuku.privileged.api | grep -oE 'legacyNativeLibraryDir=[^ ]+' | cut -d= -f2)/arm64/libshizuku.so >/dev/null 2>&1 &"
   ```
   (Or start it **on the phone**: Shizuku app → "Start via Wireless debugging" — needs pairing once, then no computer.)
3. Grant XCalendar access — either:
   - In the app: **Settings → Super Island test → "Grant Shizuku permission"**, or
   - From the computer: `adb shell pm grant com.xcalendar.app moe.shizuku.manager.permission.API_V23`
4. Open XCalendar once — the island appears. Check status anytime in **Settings → Super Island test** (all four rows green = workaround ready).

### If Shizuku stopped (after a reboot)

Shizuku does not survive reboots. Restart it and reopen XCalendar:

- **From the computer** (phone connected via USB):
  ```bash
  adb shell "nohup $(adb shell dumpsys package moe.shizuku.privileged.api | grep -oE 'legacyNativeLibraryDir=[^ ]+' | cut -d= -f2)/arm64/libshizuku.so >/dev/null 2>&1 &"
  ```
- **On the phone**: Shizuku app → "Start via Wireless debugging" → Start (if it doesn't start, toggle Wireless debugging off/on).

Without a running Shizuku the island falls back to a plain notification card — **alarms and reminders are never affected**.

### If Shizuku was uninstalled / XCalendar reinstalled

- **Shizuku uninstalled → reinstalled**: start the server (above), then re-grant XCalendar: `adb shell pm grant com.xcalendar.app moe.shizuku.manager.permission.API_V23` (or the in-app button)
- **XCalendar uninstalled → reinstalled**: the Shizuku grant is lost — re-grant it (same command / in-app button), then open the app
- **XCalendar updated to a new build**: nothing to redo — the app re-binds automatically on next launch

## Scripts

- `node scripts/generate-sounds.js` — regenerates the bundled UI sounds (`assets/sounds/*.wav`)
- `npm run test` / `npm run typecheck` — vitest suite (occurrence engine, reminder scheduler, date utils) and TypeScript
