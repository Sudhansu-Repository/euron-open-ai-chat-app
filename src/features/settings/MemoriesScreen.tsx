/**
 * Memory: the facts the assistant keeps across chats, newest first, each deletable; add
 * one yourself, or clear them all. Whether new ones are saved is the switch in
 * Personalization.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { isApiError } from "../../api/vendor/client/errors";
import { qk } from "../../app/query";
import { useApi } from "../../app/session";
import { Button, IconButton } from "../../ui/components/Button";
import { EmptyState, ErrorState } from "../../ui/components/Feedback";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";
import { ListSkeleton, Page } from "./components";

export function MemoriesScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: qk.memories,
    queryFn: () => api.memories.list(),
  });
  const [draft, setDraft] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.memories });
  };
  const add = useMutation({
    mutationFn: (c: string) => api.memories.add(c),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
    onError: (e) => toast(isApiError(e) ? e.message : "That was not saved."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.memories.remove(id),
    onSuccess: refresh,
    onError: () => toast("It could not be deleted."),
  });
  const clear = () =>
    Alert.alert("Clear all memories?", "The assistant forgets everything it saved about you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () =>
          api.memories
            .clear()
            .then(refresh)
            .catch(() => toast("They could not be cleared.")),
      },
    ]);

  return (
    <Page title="Memory" testID="settings-memory-screen">
      <Text variant="small" tone="muted" style={{ marginTop: space[6] }}>
        The assistant uses these in every chat. It saves new ones when you ask it to remember something.
      </Text>
      <View style={[styles.addRow, { borderColor: colors.input }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add something to remember"
          placeholderTextColor={colors.subtleForeground}
          maxLength={500}
          style={[styles.input, { color: colors.foreground }]}
          testID="memory-input"
        />
        <Button label="Add" size="sm" disabled={!draft.trim()} loading={add.isPending} onPress={() => add.mutate(draft.trim())} testID="memory-add" />
      </View>
      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState
          message="Memories could not be loaded."
          onRetry={() => {
            list.refetch();
          }}
        />
      ) : !list.data.length ? (
        <EmptyState title="Nothing remembered yet" body='Say "remember that I prefer short answers" in any chat.' />
      ) : (
        <>
          {list.data.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.row,
                i < list.data.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              testID="memory-row"
            >
              <View style={styles.flex}>
                <Text variant="body">{m.content}</Text>
                <Text variant="caption" tone="subtle">
                  {m.source === "ASSISTANT" ? "Saved by the assistant" : "Added by you"}
                </Text>
              </View>
              <IconButton label="Delete" onPress={() => remove.mutate(m.id)} icon={<Trash2 size={17} color={colors.mutedForeground} />} />
            </View>
          ))}
          <Button label="Clear all memories" variant="ghost" onPress={clear} style={styles.clear} testID="memory-clear" />
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  clear: { marginTop: space[6], alignSelf: "flex-start" },
  flex: { flex: 1 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingLeft: space[3],
    paddingRight: space[2],
    marginVertical: space[4],
  },
  input: { ...type.body, flex: 1, height: 46 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[3],
  },
});
