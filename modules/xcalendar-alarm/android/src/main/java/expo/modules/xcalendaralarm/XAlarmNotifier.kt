package expo.modules.xcalendaralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.media.RingtoneManager
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationCompat
import org.json.JSONObject

object XAlarmNotifier {
    const val CHANNEL_ID = "xcalendar_alarms"
    const val TEST_CHANNEL_ID = "xcalendar_island_test"
    private const val ISLAND_PIC = "miui.focus.pic_island"
    private const val ISLAND_TEST_NOTIF_ID = 910001

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Alarms & reminders",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Time-critical event reminders"
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 300, 400, 300, 800)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(channel)
    }

    /** Silent channel used only for Super Island rendering tests. */
    private fun ensureTestChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                TEST_CHANNEL_ID,
                "Super Island test",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = "Silent test notifications for Super Island rendering" },
        )
    }

    /**
     * HyperOS focus-notification protocol:
     * 0 = none · 1 = OS1 focus · 2 = OS2 focus · 3 = OS3 Super Island.
     */
    fun focusProtocol(context: Context): Int = try {
        Settings.System.getInt(context.contentResolver, "notification_focus_protocol", 0)
    } catch (e: Exception) {
        0
    }

    /** Island hardware capability (persist.sys.feature.island). */
    fun islandSupported(context: Context): Boolean = try {
        val clazz = Class.forName("android.os.SystemProperties")
        val m = clazz.getDeclaredMethod("getBoolean", String::class.java, Boolean::class.javaPrimitiveType)
        (m.invoke(null, "persist.sys.feature.island", false) as? Boolean) ?: false
    } catch (e: Exception) {
        false
    }

    private fun clip(s: String?, n: Int): String {
        val v = (s ?: "").trim()
        return if (v.length <= n) v else v.take(n - 1) + "…"
    }

    /**
     * Official HyperOS 3 Super Island payload (dev.mi.com), field-for-field
     * matched to the empirically working HyperIsland-ToolKit models:
     *   root:      { param_v2: {...}, isShowNotification: true }
     *   param_v2:  protocol=3, business, updatable, ticker, aodTitle,
     *              param_island → { islandProperty, islandPriority,
     *              bigIslandArea → imageTextInfoLeft → { type, picInfo, textInfo },
     *              smallIslandArea → { picInfo } }, baseInfo
     * miui.focus.param is limited to 3072 bytes — titles/bodies are clipped.
     */
    private fun buildV3Param(title: String, body: String, updatable: Boolean): String {
        val textInfo = JSONObject()
            .put("title", clip(title, 20))
            .put("content", clip(body, 40))
            .put("showHighlightColor", true)
        val leftArea = JSONObject()
            .put("type", 1)
            .put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC))
            .put("textInfo", textInfo)
        val paramIsland = JSONObject()
            .put("islandProperty", 1)
            .put("islandPriority", 2)
            .put("bigIslandArea", JSONObject().put("imageTextInfoLeft", leftArea))
            .put(
                "smallIslandArea",
                JSONObject().put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC)),
            )
        val paramV2 = JSONObject()
            .put("protocol", 3)
            .put("business", "xcalendar_alarm")
            .put("updatable", updatable)
            // OS3-only apps must pass ticker or the status-bar notification won't show.
            .put("ticker", clip(title, 20))
            .put("enableFloat", true)
            .put("isShowNotification", true)
            .put("islandFirstFloat", true)
            .put("aodTitle", clip(title, 20))
            .put("param_island", paramIsland)
            .put(
                "baseInfo",
                JSONObject().put("type", 1).put("title", clip(title, 30)).put("content", clip(body, 60)),
            )
        // Top-level wrapper shape used by the working toolkit.
        return JSONObject()
            .put("param_v2", paramV2)
            .put("isShowNotification", true)
            .toString()
    }

    /** Legacy OS2 focus-notification payload (reverse-engineered, pre-Super-Island devices). */
    private fun buildV2Param(title: String, body: String): String {
        val baseInfo = JSONObject()
            .put("type", 1)
            .put("title", title)
            .put("content", body)
            .put("extraTitle", "Reminder")
        val paramIsland = JSONObject()
            .put("islandPriority", 3)
            .put("needCloseAnimation", true)
        val paramV2 = JSONObject()
            .put("business", "xcalendar_alarm")
            .put("ticker", "⏰ $title")
            .put("enableFloat", true)
            .put("isShowNotification", true)
            .put("islandFirstFloat", true)
            .put("paramIsland", paramIsland)
            .put("baseInfo", baseInfo)
        return JSONObject().put("paramV2", paramV2).toString()
    }

    /**
     * miui.focus.param JSON matching the device's HyperOS version, or null.
     * Attached to the built notification via extras.putString (toolkit contract —
     * passing it through Builder.addExtras is not honored by SystemUI).
     */
    fun focusParamJson(context: Context, title: String, body: String, updatable: Boolean): String? {
        if (!XAlarmScheduler.isXiaomi()) return null
        return try {
            val protocol = focusProtocol(context)
            android.util.Log.d(
                "XCalendarAlarm",
                "focusParamJson: protocol=$protocol island=${islandSupported(context)} xiaomi=true",
            )
            when {
                protocol >= 3 -> buildV3Param(title, body, updatable).also {
                    android.util.Log.d("XCalendarAlarm", "V3 payload (${it.length}B): $it")
                }
                protocol == 2 -> buildV2Param(title, body)
                else -> null
            }
        } catch (e: Exception) {
            android.util.Log.e("XCalendarAlarm", "focusParamJson failed", e)
            null
        }
    }

    /** miui.focus.pics bundle with the island icon (HyperOS 3 only), or null. */
    private fun focusPicsBundle(context: Context): Bundle? {
        if (!XAlarmScheduler.isXiaomi() || focusProtocol(context) < 3) return null
        return try {
            Bundle().apply {
                putBundle(
                    "miui.focus.pics",
                    Bundle().apply {
                        putParcelable(
                            ISLAND_PIC,
                            Icon.createWithResource(context, context.applicationInfo.icon),
                        )
                    },
                )
            }
        } catch (e: Exception) {
            null
        }
    }

    fun buildFireNotification(
        context: Context,
        id: String,
        title: String,
        body: String,
        kind: String,
    ): Notification {
        ensureChannel(context)

        val alarmActivity = Intent(context, XAlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("id", id)
            putExtra("title", title)
            putExtra("body", body)
            putExtra("kind", kind)
        }
        val fullScreenPi = PendingIntent.getActivity(
            context,
            id.hashCode(),
            alarmActivity,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        val contentPi = PendingIntent.getActivity(
            context,
            (id + "open").hashCode(),
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val donePi = PendingIntent.getBroadcast(
            context,
            (id + "done").hashCode(),
            Intent(context, XAlarmActionReceiver::class.java).apply {
                action = "xcalendar.DISMISS"
                putExtra("notifId", id.hashCode())
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val snoozePi = PendingIntent.getBroadcast(
            context,
            (id + "snooze").hashCode(),
            Intent(context, XAlarmActionReceiver::class.java).apply {
                action = "xcalendar.SNOOZE"
                putExtra("notifId", id.hashCode())
                putExtra("id", id)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("kind", kind)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            // Own group per alarm — otherwise Android autogroups multiple alarms
            // into a SILENT group summary that never alerts and never full-screens.
            .setGroup("alarm-$id")
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_ALL)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(contentPi)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(30 * 60_000L)
            .addAction(0, "✓ Done", donePi)
            .addAction(0, "Snooze 10 min", snoozePi)

        focusPicsBundle(context)?.let { builder.addExtras(it) }
        val notification = builder.build()
        // miui.focus.param must land on the built notification's extras —
        // Builder.addExtras does not deliver it to SystemUI.
        focusParamJson(context, title, body, updatable = false)?.let {
            notification.extras.putString("miui.focus.param", it)
        }
        return notification
    }

    /**
     * Post (or update) a persistent silent notification rendered on the Super
     * Island — a rendering harness for HyperOS 3. Re-posting with the same id
     * updates the island content live (updatable = true).
     */
    fun postIslandTest(context: Context, title: String, body: String): Boolean {
        try {
            if (!XAlarmScheduler.isXiaomi() || focusProtocol(context) < 3) return false
            ensureTestChannel(context)
            val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
            val contentPi = PendingIntent.getActivity(
                context,
                910002,
                openApp,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val builder = NotificationCompat.Builder(context, TEST_CHANNEL_ID)
                .setSmallIcon(context.applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(body)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(contentPi)
            focusPicsBundle(context)?.let { builder.addExtras(it) }
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notification = builder.build()
            focusParamJson(context, title, body, updatable = true)?.let {
                notification.extras.putString("miui.focus.param", it)
            }
            nm.notify(ISLAND_TEST_NOTIF_ID, notification)
            android.util.Log.d("XCalendarAlarm", "island test notification posted")
            return true
        } catch (e: Exception) {
            android.util.Log.e("XCalendarAlarm", "postIslandTest failed", e)
            return false
        }
    }

    /** Remove the island test notification (also clears it from the island). */
    fun cancelIslandTest(context: Context): Boolean {
        return try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(ISLAND_TEST_NOTIF_ID)
            true
        } catch (e: Exception) {
            false
        }
    }
}
