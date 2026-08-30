package expo.modules.xcalendaralarm

import android.os.IBinder
import android.util.Log
import androidx.annotation.Keep
import java.lang.reflect.InvocationTargetException

/**
 * Shizuku UserService — instantiated by the Shizuku server INSIDE its
 * shell-privileged process, where reflection on hidden framework APIs
 * (IConnectivityManager firewall methods) is unrestricted. This is the
 * proven "Stardawn workaround" pattern from HyperBridge.
 */
@Keep
class XFirewallServiceImpl : IXFirewallService.Stub() {

    companion object {
        private const val TAG = "XCalendarFirewall"
        private const val OEM_DENY_CHAIN = 9
        private const val RULE_ALLOW = 0
        private const val RULE_DENY = 2
    }

    override fun setUidNetworkBlocked(uid: Int, blocked: Boolean): Boolean {
        return try {
            val cm = connectivityManager()
            // Enable the OEM chain once, when blocking. The connectivity service
            // may throw NetworkOnMainThreadException while destroying the blocked
            // UID's sockets AFTER applying the rule — the rule is still applied.
            // So we run each call in its own try and treat success-or-socket-throw
            // as "applied".
            if (blocked) {
                runCatching { call(cm, "setFirewallChainEnabled", OEM_DENY_CHAIN, true) }
                    .onFailure { Log.w(TAG, "setFirewallChainEnabled best-effort: ${it.message}") }
            }
            val rule = if (blocked) RULE_DENY else RULE_ALLOW
            runCatching { call(cm, "setUidFirewallRule", OEM_DENY_CHAIN, uid, rule) }
                .onSuccess {
                    Log.d(TAG, "uid=$uid blocked=$blocked applied")
                    return true
                }
                .onFailure {
                    // Retry once — the rule may have been applied before the throw.
                    Log.w(TAG, "setUidFirewallRule retrying after: ${it.message}")
                    Thread.sleep(300)
                    runCatching { call(cm, "setUidFirewallRule", OEM_DENY_CHAIN, uid, rule) }
                        .onSuccess { Log.d(TAG, "uid=$uid blocked=$blocked applied (retry)"); return true }
                }
            false
        } catch (t: Throwable) {
            Log.e(TAG, "setUidNetworkBlocked failed: ${t.message}", t)
            false
        }
    }

    /** Real ConnectivityManager proxy — this process already holds shell privileges. */
    private fun connectivityManager(): Any {
        val smClass = Class.forName("android.os.ServiceManager")
        val getService = smClass.getMethod("getService", String::class.java)
        val binder = getService.invoke(null, "connectivity") as? IBinder
            ?: throw RuntimeException("connectivity service not found")
        val stubClass = Class.forName("android.net.IConnectivityManager\$Stub")
        val asInterface = stubClass.getMethod("asInterface", IBinder::class.java)
        return asInterface.invoke(null, binder)
            ?: throw RuntimeException("asInterface returned null")
    }

    /** Match by name + parameter count (exact-type lookup fails on hidden APIs). */
    private fun call(obj: Any, methodName: String, vararg args: Any) {
        val method = obj.javaClass.methods.find {
            it.name == methodName && it.parameterCount == args.size
        } ?: throw NoSuchMethodException("$methodName(${args.size} params) on ${obj.javaClass.name}")

        val coerced = Array(args.size) { i ->
            val param = method.parameterTypes[i]
            val arg = args[i]
            when {
                param == Int::class.javaPrimitiveType && arg is Int -> arg
                param == Boolean::class.javaPrimitiveType && arg is Boolean -> arg
                param == Boolean::class.javaPrimitiveType && arg is Int -> arg != 0
                param == Int::class.javaPrimitiveType && arg is Boolean -> if (arg) 1 else 0
                else -> arg
            }
        }
        try {
            method.invoke(obj, *coerced)
        } catch (e: InvocationTargetException) {
            Log.e(TAG, "$methodName threw: ${e.targetException?.message}")
            throw e
        }
    }
}
