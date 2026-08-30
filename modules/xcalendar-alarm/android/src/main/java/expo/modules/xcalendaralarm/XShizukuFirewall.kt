package expo.modules.xcalendaralarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.IBinder
import android.util.Log
import rikka.shizuku.Shizuku

/**
 * XMSF network control via a Shizuku UserService (the "Stardawn workaround",
 * as used by HyperBridge).
 *
 * HyperOS verifies focus-notification custom content ONLINE: XMSF
 * (com.xiaomi.xmsf) asks Xiaomi's servers whether the app's signature is
 * whitelisted. Blocking XMSF's network for the ~1 second around posting makes
 * that verification fail OPEN, so unwhitelisted apps render native Super Island
 * content. No root — the UserService runs inside the Shizuku server process,
 * which holds ADB-shell privileges.
 *
 * Safety: a crash between block and the ~1 s delayed restore would leave XMSF
 * offline indefinitely. Three layers prevent that:
 *   1. a persisted "blocked at" marker, restored unconditionally on next app
 *      start ([restoreIfBlocked]),
 *   2. an exact AlarmManager failsafe fired 30 s after blocking
 *      ([XMsfRestoreReceiver]) — survives process death,
 *   3. the normal 1 s delayed restore on the happy path.
 */
object XShizukuFirewall {
    private const val TAG = "XCalendarAlarm"
    private const val XMSF_PACKAGE = "com.xiaomi.xmsf"
    private const val KEY_BLOCKED_AT = "xmsf_blocked_at"
    private const val RESTORE_ALARM_REQUEST = 930101
    private const val RESTORE_FAILSAFE_MS = 30_000L

    @Volatile
    private var service: IXFirewallService? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IXFirewallService.Stub.asInterface(binder)
            Log.d(TAG, "firewall user service connected")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            Log.d(TAG, "firewall user service disconnected")
        }
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences("xcalendar_alarms", Context.MODE_PRIVATE)

    fun isShizukuRunning(): Boolean = try {
        Shizuku.pingBinder()
    } catch (e: Throwable) {
        false
    }

    fun isPermissionGranted(): Boolean = try {
        Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (e: Throwable) {
        false
    }

    fun isShizukuInstalled(context: Context): Boolean = try {
        context.packageManager.getPackageInfo("moe.shizuku.privileged.api", 0)
        true
    } catch (e: Throwable) {
        false
    }

    fun requestPermission() {
        try {
            Shizuku.requestPermission(0)
        } catch (e: Throwable) {
            Log.e(TAG, "Shizuku requestPermission failed", e)
        }
    }

    private fun xmsfUid(context: Context): Int = try {
        context.packageManager.getPackageUid(XMSF_PACKAGE, 0)
    } catch (e: Throwable) {
        -1
    }

    /** App's own versionCode — Shizuku reloads the UserService when this changes. */
    private fun appVersionCode(context: Context): Int = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else info.versionCode
    } catch (e: Throwable) {
        1
    }

    /** Bind (once) and return the privileged firewall service. */
    @Synchronized
    private fun obtainService(context: Context, timeoutMs: Long = 5000): IXFirewallService? {
        service?.let { return it }
        if (!isShizukuRunning() || !isPermissionGranted()) return null
        return try {
            val args = Shizuku.UserServiceArgs(
                ComponentName(context.packageName, XFirewallServiceImpl::class.java.name),
            )
                .daemon(true)
                .processNameSuffix("firewall")
                // Derived from the app version so Shizuku automatically reloads
                // the service after every app update — no manual bump to forget.
                .version(appVersionCode(context))
                .debuggable(false)
            Shizuku.bindUserService(args, connection)
            val start = System.currentTimeMillis()
            while (service == null && System.currentTimeMillis() - start < timeoutMs) {
                Thread.sleep(50)
            }
            service
        } catch (t: Throwable) {
            Log.e(TAG, "bindUserService failed: ${t.message}")
            null
        }
    }

    private fun restoreAlarmPendingIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            RESTORE_ALARM_REQUEST,
            Intent(context, XMsfRestoreReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun scheduleRestoreFailsafe(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + RESTORE_FAILSAFE_MS,
                restoreAlarmPendingIntent(context),
            )
        } catch (t: Throwable) {
            Log.e(TAG, "scheduleRestoreFailsafe failed", t)
        }
    }

    private fun cancelRestoreFailsafe(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.cancel(restoreAlarmPendingIntent(context))
        } catch (t: Throwable) {
            // non-fatal
        }
    }

    /** Temporarily block XMSF's network so the signature check fails open. */
    fun blockXmsf(context: Context): Boolean {
        val uid = xmsfUid(context)
        if (uid < 0) return false
        // Dead-man's switch FIRST: if anything kills us mid-window, the next
        // app start and the 30 s failsafe alarm both find the marker and restore.
        prefs(context).edit().putLong(KEY_BLOCKED_AT, System.currentTimeMillis()).apply()
        scheduleRestoreFailsafe(context)
        val s = obtainService(context) ?: run {
            Log.e(TAG, "blockXmsf: no Shizuku service — restoring marker state")
            restoreIfBlocked(context)
            return false
        }
        return try {
            s.setUidNetworkBlocked(uid, true).also {
                Log.d(TAG, "XMSF (uid=$uid) network blocked=$it")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "blockXmsf failed: ${t.message}")
            restoreIfBlocked(context)
            false
        }
    }

    /**
     * Restore XMSF's network. Keeps the blocked-marker if the restore could not
     * be applied (Shizuku down), so a later [restoreIfBlocked] retries.
     */
    fun restoreXmsf(context: Context): Boolean {
        val uid = xmsfUid(context)
        if (uid < 0) {
            prefs(context).edit().remove(KEY_BLOCKED_AT).apply()
            return false
        }
        val s = obtainService(context, timeoutMs = 2500)
        if (s == null) {
            Log.w(TAG, "restoreXmsf: Shizuku unavailable — marker kept for retry")
            return false
        }
        return try {
            val ok = s.setUidNetworkBlocked(uid, false)
            Log.d(TAG, "XMSF (uid=$uid) network restored=$ok")
            if (ok) {
                prefs(context).edit().remove(KEY_BLOCKED_AT).apply()
                cancelRestoreFailsafe(context)
            }
            ok
        } catch (t: Throwable) {
            Log.e(TAG, "restoreXmsf failed: ${t.message}")
            false
        }
    }

    /**
     * Dead-man's switch entry point: if the persisted marker says XMSF may
     * still be blocked (crash inside the 1 s block window), restore now.
     * Called on every app start, from the 30 s failsafe alarm, and from
     * alarm/broadcast receivers. No-op when nothing is pending.
     */
    fun restoreIfBlocked(context: Context) {
        val blockedAt = prefs(context).getLong(KEY_BLOCKED_AT, -1L)
        if (blockedAt == -1L) return
        Log.w(TAG, "dead-man restore: XMSF was blocked at $blockedAt — restoring now")
        restoreXmsf(context)
    }
}
