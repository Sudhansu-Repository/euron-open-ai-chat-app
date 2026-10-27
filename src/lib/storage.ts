/**
 * Small, non-secret preferences that should survive a restart (theme, the server in use,
 * the push token, the offline cache). Secrets never go here: the refresh token lives in
 * the Keychain or Keystore (lib/secure-store.ts).
 */
import { createMMKV, type MMKV } from "react-native-mmkv";

let instance: MMKV | null = null;

function store(): MMKV {
  if (!instance) instance = createMMKV({ id: "open-chat" });
  return instance;
}

export const prefs = {
  getString(key: string): string | undefined {
    return store().getString(key);
  },
  setString(key: string, value: string): void {
    store().set(key, value);
  },
  getJson<T>(key: string): T | undefined {
    const raw = store().getString(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  setJson(key: string, value: unknown): void {
    store().set(key, JSON.stringify(value));
  },
  remove(key: string): void {
    store().remove(key);
  },
};

/** Keys in one place so nothing collides. */
export const PREF = {
  theme: "theme",
  /** The euron-open-ai-chat API in use (lib/server.ts). */
  server: "server.url",
  meta: "meta.cache",
  /** The persisted query cache for offline reading (app/query.ts), stamped with its owner. */
  queryCache: "query.cache.v1",
  pushToken: "push.token",
  /** Set once the app has shown the system prompt, so a refusal is never asked again. */
  pushAsked: "push.asked",
  /** Set once the in-chat "tell me when answers are ready" offer was answered or dismissed. */
  pushOffered: "push.offered",
  /** The model picked in the composer for new chats on this device. */
  lastModel: "chat.lastModel",
} as const;
