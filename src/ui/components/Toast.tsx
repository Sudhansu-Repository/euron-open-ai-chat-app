/**
 * One short message at the bottom of the screen, gone after a few seconds: "Copied",
 * "Saved to Photos", a failure that needs no decision. `toast()` works from anywhere;
 * <ToastHost /> renders it once near the root. Announced to screen readers.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space } from "../theme/tokens";
import { Text } from "./Text";

type Listener = (text: string) => void;
const listeners = new Set<Listener>();

export function toast(text: string): void {
  for (const l of listeners) l(text);
  AccessibilityInfo.announceForAccessibility(text);
}

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const l: Listener = (t) => {
      setText(t);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start();
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () =>
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setText(null)),
        2600
      );
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      if (timer) clearTimeout(timer);
    };
  }, [opacity]);

  if (!text) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96, opacity, backgroundColor: colors.ink }]} testID="toast">
      <Text variant="smallStrong" style={{ color: colors.inkForeground }}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    maxWidth: "88%",
  },
});
