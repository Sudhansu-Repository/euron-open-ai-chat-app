/**
 * Read aloud: GET /api/messages/:id/speech (audio from the server's speech model, in the
 * voice chosen in Personalization) saved to the cache folder, then played. One answer
 * plays at a time; starting another, or tapping again, stops the first. The audio file is
 * deleted when playback ends.
 */
import { useSyncExternalStore } from "react";
import ReactNativeBlobUtil from "react-native-blob-util";
import { createSound } from "react-native-nitro-sound";

type Sound = ReturnType<typeof createSound>;
import type { ApiClient } from "../../api/client";

type State = {
  messageId: string | null;
  status: "idle" | "loading" | "playing";
};

let state: State = { messageId: null, status: "idle" };
const listeners = new Set<() => void>();
let player: Sound | null = null;
let currentFile: string | null = null;

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

async function cleanup() {
  player?.removePlaybackEndListener();
  await player?.stopPlayer().catch(() => undefined);
  if (currentFile) await ReactNativeBlobUtil.fs.unlink(currentFile).catch(() => undefined);
  currentFile = null;
}

export async function stopReading(): Promise<void> {
  await cleanup();
  set({ messageId: null, status: "idle" });
}

/**
 * Plays an answer, or stops it when it is the one playing. `token` is the current access
 * token: the download goes straight to a file (no base64 through JavaScript).
 */
export async function toggleRead(api: ApiClient, baseUrl: string, messageId: string, token: () => Promise<string | null>): Promise<void> {
  if (state.messageId === messageId) return stopReading();
  await cleanup();
  set({ messageId, status: "loading" });
  try {
    const auth = await token();
    const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/read-${messageId}.mp3`;
    const res = await ReactNativeBlobUtil.config({
      path,
      timeout: 60_000,
    }).fetch("GET", `${baseUrl}/messages/${encodeURIComponent(messageId)}/speech`, { Authorization: `Bearer ${auth ?? ""}`, "X-Client": "native" });
    const status = res.info().status;
    if (status === 401) {
      // The access token had expired: refresh once through the client and try again.
      await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
      await api.refreshSession();
      if (state.messageId === messageId) state = { messageId: null, status: "idle" };
      return toggleRead(api, baseUrl, messageId, token);
    }
    if (status >= 400) throw new Error(`speech ${status}`);
    if (state.messageId !== messageId) return; // stopped while loading
    currentFile = path;
    player = player ?? createSound();
    player.addPlaybackEndListener(() => {
      stopReading();
    });
    await player.startPlayer(`file://${path}`);
    set({ messageId, status: "playing" });
  } catch (e) {
    await stopReading();
    throw e;
  }
}

export function useReading(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}
