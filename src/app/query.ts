/**
 * Server state lives in TanStack Query. Defaults tuned for a phone: no refetch storms on
 * every focus, retry once for flaky networks, never retry 4xx (they will not change).
 * Query keys are built here (mirroring the web app's) so invalidations always match.
 *
 * Offline reading: the chat list, pinned chats, projects, the model list, preferences and
 * the 20 most recently opened conversations are persisted to MMKV (at most 2 MB) and
 * restored at launch, so recent chats open instantly and can be read without a network.
 * The cache belongs to the stored session: every way a session ends calls
 * clearPersistedCache(), so the next person to sign in never sees it.
 */
import { QueryClient, focusManager, onlineManager, type DehydratedState } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { isApiError } from "../api/vendor/client/errors";
import { PREF, prefs } from "../lib/storage";

type F = Record<string, unknown>;

export const qk = {
  me: ["me"] as const,
  meta: ["meta"] as const,
  sessions: ["sessions"] as const,
  models: ["models"] as const,
  usage: ["usage"] as const,
  preferences: ["preferences"] as const,
  chats: (f: F = {}) => ["chats", f] as const,
  chatsAll: ["chats"] as const,
  chat: (id: string) => ["chat", id] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  memories: ["memories"] as const,
  images: ["images"] as const,
  shares: ["shares"] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60_000,
        retry: (count, err) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 1,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

/** Online and focus signals from the OS, so queries pause offline and refresh on return. */
export function wireQueryLifecycle(): () => void {
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));
  const sub = AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
  return () => sub.remove();
}

const PERSISTED_ROOTS = new Set(["chats", "chat", "projects", "project", "models", "preferences", "meta"]);
export const MAX_CACHED_CHATS = 20;
export const MAX_CACHE_BYTES = 2_000_000;
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60_000;

/**
 * Keeps what is worth reading offline: successful queries under the persisted roots, only
 * the newest MAX_CACHED_CHATS conversations, and none of a conversation's answers still
 * being written. Exported for tests.
 */
export function trimForDisk(state: DehydratedState): DehydratedState {
  const keep = state.queries.filter((q) => q.state.status === "success" && PERSISTED_ROOTS.has(String(q.queryKey[0])));
  const chats = keep.filter((q) => q.queryKey[0] === "chat").sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  const allowed = new Set(chats.slice(0, MAX_CACHED_CHATS));
  return {
    mutations: [],
    queries: keep.filter((q) => q.queryKey[0] !== "chat" || allowed.has(q)),
  };
}

/** Serialises, dropping the oldest conversations until the blob fits MAX_CACHE_BYTES. */
export function serializeCache(client: { clientState: DehydratedState; timestamp: number; buster: string }): string {
  let state = trimForDisk(client.clientState);
  let out = JSON.stringify({ ...client, clientState: state });
  while (out.length > MAX_CACHE_BYTES) {
    const chats = state.queries.filter((q) => q.queryKey[0] === "chat").sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
    if (!chats.length)
      return JSON.stringify({
        ...client,
        clientState: { mutations: [], queries: [] },
      });
    const drop = chats[0];
    state = { ...state, queries: state.queries.filter((q) => q !== drop) };
    out = JSON.stringify({ ...client, clientState: state });
  }
  return out;
}

export const persister = createSyncStoragePersister({
  key: PREF.queryCache,
  throttleTime: 2000,
  serialize: serializeCache as never,
  storage: {
    getItem: (k) => prefs.getString(k) ?? null,
    setItem: (k, v) => prefs.setString(k, v),
    removeItem: (k) => prefs.remove(k),
  },
});

export function clearPersistedCache(): void {
  prefs.remove(PREF.queryCache);
}
