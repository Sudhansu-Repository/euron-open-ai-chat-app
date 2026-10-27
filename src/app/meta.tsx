/**
 * The server's public configuration (GET /api/meta): its name, which features are on
 * (web search, images, voice, projects, sharing, push), upload limits and the oldest app
 * version it still supports. Cached between launches so the app opens with the right
 * name and switches even before the network answers.
 */
import { useQuery } from "@tanstack/react-query";
import type { AppMeta } from "../api/vendor/types";
import { PREF, prefs } from "../lib/storage";
import { qk } from "./query";
import { useApi } from "./session";

export function useMeta() {
  const api = useApi();
  return useQuery({
    queryKey: qk.meta,
    queryFn: async () => {
      const m = await api.meta.get();
      prefs.setJson(PREF.meta, m);
      return m;
    },
    initialData: () => prefs.getJson<AppMeta>(PREF.meta),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}

export type Features = AppMeta["features"];

/** Every feature off until the server says otherwise (an older server lacks newer keys). */
export function featuresOf(meta: AppMeta | undefined): Features {
  const f: Partial<Features> = meta?.features ?? {};
  return {
    webSearch: !!f.webSearch,
    imageGeneration: !!f.imageGeneration,
    dictation: !!f.dictation,
    readAloud: !!f.readAloud,
    memory: !!f.memory,
    projects: !!f.projects,
    sharing: !!f.sharing,
    push: !!f.push,
  };
}

export function useFeatures(): Features {
  return featuresOf(useMeta().data);
}

/** Compares dotted versions ("1.10.0" > "1.9.2"). Exported for tests. */
export function versionBelow(version: string, minimum: string | null | undefined): boolean {
  if (!minimum) return false;
  const a = version.split(".").map((n) => parseInt(n, 10) || 0);
  const b = minimum.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}
