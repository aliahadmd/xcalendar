package expo.modules.xcalendaralarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Fired by AlarmManager at the exact reminder time. */
class XAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("XCalendarAlarm", "onReceive entered, extras=${intent.extras?.keySet()}")
        try {
            val id = intent.getStringExtra("id") ?: run {
                android.util.Log.e("XCalendarAlarm", "no id extra!")
                return
            }
            val title = intent.getStringExtra("title") ?: "Reminder"
            val body = intent.getStringExtra("body") ?: ""
            val kind = intent.getStringExtra("kind") ?: "reminder"

            XAlarmScheduler.removeOne(context, id)

            // Belt and suspenders: FSI shows over the lock screen when allowed;
            // with "Display over other apps" granted we can also start directly
            // from the background (MIUI denies FSI itself sometimes).
            if (android.provider.Settings.canDrawOverlays(context)) {
                val launch = Intent(context, XAlarmActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    putExtra("id", id)
                    putExtra("title", title)
                    putExtra("body", body)
                    putExtra("kind", kind)
                }
                try {
                    context.startActivity(launch)
                    android.util.Log.d("XCalendarAlarm", "direct activity start OK")
                } catch (e: Exception) {
                    android.util.Log.e("XCalendarAlarm", "direct start denied", e)
                }
            }

            val notification = XAlarmNotifier.buildFireNotification(context, id, title, body, kind)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as android.app.NotificationManager
            nm.notify(id.hashCode(), notification)
            android.util.Log.d("XCalendarAlarm", "notification posted id=$id")
        } catch (e: Exception) {
            Log.e("XCalendarAlarm", "receiver failed", e)
        }
    }
}

/** Handles ✓ Done / Snooze buttons on the alarm notification. */
class XAlarmActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val notifId = intent.getIntExtra("notifId", -1)
        if (notifId >= 0) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as android.app.NotificationManager
            nm.cancel(notifId)
        }
        if (intent.action == "xcalendar.SNOOZE") {
            XAlarmScheduler.snooze(
                context,
                intent.getStringExtra("title") ?: "Reminder",
                intent.getStringExtra("body") ?: "",
                intent.getStringExtra("kind") ?: "reminder",
                10,
            )
        }
    }
}

/** Re-registers all alarms after a reboot (alarms don't survive restarts). */
class XAlarmBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "miui.intent.action.BOOT_COMPLETED",
            -> XAlarmScheduler.rescheduleStored(context)
        }
    }
}
