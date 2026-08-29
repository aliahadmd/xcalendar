import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { settingsRef } from "@/db/settings";

const tickPlayer = createAudioPlayer(require("../../assets/sounds/tick.wav"));
const completePlayer = createAudioPlayer(require("../../assets/sounds/complete.wav"));
const savePlayer = createAudioPlayer(require("../../assets/sounds/save.wav"));
const deletePlayer = createAudioPlayer(require("../../assets/sounds/delete.wav"));

let modeSet = false;

export type SoundKind = "tick" | "complete" | "save" | "delete";

export async function playSound(kind: SoundKind): Promise<void> {
  if (!settingsRef.current?.soundsOn) return;
  if (!modeSet) {
    modeSet = true;
    await setAudioModeAsync({ playsInSilentMode: true });
  }
  const player =
    kind === "tick"
      ? tickPlayer
      : kind === "complete"
        ? completePlayer
        : kind === "save"
          ? savePlayer
          : deletePlayer;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // sound is best-effort
  }
}
