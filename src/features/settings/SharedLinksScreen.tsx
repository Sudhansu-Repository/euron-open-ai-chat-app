/** Shared links: every frozen copy you shared, with its views; share again, or revoke so the link stops working. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { qk } from "../../app/query";
import { useApi } from "../../app/session";
import { EmptyState, ErrorState } from "../../ui/components/Feedback";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";
import { ListSkeleton, Page } from "./components";

export function SharedLinksScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: qk.shares,
    queryFn: () => api.shares.list(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.shares.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shares });
    },
    onError: () => toast("The link could not be revoked."),
  });
  const live = (list.data ?? []).filter((s) => !s.revoked);

  return (
    <Page title="Shared links" testID="settings-shares-screen">
      <Text variant="small" tone="muted" style={{ marginTop: space[6], marginBottom: space[2] }}>
        A shared link shows the chat as it was when you shared it. Revoking it makes the link stop working.
      </Text>
      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState
          message="Links could not be loaded."
          onRetry={() => {
            list.refetch();
          }}
        />
      ) : !live.length ? (
        <EmptyState title="No shared links" body="Share a chat from its menu at the top of the chat." />
      ) : (
        live.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.row,
              i < live.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
            testID="share-row"
          >
            <Text variant="bodyStrong" numberOfLines={1}>
              {s.title}
            </Text>
            <Text variant="caption" tone="muted">{`${s.viewCount === 1 ? "1 view" : `${s.viewCount} views`} · shared ${new Date(s.createdAt).toLocaleDateString()}${
              s.expiresAt ? ` · until ${new Date(s.expiresAt).toLocaleDateString()}` : ""
            }`}</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  Share.share({ message: s.url, url: s.url });
                }}
                hitSlop={8}
              >
                <Text variant="smallStrong" tone="link">
                  Share
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert("Revoke this link?", "Anyone who has it can no longer open it.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Revoke",
                      style: "destructive",
                      onPress: () => revoke.mutate(s.id),
                    },
                  ])
                }
                hitSlop={8}
                testID="share-revoke"
              >
                <Text variant="smallStrong" tone="danger">
                  Revoke
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space[3], gap: 2 },
  actions: { flexDirection: "row", gap: space[5], marginTop: space[1] },
});
