/**
 * The app's API client: the euron-open-ai-chat contract vendored in src/api/vendor (types
 * and @open-chat/api-client, unchanged) in native token mode. The refresh token is kept
 * in the Keychain through `native`; streams are read over XMLHttpRequest because React
 * Native's fetch cannot stream (`transport: "xhr"` in the turn runner).
 */
import { createApiClient, type ApiClient, type NativeTokenStore } from "./vendor/client";
import type { SignOutReason } from "./vendor/client/http";
import type { AuthResult } from "./vendor/types";

export interface ClientHooks {
  native: NativeTokenStore;
  getAccessToken: () => string | null;
  onRefresh: (r: AuthResult) => void;
  onSignedOut: (reason: SignOutReason) => void;
}

export function makeApi(baseUrl: string, hooks: ClientHooks): ApiClient {
  return createApiClient({
    baseUrl,
    getAccessToken: hooks.getAccessToken,
    onRefresh: hooks.onRefresh,
    onSignedOut: hooks.onSignedOut,
    // One JavaScript runtime: the client's own single-flight refresh is enough.
    crossTabLock: (fn) => fn(),
    native: hooks.native,
  });
}

export type { ApiClient };
