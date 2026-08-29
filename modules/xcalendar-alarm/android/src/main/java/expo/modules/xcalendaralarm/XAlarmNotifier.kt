package expo.modules.xcalendaralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Bundle
import androidx.core.app.NotificationCompat
import org.json.JSONObject

object XAlarmNotifier {
    const val CHANNEL_ID = "xcalendar_alarms"

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

    /**
     * HyperIsland (focus notification) extras — standard Android notification with
     * the undocumented `miui.focus.param` payload so the reminder surfaces on the
     * Dynamic Island on HyperOS. Falls back to a regular notification elsewhere.
     */
    private fun focusExtras(context: Context, title: String, body: String): Bundle? {
        if (!XAlarmScheduler.isXiaomi()) return null
        return try {
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
            val payload = JSONObject().put("paramV2", paramV2)
            Bundle().apply { putString("miui.focus.param", payload.toString()) }
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

        focusExtras(context, title, body)?.let { builder.addExtras(it) }
        return builder.build()
    }
}
