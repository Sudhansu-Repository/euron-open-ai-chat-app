/** Search chats by title (GET /api/chats?q=), newest first, as you type. */
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootScreen } from "../../app/routes";
import { IconButton } from "../../ui/components/Button";
import { Text } from "../../ui/components/Text";
import { useDebounced } from "../../lib/useDebounced";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";
import { useConversations } from "./queries";

export function SearchScreen({ navigation }: RootScreen<"Search">) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const results = useConversations(term ? { q: term } : {});
  const items = (results.data?.pages ?? []).flatMap((p) => p.items);
  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]} testID="search-screen">
      <View style={styles.bar}>
        <IconButton label="Back" onPress={() => navigation.goBack()} icon={<ChevronLeft size={26} color={colors.foreground} />} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Search chats"
          placeholderTextColor={colors.subtleForeground}
          returnKeyType="search"
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
          accessibilityLabel="Search chats"
          testID="search-input"
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("Main", {
                screen: "Chat",
                params: { id: item.id },
              })
            }
            style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.muted }]}
            testID="search-result"
          >
            <Text variant="body" numberOfLines={1}>
              {item.title}
            </Text>
            <Text variant="caption" tone="muted">
              {new Date(item.lastMessageAt).toLocaleDateString()}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !results.isPending ? (
            <Text tone="muted" style={styles.empty}>
              {term ? "No chats match." : "Type to search your chats."}
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: space[4],
    paddingBottom: space[2],
  },
  input: {
    ...type.body,
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
  row: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  empty: { padding: space[5] },
});
