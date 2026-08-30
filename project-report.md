# XCalendar — Project Report

**Version 1.4.0 · August 31, 2026 · Android**

A minimal, Apple-style personal calendar application, purpose-built for a single user's Xiaomi Redmi K80 Pro — with an uncompromising, aggressively reliable reminder system as the centerpiece. Deliberately lean: no companion apps, no external privileges (v1.3.0 removed the Shizuku-based Super Island integration), and no haptics or UI sounds (v1.4.0).

---

## 1. Project Goal

> *"Build the ultimate calendar app that is most important for scheduling tasks. There should be a big calendar with Year, Month, Week, Day. The most important are: scheduling tasks — Event, Birthday, Countdown and other types of tasks such as for business, study, work. Optimize it for my phone (Xiaomi Redmi K80 Pro). Make it minimal, Apple-like design, haptics feedback, modern sounds, dark/light/system theme switch. Use SQLite for storage. Easy export/import .ics. Get the most out of reminders, notifications, widgets."*

The driving requirement, refined mid-project: **the reminder/alarm system is the most important feature** — the app must never let its owner forget an event, even on a phone (Xiaomi HyperOS) that aggressively kills background apps.

Success criteria, all met:

| Goal | Status |
|---|---|
| Big calendar with Year / Month / Week / Day views | ✅ |
| Schedule Events, Birthdays, Countdowns, Tasks (work/study/business/personal categories) | ✅ |
| Aggressive, reliable alarms on Xiaomi HyperOS | ✅ (live-verified on device) |
| Apple-like minimal design, dark/light/system themes | ✅ |
| ~~Haptics + modern sounds~~ | removed in v1.4.0 (kept the app lean) |
| SQLite storage | ✅ |
| ICS export/import | ✅ |
| Home-screen widget | ✅ |
| Zero external dependencies / companion apps | ✅ (v1.3.0 island + Shizuku; v1.4.0 haptics + sounds) |
| Personal use — no app-store constraints, "go full aggressive" on permissions | ✅ |

---

## 2. Target Device

| Property | Value |
|---|---|
| Phone | Xiaomi Redmi K80 Pro (model 24122RKC7C, codename *miro*) |
| OS | Android 16 (API 36) with HyperOS |
| Display | 1440 × 3200 (2K), 600 dpi (≈ 384 × 853 dp logical), 120 Hz |
| SoC / RAM | Snapdragon 8 Elite, 12–16 GB, arm64-v8a |
| Connection | USB debugging from the build Mac (serial `3a9d820`) |

The phone was connected via ADB for the entire project, which enabled **on-device QA at every step**: live screenshots of every screen, log-driven debugging, permission grants, and a real end-to-end alarm firing test.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 57** (React Native 0.86, New Architecture, React Compiler) | Current as of Aug 2026; dev build workflow fits personal hardware-targeted apps |
| Navigation | **Expo Router v7** | File-based routes, typed routes, deep links (`xcalendar://event/new?type=…`) |
| Storage | **expo-sqlite** (WAL) + in-memory cache + pub/sub invalidation | Personal-scale data fits in memory; every view reads from one cache |
| Alarms | **Custom native Kotlin Expo module** (`modules/xcalendar-alarm`) | `AlarmManager.setAlarmClock()` + full-screen lockscreen alarm activity — nothing off-the-shelf was aggressive enough |
| Recurrence | **rrule** | Full RRULE support; imports Google Calendar rules directly |
| Calendar data | **ical.js** | Battle-tested ICS parse/serialize (VALARM, VTODO, categories) |
| Widgets | **react-native-android-widget** | Actively maintained, Expo config-plugin support |
| Date math | **date-fns** | Tree-shakeable, reliable |
| Type | **Inter** (@expo-google-fonts) | Closest free match to Apple's SF Pro on Android |
| Icons | @expo/vector-icons (Ionicons) | Broad coverage, consistent style |

---

## 4. Architecture

```
src/
├── app/                  # Expo Router routes only
│   ├── _layout.tsx       #   providers, fonts, gesture root, notification routing
│   ├── index.tsx         #   redirect → Today
│   ├── (tabs)/           #   Today · Calendar · Settings (custom tab bar)
│   └── event/            #   new (form modal) · [id] (detail modal)
├── screens/calendar/     # month / week / day / year views, shared timeline, swipe pager
├── calendar/             # occurrence expansion engine (RRULE), display helpers
├── db/                   # sqlite client+migrations, repositories, settings, pub/sub
├── notifications/        # rolling-window reminder scheduler
├── ics/                  # ICS export/import mapping
├── widget/               # "Up Next" widget rendering + refresh
├── theme/                # design tokens: colors (light/dark), type ramp, spacing, motion
├── components/           # ThemedText, PressScale, SegmentedControl, EventRow…
├── core/                 # app orchestrator (init + change side-effects)
└── utils/                # date (local-date-string safety)

modules/xcalendar-alarm/  # native Kotlin: scheduler, receiver, full-screen
                          # alarm activity, action receiver, boot receiver
widget-task-handler.tsx   # widget headless entry (project root, per plugin contract)
```

**Data model (SQLite):** `events` (id, title, notes, location, type `event|birthday|countdown|task`, category, timed `startAt/endAt` epoch-ms **or** all-day `dtstartDate` + `durationDays` as local date strings — deliberately avoiding timezone bugs, RRULE string, reminder offsets, task completion, countdown target, ICS UID for dedupe), `categories` (6 seeded: Personal, Work, Study, Business, Birthday, Health), `settings` (key-value).

**One occurrence engine** (`buildOccurrences`) expands all events — one-offs, RRULE recurrences (DST-safe via UTC anchoring), multi-day spans, countdowns — into per-day occurrence maps consumed by every view, the Today tab, the widget, and the alarm scheduler.

---

## 5. Features Implemented

### 5.1 Calendar views (all custom-built, Reanimated + Gesture Handler)
- **Month** — 7×6 grid, weekday header honoring week-start setting, today highlight, per-day event dots, swipe between months, selected-day agenda card below, long-press a day to quick-add.
- **Week** — 7-column 24-hour timeline with hour grid, colored event blocks with overlap lanes, live red current-time line, all-day strip, tap any slot to create an event at that exact 15-minute increment.
- **Day** — single-column timeline, all-day chip strip, same interactions.
- **Year** — 3×4 grid of mini-months with today markers; tap a month to jump into Month view.
- Segmented Day/Week/Month/Year switcher; last view persisted; chevron stepping; "Today" quick jump.

### 5.2 Scheduling
- **Four entry types**: Event · Task · Birthday · Countdown — type-aware form behavior (birthdays auto-set yearly recurrence + category; countdowns use a target date with "in X days" everywhere).
- **Categories** — 6 seeded, color-coded across every surface (grid dots, timelines, agenda rows, widget).
- **All-day & multi-day** support with correct date-string storage.
- **Recurrence** — None / Daily / Weekly / Monthly / Yearly (stored as RRULE; expansion capped and DST-safe).
- **Reminders** — At time / 5 min / 30 min / 1 hour / 1 day before, multi-select per event.
- **Checkable tasks** — tap the circle to complete: spring animation, strikethrough fade, day progress ("1/1 · All done 🎉").
- **Detail screen** with full metadata; edit reuses the form modal; delete.
- **Deep links** — `xcalendar://event/new?type=countdown&date=…` prefill the form (validated on device).

### 5.3 Today tab
Time-aware greeting, today's agenda, task progress card, overdue tasks section (red), quick-add.

### 5.4 Aggressive alarm & reminder system (the centerpiece)
A dedicated native module (`modules/xcalendar-alarm`, Kotlin) implementing the same techniques as dedicated alarm apps:

1. **`AlarmManager.setAlarmClock()`** — the strongest alarm class on Android: exact to the millisecond, Doze-proof, displays the system alarm icon, does not require `SCHEDULE_EXACT_ALARM`.
2. **Rolling 14-day scheduler** (max 60 alarms) recomputed on every data change, app open, and permission grant — atomically replacing the native pending set. Loop-safe (signature dedupe).
3. **Full-screen alarm activity** — launched via full-screen-intent **and** a direct background-activity-start fallback; shows over the lock screen (`setShowWhenLocked`/`setTurnScreenOn`), wakes the display, loops the system alarm ringtone (USAGE_ALARM) with repeating vibration, big red **Done** + **Snooze 10 min** buttons, auto-dismiss after 2 min.
4. **Heads-up notification** — importance HIGH, `CATEGORY_ALARM`, alarm-sound channel with vibration pattern and DND bypass, per-alarm grouping (prevents Android's silent auto-group), ✓ Done / Snooze actions wired.
5. **Pure Android delivery** — no island/focus-notification extras as of v1.3.0; alarms deliver through the full-screen activity and the heads-up notification only.
6. **Reboot survival** — alarms persisted and re-registered by a boot receiver (BOOT_COMPLETED + MIUI QUICKBOOT).
7. **Permissions Hub** (Settings → *Alarms & reminders*) — live green/red status for Notifications, Full-screen alarms, Alarms & reminders access, Display over other apps, Autostart, Battery — each row deep-links to the exact system screen, plus a **"Send test alarm (8 seconds)"** button that exercises the entire pipeline end-to-end.

### 5.5 Super Island integration — built in v1.2.x, removed in v1.3.0

v1.2.0 shipped a striking capability: the next event rendered on HyperOS 3's native Super Island (front-camera pill → big island with live countdown → full card), achieved by defeating Xiaomi's online island-content whitelist with a Shizuku UserService that briefly blocked the XMSF service's network around each post (the "Stardawn workaround", after HyperBridge). It was fully working and verified on device.

It was **removed in v1.3.0** by design decision: the feature required a companion app (Shizuku) restarted after every phone reboot, took a system service (XMSF) offline for ~1 s on every post, and carried more operational complexity than a personal calendar should. The removal eliminated five native files (island poster, Shizuku firewall, privileged reflection service, AIDL interface, focus-payload builders) and restored the app to a zero-dependency, install-and-go state. Full history remains in git tags `v1.2.0`–`v1.2.1`.

### 5.6 Home-screen widgets
"Up Next" in two sizes (2×2, 4×2, resizable): date header, next 3–5 items with category color dots, countdown badges, task filtering, follows system dark mode, 30-minute auto-refresh, refresh-on-data-change, tap opens the app. Rendered headlessly via `widget-task-handler` reading SQLite directly.

### 5.7 Data — ICS import/export
- **Export** — whole calendar → RFC-compliant `.ics` (all-day VALUE=DATE, floating local times, RRULE+UNTIL, VALARMs per reminder, X-type extensions) → system share sheet.
- **Import** — document picker → ical.js parse (VEVENT + VTODO, durations, RRULEs incl. BYDAY/BYMONTHDAY/UNTIL, VALARM → reminder offsets, categories → local categories, birthday heuristics) → UID-deduplicated transactional merge with an "imported N, skipped M duplicates" report.

### 5.8 Polish
- **Themes** — System / Light / Dark with instant switching and a complete Apple-style semantic palette in both modes.
- **Feedback removal (v1.4.0)** — haptic feedback and the four synthesized UI sounds (expo-haptics / expo-audio) were removed to keep the app minimal; interactions now rely on visual spring feedback only (the PressScale press animation survives).
- **Typography & layout** — Inter-based Apple text ramp, continuous border curves, token-driven spacing/radius/motion.
- **Settings** — appearance (theme/24h/week start), feedback toggles, the alarms hub, data export/import.

---

## 6. HyperOS Research & Findings

Xiaomi HyperOS silently sabotages background apps. Through documentation research and live logcat forensics on the device, the following gates were identified and neutralized:

| Gate | Effect when missing | Resolution |
|---|---|---|
| **Autostart** (App info) | HyperOS refuses to *start* the process for alarm broadcasts when the app is dead — reminders never fire | Enabled (one-time); hub deep-link added |
| **Open new windows while running in the background** (Other permissions) | Full-screen-intent activity launch silently denied: `MIUILOG- Permission Denied Activity` + notification flag `FSI_REQUESTED_BUT_DENIED` — even when Android-level appops say "allow" | Enabled; **plus** a direct `startActivity` fallback (permitted once "Display pop-up windows" is granted) |
| **Display pop-up windows** (= SYSTEM_ALERT_WINDOW) | No background activity launch ⇒ no full-screen alarm | Enabled |
| **Battery optimization** | Delayed/missed alarms in Doze-like states | Exemption requested in-app |
| **Notification auto-grouping** | Multiple alarms auto-grouped into a *SILENT* summary — no sound, no heads-up, no FSI | Per-alarm `setGroup` + `GROUP_ALERT_ALL` |
| **adb appops grants get reset** by MIUI | Scripted grants don't stick for FSI/overlay | Manual Settings toggles (hub deep-links each); documented |

Useful discoveries: the real autostart intent `miui.intent.action.OP_AUTO_START` + `package_name` extra (replaces the wrong-section MIUI screen), the `canShowFocus` ContentProvider call to query HyperIsland permission state

---

## 7. On-Device Verification

The app was driven over ADB through every screen with screenshot review:

- Month/Week/Day/Year views (correct grids, now-line, dots, all-day strips)
- Event creation by tapping a 9:00 AM timeline slot → form opened at exactly 9:00–10:00; typed title; saved; block rendered in Week view
- Task completion (strikethrough, progress "1/1 All done 🎉"), birthday and countdown rendering
- Theme switch (dark → light → dark) applying instantly across all screens
- ICS screen flows, event detail, edit/delete surfaces
- **Alarm live-fire test**: armed a test alarm, left the app to the home screen, and the **full-screen alarm fired at the exact scheduled second** — display takeover, ringtone, vibration, Done/Snooze — with the heads-up notification stacked above. Verified multiple times, including from a killed process.
- **v1.3.0 removal verification**: fresh install with zero island/Shizuku code in the APK manifest (aapt-verified), test alarm fired to the second through the plain pipeline, settings hub renders without island entries, no firewall/dead-man logs.
- **v1.4.0 removal verification**: clean build with zero audio/haptics traces in the APK (manifest aapt-verified: no RECORD_AUDIO / MODIFY_AUDIO_SETTINGS / AudioControlsService), app boots cleanly (JS runs, Expo modules init, no runtime errors), typecheck + 21/21 tests green.
- **Alarm-safety regression check**: the "Send test alarm" button no longer wipes armed reminders (addAlarm instead of replaceAll) — confirmed by the scheduler re-arming 14–15 items after every app open.

---

## 8. Challenges & Bugs Fixed

1. **`Appearance.setColorScheme(null)` native crash** (RN 0.86 Android Kotlin non-null param) tore down the whole React instance → permanent splash. Fixed by forcing themes at the palette level.
2. **Shrink-wrap layout flaw** — percentage widths/flex applied inside an animated pressable wrapper never reached the outer Pressable, breaking the month grid (~11 columns), tab bar, FAB touch target, rows, and timeline blocks. Solved with a `containerStyle` (outer layout) vs `style` (inner scale) contract.
3. **Unreliable `locationY`** on HyperOS — tap-to-create returned the wrong hour. Replaced with 24 per-hour-row pressables deriving minutes from row index + small offset; verified exact.
4. **Infinite reschedule loop** — saving settings inside the data-changed side-effect re-triggered scheduling every ~400 ms, cancelling freshly armed alarms 40 ms after arming. Fixed with signature-deduped scheduling and no settings writes in the chain.
5. **Silent auto-grouped alarm notifications** — no sound, no heads-up, no full-screen. Fixed with per-alarm groups + alert behavior.
6. **MIUI FSI denial** despite Android-level permission — resolved via the direct background-start fallback + the two MIUI toggles.
7. **Widget config plugin format** — cell counts vs `dp` strings (`"150dp"`), `resizeMode` pipe syntax, missing periodic update → corrected manifest generation.
8. **Flaky local VPN proxy** intercepting Gradle downloads — builds bypass the system proxy; dl.google.com/Maven Central are reachable directly.
9. **v1.1.0 audit fixes** — the test alarm wiped all armed reminders (`replaceAll`); all-day reminders fired at midnight; multi-day spans fired once per day; edited titles left stale alarm content; export→import duplicated every event (random UIDs); recurring tasks never recurred; recurring timed events vanished from Day view (RRULE window end anchored at midnight). All fixed with regression tests.
10. **Super Island whitelist (v1.2.0; feature removed in v1.3.0)** — the payload was delivered intact (`focusType=PARAMS`) yet parsed to `{}`: Xiaomi's XMSF verifies the app signature *online* and discards unlisted apps' content. Defeated via the Shizuku XMSF-network block. Two sub-bugs en route: in-app reflection on `IConnectivityManager` is blocked by Android's hidden-API enforcement (solved by running the reflection inside the Shizuku UserService process, where it's unrestricted), and the restore call threw `NetworkOnMainThreadException` (the connectivity service destroys the blocked UID's sockets when the chain is re-enabled — fixed by enabling the chain only on block and retrying the rule once).
12. **v1.2.1 hardening (superseded by the v1.3.0 removal)** — the 1-second XMSF block window had a crash-window failure mode: a process death between block and the delayed restore would leave XMSF offline indefinitely. Now triple-covered: a persisted blocked-marker restored unconditionally on next app start (live-verified: force-stop inside the window → relaunch → `dead-man restore … restored=true`), a 30-second exact-alarm failsafe receiver for real crashes, and a JS+native double dedupe (persisted payload identity + 60-second throttle) so identical island content never re-posts. Also: UserService version now derives from the app versionCode (no manual bump), firewall reflection matches exact parameter signatures, and the OS3 payload builders moved into one shared `XFocusPayload`.
11. Smaller ones: missing `GestureHandlerRootView`, raw-text children in Views (RN 0.86 drops them silently), Android `contentOffset` being iOS-only, `expo-notifications` channel `sound: "default"` rejection, a WAV generator precedence bug producing 44-byte files (moot since v1.4.0 removed the sound system).

---

## 9. Release

- **Repo**: `github.com/aliahadmd/xcalendar` (private, branch `main`)
- **Releases**: `v1.0.0` (initial) · `v1.1.0` (audit fixes + test baseline) · `v1.2.0` (Super Island) · `v1.2.1` (island safety hardening) · `v1.3.0` (Super Island + Shizuku removed) · `v1.4.0` (haptics + UI sounds removed) — each with the debug-signed arm64 APK attached (≈116 MB, personal sideloading)
- **Installed**: running on the target phone (fresh install on v1.3.0); the one-time HyperOS permission grants (autostart, background windows, pop-up windows, battery) need re-doing after any reinstall
- **Rebuild**: `npm install` → `npx expo prebuild --platform android --clean` → `cd android && ./gradlew assembleRelease` (in-place rebuild preserves the local debug-signing config in `android/app/build.gradle`; `android/` is gitignored)
- **Verification**: `npm run typecheck` · `npm run test` (vitest, 21 tests)

---

## 10. Known Limitations & Future Ideas

- Reminder window is 14 days ahead (max 60 alarms); longer-horizon reminders reschedule as time advances — by design.
- Custom alarm sound is the system alarm ringtone; a bundled custom alarm tone could be added.
- Widget refreshes on data change, widget add, and every 30 minutes; a mid-night-tick background refresh could sharpen the date header.
- Recurrence editing scope: editing a single occurrence of a series edits the whole series (no per-instance exceptions yet).
- Categories are fixed to the seeded six; user-managed categories are a natural next step.
- Potential future: natural-language quick-add, week-ahead agenda widget, backup/restore beyond ICS, Wear OS complication. (The Super Island integration lives on in git history at tag `v1.2.1` if ever revived.)

---

*Built with Expo SDK 57 · React Native 0.86 · Kotlin. One user, one phone, zero forgotten events.*
