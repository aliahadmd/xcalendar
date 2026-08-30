package expo.modules.xcalendaralarm

import android.content.ComponentName
import android.content.Context
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
 */
object XShizukuFirewall {
    private const val TAG = "XCalendarAlarm"
    private const val XMSF_PACKAGE = "com.xiaomi.xmsf"

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
                .version(2) // bump to force Shizuku to reload the service after app updates
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

    /** Temporarily block XMSF's network so the signature check fails open. */
    fun blockXmsf(context: Context): Boolean {
        val uid = xmsfUid(context)
        if (uid < 0) return false
        val s = obtainService(context) ?: return false
        return try {
            s.setUidNetworkBlocked(uid, true).also {
                Log.d(TAG, "XMSF (uid=$uid) network blocked=$it")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "blockXmsf failed: ${t.message}")
            false
        }
    }

    /** Restore XMSF's network (the OEM chain itself stays enabled — HyperBridge does the same). */
    fun restoreXmsf(context: Context): Boolean {
        val uid = xmsfUid(context)
        if (uid < 0) return false
        val s = service ?: return true // nothing was blocked
        return try {
            s.setUidNetworkBlocked(uid, false).also {
                Log.d(TAG, "XMSF (uid=$uid) network restored=$it")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "restoreXmsf failed: ${t.message}")
            false
        }
    }
}
