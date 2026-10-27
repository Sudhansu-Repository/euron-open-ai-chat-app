/**
 * The signed-in session. On launch it reads the refresh token from the Keychain and
 * refreshes once; the access token then lives only in memory and is refreshed on demand
 * by the client when the API says it is stale. The vendored client saves every rotated
 * refresh token through `native.setRefreshToken` before using it, so a crash cannot leave
 * a spent token stored.
 *
 * A refresh token belongs to the server that issued it: changing the server signs out.
 */
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { makeApi, type ApiClient } from "../api/client";
import type { LoginInput, SignupInput } from "../api/vendor/client/endpoints/core";
import type { AuthResult, Me } from "../api/vendor/types";
import { forgetThisDevice } from "../lib/push";
import { secureStore } from "../lib/secure-store";
import { currentServer, saveServer } from "../lib/server";
import { PREF, prefs } from "../lib/storage";
import { clearPersistedCache } from "./query";

/** `offline`: a stored session the server could not be reached to confirm (cached chats still open). */
export type SessionStatus = "booting" | "signedOut" | "signedIn" | "offline";

export type SignInOutcome = { ok: true } | { ok: false; totpRequired: true } | { ok: false; verificationRequired: true; email: string };

export interface SessionValue {
  status: SessionStatus;
  me: Me | null;
  api: ApiClient;
  server: string;
  /** Switch to another server (signs out first when signed in). */
  setServer: (apiBase: string) => Promise<void>;
  signIn: (input: LoginInput) => Promise<SignInOutcome>;
  signUp: (input: SignupInput) => Promise<SignInOutcome>;
  /** Email verification by link: the server answers with a session. */
  verifyEmail: (token: string) => Promise<void>;
  signOut: (opts?: { everywhere?: boolean }) => Promise<void>;
  setMe: (me: Me) => void;
  /** The current access token, for the few downloads that bypass the client (read aloud). */
  accessToken: () => string | null;
  /** Try the stored session again (after coming back online). */
  retry: () => void;
}

/** Exported for tests (test/render.tsx), which provide a fake session. */
export const SessionContext = createContext<SessionValue | null>(null);

/** How long launch waits for the server before opening on the cached chats instead. */
export const BOOT_TIMEOUT_MS = 10_000;

/** Rejects when `p` takes longer than `ms`; a connection that hangs must not hang the launch. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const isAuth = (r: unknown): r is AuthResult => !!r && typeof r === "object" && "accessToken" in r && "user" in r;

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [server, setServerState] = useState(currentServer);
  const [status, setStatus] = useState<SessionStatus>("booting");
  const [me, setMe] = useState<Me | null>(null);
  const access = useRef<string | null>(null);
  const refresh = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const endLocally = useCallback(async () => {
    access.current = null;
    refresh.current = null;
    await secureStore.clearSession();
    queryClient.clear();
    clearPersistedCache();
    // The next person on this phone gets a fresh push token (the server already dropped this one).
    forgetThisDevice();
    setMe(null);
    setStatus("signedOut");
  }, [queryClient]);

  const api = useMemo(
    () =>
      makeApi(server, {
        getAccessToken: () => access.current,
        native: {
          getRefreshToken: async () => {
            if (refresh.current) return refresh.current;
            const stored = await secureStore.readSession();
            return stored && stored.server === server ? stored.refreshToken : null;
          },
          setRefreshToken: async (token, expiresAt) => {
            refresh.current = token;
            if (token)
              await secureStore.writeSession({
                refreshToken: token,
                refreshExpiresAt: expiresAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
                server,
              });
            else await secureStore.clearSession();
          },
        },
        onRefresh: (r) => {
          access.current = r.accessToken;
          setMe(r.user);
        },
        onSignedOut: () => {
          endLocally().catch(() => undefined);
        },
      }),
    [server, endLocally]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await secureStore.readSession();
      if (!stored || stored.server !== server || Date.parse(stored.refreshExpiresAt) <= Date.now()) {
        // No usable session: whatever was cached belonged to someone who is signed out.
        if (stored) await secureStore.clearSession();
        queryClient.clear();
        clearPersistedCache();
        if (alive) setStatus("signedOut");
        return;
      }
      refresh.current = stored.refreshToken;
      try {
        const r = await withTimeout(api.refreshSession(), BOOT_TIMEOUT_MS);
        if (!alive) return;
        if (r) {
          access.current = r.accessToken;
          setMe(r.user);
          setStatus("signedIn");
        } else await endLocally();
      } catch {
        // Offline at launch: keep the stored session and open on the cached chats.
        if (alive) setStatus("offline");
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, server, endLocally, attempt, queryClient]);

  const adopt = useCallback((r: AuthResult) => {
    access.current = r.accessToken;
    setMe(r.user);
    setStatus("signedIn");
  }, []);

  const signIn = useCallback(
    async (input: LoginInput): Promise<SignInOutcome> => {
      const r = await api.auth.login(input);
      if ("totpRequired" in r) return { ok: false, totpRequired: true };
      if (!isAuth(r)) throw new Error("The server did not start a session.");
      adopt(r);
      return { ok: true };
    },
    [api, adopt]
  );

  const signUp = useCallback(
    async (input: SignupInput): Promise<SignInOutcome> => {
      const r = await api.auth.signup(input);
      if ("verificationRequired" in r) return { ok: false, verificationRequired: true, email: r.email };
      if (!isAuth(r)) throw new Error("The server did not start a session.");
      adopt(r);
      return { ok: true };
    },
    [api, adopt]
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      adopt(await api.auth.verifyEmail(token));
    },
    [api, adopt]
  );

  const signOut = useCallback(
    async (opts?: { everywhere?: boolean }) => {
      try {
        if (opts?.everywhere) await api.auth.logoutAll();
        else await api.auth.logout(prefs.getString(PREF.pushToken) ?? null);
      } catch {
        // Signing out must always work locally, even offline or with a revoked session.
      }
      await endLocally();
    },
    [api, endLocally]
  );

  const setServer = useCallback(
    async (apiBase: string) => {
      if (apiBase === server) return;
      if (status === "signedIn" || status === "offline") await signOut();
      saveServer(apiBase);
      prefs.remove(PREF.meta);
      queryClient.clear();
      setServerState(apiBase);
    },
    [server, status, signOut, queryClient]
  );

  const retry = useCallback(() => {
    setStatus("booting");
    setAttempt((n) => n + 1);
  }, []);

  const accessToken = useCallback(() => access.current, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      api,
      server,
      setServer,
      signIn,
      signUp,
      verifyEmail,
      signOut,
      setMe,
      accessToken,
      retry,
    }),
    [status, me, api, server, setServer, signIn, signUp, verifyEmail, signOut, accessToken, retry]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

/** The API client, for hooks and screens. */
export function useApi(): ApiClient {
  return useSession().api;
}
