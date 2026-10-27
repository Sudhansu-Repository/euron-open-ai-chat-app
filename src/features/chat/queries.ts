/** Reads for the chat screens. Writes that touch several caches live in turn-runner.ts and actions.ts. */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ConversationSummary } from "../../api/vendor/types";
import { qk } from "../../app/query";
import { useApi } from "../../app/session";

export function useModels() {
  const api = useApi();
  return useQuery({
    queryKey: qk.models,
    queryFn: ({ signal }) => api.models.catalog(signal),
    staleTime: 60_000,
  });
}

export function usePreferences() {
  const api = useApi();
  return useQuery({
    queryKey: qk.preferences,
    queryFn: () => api.me.preferences(),
    staleTime: 60_000,
  });
}

export function useUsage() {
  const api = useApi();
  return useQuery({
    queryKey: qk.usage,
    queryFn: () => api.me.usage(),
    staleTime: 15_000,
  });
}

/** The sidebar list (unpinned, newest first), paged by cursor; with `q`, a title search over every chat. */
export function useConversations(filter: { q?: string; projectId?: string } = {}) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: qk.chats({ ...filter, pinned: filter.q ? undefined : false }),
    queryFn: ({ pageParam, signal }) =>
      api.chats.list(
        {
          ...filter,
          pinned: filter.q ? undefined : false,
          cursor: pageParam,
          limit: 40,
        },
        signal
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function usePinned() {
  const api = useApi();
  return useQuery({
    queryKey: qk.chats({ pinned: true }),
    queryFn: ({ signal }) => api.chats.list({ pinned: true, limit: 50 }, signal).then((p) => p.items),
    staleTime: 15_000,
  });
}

export function useConversation(id: string | null | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: qk.chat(id ?? ""),
    queryFn: ({ signal }) => api.chats.get(id!, signal),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useProjects() {
  const api = useApi();
  return useQuery({
    queryKey: qk.projects,
    queryFn: () => api.projects.list(),
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: qk.project(id),
    queryFn: () => api.projects.get(id),
  });
}

/** Group conversations under Today, Yesterday, Previous 7 days, Previous 30 days, then months. */
export function groupByDate(items: ConversationSummary[], now = new Date()): { label: string; items: ConversationSummary[] }[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups = new Map<string, ConversationSummary[]>();
  for (const c of items) {
    const t = new Date(c.lastMessageAt).getTime();
    let label: string;
    if (t >= startOfToday) label = "Today";
    else if (t >= startOfToday - day) label = "Yesterday";
    else if (t >= startOfToday - 7 * day) label = "Previous 7 days";
    else if (t >= startOfToday - 30 * day) label = "Previous 30 days";
    else
      label = new Date(t).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    groups.set(label, [...(groups.get(label) ?? []), c]);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, items: list }));
}
