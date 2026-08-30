package expo.modules.xcalendaralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Route C1: persistent "next event" Super Island via the real focus-notification
 * pipeline. Uses XShizukuFirewall (the Stardawn workaround) so the custom
 * content renders even though XCalendar is not on Xiaomi's whitelist:
 *
 *   block XMSF network → post miui.focus.param notification →
 *   wait ~1s → restore XMSF network.
 */
object XIslandPoster {
    private const val TAG = "XCalendarAlarm"
    const val CHANNEL_ID = "xcalendar_island"
    private const val NOTIF_ID = 930001
    private val handler = Handler(Looper.getMainLooper())

    fun focusProtocol(context: Context): Int = XAlarmNotifier.focusProtocol(context)

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Next event island",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps the next event on the Super Island"
                setSound(null, null)
                enableVibration(false)
            },
        )
    }

    private fun buildNotification(
        context: Context,
        title: String,
        subtitle: String,
        content: String,
        param: String,
    ): Notification {
        ensureChannel(context)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        val contentPi = PendingIntent.getActivity(
            context,
            930002,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(if (subtitle.isNotBlank()) "$subtitle · $content" else content)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(if (subtitle.isNotBlank()) "$subtitle · $content" else content),
            )
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPi)
        // Island icon.
        try {
            builder.addExtras(
                Bundle().apply {
                    putBundle(
                        "miui.focus.pics",
                        Bundle().apply {
                            putParcelable(
                                XFocusPayload.ISLAND_PIC,
                                Icon.createWithResource(context, context.applicationInfo.icon),
                            )
                        },
                    )
                },
            )
        } catch (_: Throwable) {
        }
        val notification = builder.build()
        // miui.focus.param must be set on the built notification's extras
        // (Builder.addExtras does not deliver it to SystemUI).
        notification.extras.putString("miui.focus.param", param)
        return notification
    }

    /**
     * Post (or update) the persistent next-event island, applying the XMSF
     * network workaround around the post when Shizuku is available.
     *
     * Identical payloads are skipped without touching XMSF (the param string
     * is persisted, so the dedupe survives process death).
     */
    fun post(context: Context, data: Map<String, Any>): Boolean {
        return try {
            if (XAlarmNotifier.focusProtocol(context) < 3) return false
            val title = str(data, "title", "Untitled")
            val subtitle = str(data, "subtitle", "")
            val content = str(data, "content", "")
            val subContent = str(data, "subContent", "")
            val extraTitle = str(data, "extraTitle", "Next event")
            val ticker = str(data, "ticker", title)
            val aod = str(data, "aod", if (subtitle.isNotBlank()) "$title $subtitle" else title)
            val param = XFocusPayload.islandV3Param(title, subtitle, content, subContent, extraTitle, ticker, aod)

            val prefs = context.getSharedPreferences("xcalendar_alarms", Context.MODE_PRIVATE)
            if (prefs.getString("last_island_param", null) == param) {
                Log.d(TAG, "island skipped — identical payload already posted")
                return true
            }

            val useShizuku =
                XShizukuFirewall.isShizukuRunning() && XShizukuFirewall.isPermissionGranted()
            if (useShizuku) XShizukuFirewall.blockXmsf(context)
            try {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIF_ID, buildNotification(context, title, subtitle, content, param))
                prefs.edit().putString("last_island_param", param).apply()
                Log.d(TAG, "island posted: '$title' · '$subtitle' · '$content' (shizuku=$useShizuku)")
            } finally {
                if (useShizuku) {
                    // HyperBridge: restore after ~1s so the in-flight auth times out first.
                    handler.postDelayed({ XShizukuFirewall.restoreXmsf(context) }, 1000L)
                }
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "postIsland failed", e)
            false
        }
    }

    private fun str(data: Map<String, Any>, key: String, fallback: String): String =
        (data[key] as? String)?.takeIf { it.isNotBlank() } ?: fallback

    /** Remove the persistent island notification (also clears it from the island). */
    fun cancel(context: Context): Boolean {
        return try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIF_ID)
            context.getSharedPreferences("xcalendar_alarms", Context.MODE_PRIVATE)
                .edit().remove("last_island_param").apply()
            true
        } catch (e: Exception) {
            false
        }
    }

    fun isSupported(context: Context): Boolean =
        XAlarmScheduler.isXiaomi() && XAlarmNotifier.focusProtocol(context) >= 3

    /** Can Shizuku currently power the whitelist workaround? */
    fun shizukuReady(context: Context): Boolean =
        XShizukuFirewall.isShizukuInstalled(context) &&
            XShizukuFirewall.isShizukuRunning() &&
            XShizukuFirewall.isPermissionGranted()
}
