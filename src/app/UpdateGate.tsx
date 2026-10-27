/**
 * Blocks the app when the server says this version is too old (AppMeta.minSupportedVersion),
 * with a way to the store. Anything else passes straight through.
 */
import type { ReactNode } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import { Button } from "../ui/components/Button";
import { Text } from "../ui/components/Text";
import { useTheme } from "../ui/theme/ThemeProvider";
import { space } from "../ui/theme/tokens";
import { useMeta, versionBelow } from "./meta";

export function UpdateGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const meta = useMeta().data;
  if (!versionBelow(DeviceInfo.getVersion(), meta?.minSupportedVersion)) return <>{children}</>;
  const store = Platform.OS === "ios" ? `itms-apps://itunes.apple.com/app/bundleId/${DeviceInfo.getBundleId()}` : `market://details?id=${DeviceInfo.getBundleId()}`;
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]} testID="update-gate">
      <Text variant="title" center>
        Update the app
      </Text>
      <Text tone="muted" center style={{ marginTop: space[2], marginBottom: space[6] }}>
        {meta?.appName ?? "This server"} needs version {meta?.minSupportedVersion} or newer. You have {DeviceInfo.getVersion()}.
      </Text>
      <Button label="Open the store" onPress={() => Linking.openURL(store).catch(() => undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space[6],
  },
});
