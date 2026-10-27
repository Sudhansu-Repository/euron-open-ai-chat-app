/**
 * Identity: avatars with initials when there is no photo.
 */
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";
import { Text } from "./Text";

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

export function Avatar({ uri, name, size = 36 }: { uri?: string | null; name?: string | null; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (uri && !failed)
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.muted,
        }}
        accessibilityLabel={name ?? undefined}
      />
    );
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
        },
      ]}
      accessibilityLabel={name ?? undefined}
    >
      <Text
        style={{
          fontFamily: fonts.body.bold,
          fontSize: size * 0.38,
          color: colors.primarySoftForeground,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
});
