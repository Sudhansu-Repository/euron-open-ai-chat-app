/**
 * Build-time configuration from .env (react-native-config). Only what the app needs before
 * it can reach a server lives here; everything else (the app's name, which features are
 * on, whether push works) comes from GET /api/meta of the server in use.
 *
 * The server can be changed on the welcome screen (lib/server.ts) unless the build sets
 * ALLOW_CUSTOM_SERVER=false. API_BASE_URL is only the default.
 *
 * Local development: the iOS simulator shares the Mac's localhost. For the Android
 * emulator or a USB device run `pnpm android:reverse`, which forwards the local stack's
 * ports, so the same localhost URLs work there too (docs/guides/android.md).
 */
import Config from "react-native-config";
import { Platform } from "react-native";

function required(name: string, value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  if (v) return v;
  if (__DEV__) return fallback;
  throw new Error(`${name} is not set. Copy .env.example to .env and set it before building a release.`);
}

export const config = {
  /** The default euron-open-ai-chat API, including /api. */
  defaultApiBaseUrl: required("API_BASE_URL", Config.API_BASE_URL, "http://localhost:5036/api").replace(/\/+$/, ""),
  /** The app's URL scheme for deep links. */
  scheme: (Config.APP_SCHEME ?? "openchat").trim() || "openchat",
  /** Whether people may point the app at another server. */
  allowCustomServer: (Config.ALLOW_CUSTOM_SERVER ?? "true").trim().toLowerCase() !== "false",
  platform: Platform.OS as "ios" | "android",
} as const;
