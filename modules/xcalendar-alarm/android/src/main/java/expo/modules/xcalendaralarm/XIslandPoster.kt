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
    private const val ISLAND_PIC = "miui.focus.pic_island"
    private val handler = Handler(Looper.getMainLooper())

    fun focusProtocol(context: Context): Int = XAlarmNotifier.focusProtocol(context)

    private fun clip(s: String?, n: Int): String {
        val v = (s ?: "").trim()
        return if (v.length <= n) v else v.take(n - 1) + "…"
    }

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

    private fun buildV3Param(
        title: String,
        subtitle: String,
        content: String,
        subContent: String,
        extraTitle: String,
        ticker: String,
        aod: String,
    ): String {
        // Big island, left: app icon + event name + date/time.
        val leftText = JSONObject()
            .put("title", clip(title, 24))
            .put("content", clip(subtitle, 40))
            .put("showHighlightColor", true)
        val leftArea = JSONObject()
            .put("type", 1)
            .put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC))
            .put("textInfo", leftText)
        // Big island, right: the live countdown.
        val rightText = JSONObject()
            .put("title", clip(content, 16))
            .put("showHighlightColor", true)
        val rightArea = JSONObject()
            .put("type", 1)
            .put("textInfo", rightText)
        val paramIsland = JSONObject()
            .put("islandProperty", 1)
            .put("islandPriority", 2)
            .put(
                "bigIslandArea",
                JSONObject().put("imageTextInfoLeft", leftArea).put("imageTextInfoRight", rightArea),
            )
            .put(
                "smallIslandArea",
                JSONObject().put("picInfo", JSONObject().put("type", 1).put("pic", ISLAND_PIC)),
            )
        // Notification card (baseInfo): label, event, date·time, countdown, next-up.
        val baseInfo = JSONObject()
            .put("type", 1)
            .put("extraTitle", clip(extraTitle, 20))
            .put("title", clip(title, 30))
            .put("subTitle", clip(subtitle, 30))
            .put("content", clip(content, 60))
        if (subContent.isNotBlank()) baseInfo.put("subContent", clip(subContent, 60))
        val paramV2 = JSONObject()
            .put("protocol", 3)
            .put("business", "xcalendar_next_event")
            .put("updatable", true)
            .put("ticker", clip(ticker, 40))
            .put("enableFloat", true)
            .put("isShowNotification", true)
            .put("islandFirstFloat", false)
            .put("aodTitle", clip(aod, 30))
            .put("param_island", paramIsland)
            .put("baseInfo", baseInfo)
        return JSONObject()
            .put("param_v2", paramV2)
            .put("isShowNotification", true)
            .toString()
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
                                ISLAND_PIC,
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
            val param = buildV3Param(title, subtitle, content, subContent, extraTitle, ticker, aod)
            val useShizuku =
                XShizukuFirewall.isShizukuRunning() && XShizukuFirewall.isPermissionGranted()
            if (useShizuku) XShizukuFirewall.blockXmsf(context)
            try {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIF_ID, buildNotification(context, title, subtitle, content, param))
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
