/** The sources an answer cites: number, title, domain, snippet; tap to open in the in-app browser. */
import { Pressable, StyleSheet, View } from "react-native";
import type { Source } from "../../api/vendor/types";
import { Sheet } from "../../ui/components/Sheet";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";
import { openLink } from "./markdown/Markdown";

export function SourcesSheet({ sources, highlight, onClose }: { sources: Source[] | null; highlight?: number | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={!!sources} title="Sources" onClose={onClose} testID="sources-sheet">
      {(sources ?? []).map((s, i, all) => (
        <Pressable
          key={s.n}
          accessibilityRole="link"
          accessibilityLabel={`${s.n}. ${s.title}, ${s.domain}`}
          onPress={() => {
            openLink(s.url);
          }}
          style={({ pressed }) => [
            styles.row,
            i < all.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
            s.n === highlight && { backgroundColor: colors.primarySoft },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text variant="smallStrong" tone="muted" style={styles.n}>
            {s.n}
          </Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {s.title}
            </Text>
            <Text variant="small" tone="link">
              {s.domain}
            </Text>
            {s.snippet ? (
              <Text variant="small" tone="muted" numberOfLines={3} style={styles.mt2}>
                {s.snippet}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  mt2: { marginTop: 2 },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[1],
  },
  n: { width: 18, paddingTop: 2 },
});
