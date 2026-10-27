/**
 * Secrets in the iOS Keychain or the Android Keystore: the refresh token, with the server
 * it belongs to. Readable after the first unlock (so a refresh works when a notification
 * opens the app), never synced to other devices or backups.
 */
import * as Keychain from "react-native-keychain";

const OPTIONS = {
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;
const SERVICE = "open-chat.session";

export interface StoredSession {
  refreshToken: string;
  refreshExpiresAt: string;
  /** The API base the token was issued by: a token is never sent to another server. */
  server: string;
}

export const secureStore = {
  async readSession(): Promise<StoredSession | null> {
    try {
      const c = await Keychain.getGenericPassword({ service: SERVICE });
      if (!c) return null;
      const parsed = JSON.parse(c.password) as Partial<StoredSession>;
      return parsed.refreshToken && parsed.server && parsed.refreshExpiresAt ? (parsed as StoredSession) : null;
    } catch {
      return null;
    }
  },
  async writeSession(s: StoredSession): Promise<void> {
    await Keychain.setGenericPassword("session", JSON.stringify(s), {
      ...OPTIONS,
      service: SERVICE,
    });
  },
  async clearSession(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => undefined);
  },
};
