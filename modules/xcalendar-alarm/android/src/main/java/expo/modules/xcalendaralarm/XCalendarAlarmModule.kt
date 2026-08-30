package expo.modules.xcalendaralarm

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

fun focusPermissionState(context: Context): Boolean {
    return try {
        val bundle = context.contentResolver.call(
            Uri.parse("content://miui.statusbar.notification.public"),
            "canShowFocus",
            null,
            Bundle().apply { putString("package", context.packageName) },
        )
        bundle?.getBoolean("canShowFocus", false) ?: false
    } catch (e: Exception) {
        false
    }
}

class XCalendarAlarmModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("no context")

    override fun definition() = ModuleDefinition {
        Name("XCalendarAlarm")

        AsyncFunction("scheduleAlarms") { alarms: List<Map<String, Any>>, promise: expo.modules.kotlin.Promise ->
            try {
                android.util.Log.d("XCalendarAlarm", "scheduleAlarms called with ${alarms.size} items")
                val jsons = alarms.map { JSONObject(it) }
                XAlarmScheduler.replaceAll(context, jsons)
                promise.resolve(null)
            } catch (e: Exception) {
                android.util.Log.e("XCalendarAlarm", "scheduleAlarms failed", e)
                promise.reject("SCHEDULE_FAILED", e.message, e)
            }
        }

        AsyncFunction("cancelAllAlarms") { promise: expo.modules.kotlin.Promise ->
            try {
                XAlarmScheduler.cancelAll(context)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("CANCEL_FAILED", e.message, e)
            }
        }

        AsyncFunction("getPermissionStates") { promise: expo.modules.kotlin.Promise ->
            try {
                val ctx = context
                val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager

                val grantedNotifs =
                    if (Build.VERSION.SDK_INT >= 33) {
                        ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                            android.content.pm.PackageManager.PERMISSION_GRANTED
                    } else true

                val canFsi =
                    if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent()
                    else
                        ctx.checkSelfPermission(Manifest.permission.USE_FULL_SCREEN_INTENT) ==
                            android.content.pm.PackageManager.PERMISSION_GRANTED

                val canExact = try {
                    if (Build.VERSION.SDK_INT >= 31) am.canScheduleExactAlarms() else true
                } catch (e: Exception) {
                    true
                }

                promise.resolve(
                    mapOf(
                        "notifications" to grantedNotifs,
                        "fullScreenIntent" to canFsi,
                        "overlay" to Settings.canDrawOverlays(ctx),
                        "exactAlarm" to canExact,
                        "focus" to focusPermissionState(ctx),
                        "batteryIgnoring" to pm.isIgnoringBatteryOptimizations(ctx.packageName),
                        "isXiaomi" to XAlarmScheduler.isXiaomi(),
                        // HyperOS focus protocol: 0 none · 1 OS1 · 2 OS2 · 3 OS3 Super Island
                        "focusProtocol" to XAlarmNotifier.focusProtocol(ctx),
                        "islandSupported" to XAlarmNotifier.islandSupported(ctx),
                    ),
                )
            } catch (e: Exception) {
                promise.reject("STATE_FAILED", e.message, e)
            }
        }

        /** HyperOS autostart ("Background autostart") — passes the package so it opens OUR entry. */
        Function("openAutostart") {
            val ctx = context
            val attempts = listOf<Intent>(
                Intent("miui.intent.action.OP_AUTO_START").apply {
                    putExtra("package_name", ctx.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
                Intent().apply {
                    component = android.content.ComponentName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity",
                    )
                    putExtra("package_name", ctx.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", ctx.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
            for (intent in attempts) {
                try {
                    ctx.startActivity(intent)
                    return@Function true
                } catch (e: Exception) {
                    // try next
                }
            }
            false
        }

        /** Display over other apps (SYSTEM_ALERT_WINDOW). */
        Function("openOverlaySettings") {
            try {
                context.startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}"),
                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                true
            } catch (e: Exception) {
                false
            }
        }

        /** Per-app notification settings — where "Full screen notification" and the
         *  HyperIsland/focus toggle live on HyperOS. */
        Function("openAppNotificationSettings") {
            try {
                val intent =
                    if (Build.VERSION.SDK_INT >= 26) {
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                    } else {
                        Intent(Settings.ACTION_APPLICATION_SETTINGS)
                    }
                context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (e: Exception) {
                false
            }
        }

        /** System "Alarms & reminders" panel. */
        Function("openExactAlarmSettings") {
            try {
                if (Build.VERSION.SDK_INT >= 31) {
                    context.startActivity(
                        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                            .setData(Uri.parse("package:${context.packageName}"))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                    true
                } else false
            } catch (e: Exception) {
                false
            }
        }

        /** Battery optimization exemption dialog. */
        Function("openBatterySettings") {
            try {
                context.startActivity(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        .setData(Uri.parse("package:${context.packageName}"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                true
            } catch (e: Exception) {
                try {
                    context.startActivity(
                        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                    true
                } catch (e2: Exception) {
                    false
                }
            }
        }

        /** Post (or update) a persistent silent notification rendered on the Super Island. */
        Function("postIslandTest") { title: String, body: String ->
            XAlarmNotifier.postIslandTest(context, title, body)
        }

        /** Remove the Super Island test notification (also clears the island). */
        Function("cancelIslandTest") {
            XAlarmNotifier.cancelIslandTest(context)
        }

        /**
         * Route C1 — native Super Island for the next event. Posts a persistent
         * focus notification; when Shizuku is available it applies the XMSF
         * network workaround so custom content renders without Xiaomi's whitelist.
         */
        Function("postIsland") { data: Map<String, Any> ->
            XIslandPoster.post(context, data)
        }

        /** Remove the persistent next-event island notification. */
        Function("cancelIsland") {
            XIslandPoster.cancel(context)
        }

        /** Shizuku state for the whitelist workaround. */
        Function("getShizukuState") {
            mapOf(
                "installed" to XShizukuFirewall.isShizukuInstalled(context),
                "running" to XShizukuFirewall.isShizukuRunning(),
                "granted" to XShizukuFirewall.isPermissionGranted(),
                "ready" to XIslandPoster.shizukuReady(context),
            )
        }

        /** Open the Shizuku permission dialog for this app. */
        Function("requestShizukuPermission") {
            XShizukuFirewall.requestPermission()
            true
        }

        /** Whether this device supports the native Super Island at all. */
        Function("isIslandSupported") {
            XIslandPoster.isSupported(context)
        }

        /** Schedules a real alarm ~8 seconds out through the full pipeline — for testing. */
        Function("fireTestAlarm") {
            android.util.Log.d("XCalendarAlarm", "fireTestAlarm called")
            val fireAt = System.currentTimeMillis() + 8_000L
            val alarm = JSONObject()
                .put("id", "test-${System.currentTimeMillis()}")
                .put("fireAt", fireAt)
                .put("title", "🔔 XCalendar test alarm")
                .put("body", "If you see this full-screen, reminders are bulletproof.")
                .put("kind", "reminder")
            // addAlarm, NOT replaceAll — the test must never wipe the real pending set.
            XAlarmScheduler.addAlarm(context, alarm)
            android.util.Log.d("XCalendarAlarm", "test alarm scheduled at $fireAt")
            return@Function fireAt
        }
    }
}
