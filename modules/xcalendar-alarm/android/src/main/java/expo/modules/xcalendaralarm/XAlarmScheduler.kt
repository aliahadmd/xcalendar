package expo.modules.xcalendaralarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Owns the set of pending alarms. Every alarm is scheduled with
 * AlarmManager.setAlarmClock() — Doze-safe, fires exactly, shows the system
 * alarm icon, and survives most OEM background killing.
 */
object XAlarmScheduler {
    private const val PREFS = "xcalendar_alarms"
    private const val KEY_PENDING = "pending"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun fireIntent(context: Context, alarm: JSONObject): PendingIntent {
        val intent = Intent(context, XAlarmReceiver::class.java).apply {
            putExtra("id", alarm.optString("id"))
            putExtra("title", alarm.optString("title"))
            putExtra("body", alarm.optString("body"))
            putExtra("kind", alarm.optString("kind", "reminder"))
            putExtra("fireAt", alarm.optLong("fireAt"))
        }
        return PendingIntent.getBroadcast(
            context,
            alarm.optString("id").hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun openAppIntent(context: Context): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        return PendingIntent.getActivity(
            context,
            1001,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun replaceAll(context: Context, alarms: List<JSONObject>) {
        cancelAll(context)
        val arr = JSONArray()
        for (alarm in alarms) {
            arr.put(alarm)
            scheduleOne(context, alarm)
        }
        prefs(context).edit().putString(KEY_PENDING, arr.toString()).apply()
    }

    private fun scheduleOne(context: Context, alarm: JSONObject) {
        val fireAt = alarm.optLong("fireAt")
        if (fireAt <= System.currentTimeMillis()) return
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // setAlarmClock: exact, Doze-proof, shows the alarm-clock indicator.
        am.setAlarmClock(
            AlarmManager.AlarmClockInfo(fireAt, openAppIntent(context)),
            fireIntent(context, alarm),
        )
    }

    /** Re-register everything stored (used after reboot). */
    fun rescheduleStored(context: Context) {
        val raw = prefs(context).getString(KEY_PENDING, null) ?: return
        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
            scheduleOne(context, arr.getJSONObject(i))
        }
    }

    fun removeOne(context: Context, id: String) {
        val raw = prefs(context).getString(KEY_PENDING, null) ?: return
        val arr = JSONArray(raw)
        val out = JSONArray()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            if (obj.optString("id") != id) out.put(obj)
        }
        prefs(context).edit().putString(KEY_PENDING, out.toString()).apply()
    }

    fun cancelAll(context: Context) {
        val raw = prefs(context).getString(KEY_PENDING, null) ?: return
        val arr = JSONArray(raw)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (i in 0 until arr.length()) {
            am.cancel(fireIntent(context, arr.getJSONObject(i)))
        }
        prefs(context).edit().remove(KEY_PENDING).apply()
    }

    fun snooze(context: Context, title: String, body: String, kind: String, minutes: Int) {
        val fireAt = System.currentTimeMillis() + minutes * 60_000L
        val id = "snooze-$fireAt"
        val alarm = JSONObject()
            .put("id", id)
            .put("fireAt", fireAt)
            .put("title", title)
            .put("body", body)
            .put("kind", kind)
        scheduleOne(context, alarm)
        // Add to pending so it survives reboot too
        val raw = prefs(context).getString(KEY_PENDING, null) ?: "[]"
        val arr = JSONArray(raw)
        arr.put(alarm)
        prefs(context).edit().putString(KEY_PENDING, arr.toString()).apply()
    }

    fun isXiaomi(): Boolean = Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true)
}
