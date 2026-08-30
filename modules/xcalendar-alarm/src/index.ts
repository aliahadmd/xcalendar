import { requireNativeModule } from "expo-modules-core";

export interface XAlarmItem {
  id: string;
  /** Epoch ms */
  fireAt: number;
  title: string;
  body: string;
  kind: "reminder" | "countdown";
}

export interface XAlarmPermissionStates {
  notifications: boolean;
  fullScreenIntent: boolean;
  overlay: boolean;
  exactAlarm: boolean;
  batteryIgnoring: boolean;
  isXiaomi: boolean;
}

export default requireNativeModule("XCalendarAlarm") as {
  scheduleAlarms(alarms: XAlarmItem[]): Promise<void>;
  cancelAllAlarms(): Promise<void>;
  getPermissionStates(): Promise<XAlarmPermissionStates>;
  openAutostart(): boolean;
  openOverlaySettings(): boolean;
  openAppNotificationSettings(): boolean;
  openExactAlarmSettings(): boolean;
  openBatterySettings(): boolean;
  fireTestAlarm(): number;
};
