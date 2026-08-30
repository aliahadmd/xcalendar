package expo.modules.xcalendaralarm;

// Runs inside the Shizuku server process (shell privileges) via bindUserService.
interface IXFirewallService {
    /** 0 = allow, 2 = deny within the OEM firewall chain (9). */
    boolean setUidNetworkBlocked(int uid, boolean blocked);
}
