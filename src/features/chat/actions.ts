/** Conversation mutations with the cache updates they need. Callers navigate themselves. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConversationDetail, Message } from "../../api/vendor/types";
import { qk } from "../../app/query";
import { useApi } from "../../app/session";
import { toast } from "../../ui/components/Toast";

export function useChatActions() {
  const api = useApi();
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: qk.chatsAll });
    if (id) qc.invalidateQueries({ queryKey: qk.chat(id) });
  };

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; pinned?: boolean; archived?: boolean; projectId?: string | null }) => api.chats.update(id, body),
    onMutate: ({ id, title }) => {
      if (title) qc.setQueryData<ConversationDetail>(qk.chat(id), (d) => (d ? { ...d, title } : d));
    },
    onSuccess: (_r, v) => {
      refresh(v.id);
      if (v.projectId !== undefined) qc.invalidateQueries({ queryKey: qk.projects });
      if (v.archived) toast("Chat archived");
    },
    onError: () => toast("That did not save. Try again."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.chats.remove(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: qk.chat(id) });
      refresh();
      qc.invalidateQueries({ queryKey: qk.projects });
    },
    onError: () => toast("The chat could not be deleted. Try again."),
  });

  /** Show another branch: the server moves the conversation's leaf and returns the new path. */
  const switchBranch = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) => api.chats.setLeaf(conversationId, messageId),
    onSuccess: (detail) => qc.setQueryData(qk.chat(detail.id), detail),
    onError: () => toast("That version could not be opened."),
  });

  const feedback = useMutation({
    mutationFn: ({ message, value }: { message: Message; value: 1 | -1 | null }) => api.messages.feedback(message.id, value),
    onMutate: ({ message, value }) => {
      qc.setQueryData<ConversationDetail>(qk.chat(message.conversationId), (d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) => (m.id === message.id ? { ...m, feedback: value } : m)),
            }
          : d
      );
    },
    onError: (_e, { message }) => {
      qc.invalidateQueries({ queryKey: qk.chat(message.conversationId) });
    },
  });

  return { update, remove, switchBranch, feedback };
}
