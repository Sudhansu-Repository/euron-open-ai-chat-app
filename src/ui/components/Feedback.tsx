/**
 * Loading, empty and error states, and the small progress primitives used across the
 * catalog, My Learning and the classroom.
 */
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, space } from "../theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

export function Spinner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.spinner, style]}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

/** A shimmer-free skeleton block: a calm pulse, honouring reduced motion through the native driver. */
export function Skeleton({
  width = "100%",
  height = 14,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: colors.muted,
          opacity: v,
        },
        style,
      ]}
    />
  );
}

export function EmptyState({ title, body, action, testID }: { title: string; body?: string; action?: { label: string; onPress: () => void }; testID?: string }) {
  return (
    <View style={styles.empty} testID={testID}>
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" center style={{ marginTop: space[2] }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} variant="outline" onPress={action.onPress} style={{ marginTop: space[5] }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      body={message ?? "Check your connection and try again."}
      action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}
      testID="error-state"
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: space[12],
    paddingHorizontal: space[6],
    alignItems: "center",
  },
  spinner: { padding: space[8], alignItems: "center" },
});
