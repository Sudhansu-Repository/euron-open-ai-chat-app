/**
 * A fenced code block: the language and a copy button on a hairline above, the code in
 * the monospace face, highlighted, scrolling sideways instead of wrapping (code that wraps
 * is hard to read and wrong to copy). Not a card: a quiet ground, no border box.
 */
import Clipboard from "@react-native-clipboard/clipboard";
import { Check, Copy } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { Text } from "../../../ui/components/Text";
import { useTheme } from "../../../ui/theme/ThemeProvider";
import { fonts, radius, space } from "../../../ui/theme/tokens";
import { highlight, scopeColor } from "./highlight";

export const CodeBlock = memo(function CodeBlockImpl({ code, lang }: { code: string; lang: string | null }) {
  const { colors, scheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <View style={[styles.wrap, { backgroundColor: colors.muted }]} testID="code-block">
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        <Text variant="caption" tone="muted">
          {lang || "code"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : "Copy code"}
          hitSlop={10}
          onPress={() => {
            Clipboard.setString(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={styles.copy}
        >
          {copied ? <Check size={14} color={colors.mutedForeground} /> : <Copy size={14} color={colors.mutedForeground} />}
          <Text variant="caption" tone="muted">
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <RNText selectable style={[styles.code, { color: colors.foreground }]}>
          {tokens.map((t, i) => (
            <RNText key={i} style={t.scope ? { color: scopeColor(t.scope, scheme === "dark") } : undefined}>
              {t.text}
            </RNText>
          ))}
        </RNText>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    marginVertical: space[2],
    overflow: "hidden",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: { flexDirection: "row", alignItems: "center", gap: 4 },
  scroll: { padding: space[3] },
  code: { fontFamily: fonts.mono, fontSize: 13.5, lineHeight: 20 },
});
