/** One quiet line above the composer: "Get told when long answers are ready?" with Turn on / Not now. */
import { BellRing } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useApi } from "../../app/session";
import { askPushPermission, getPushMessaging, registerThisDevice } from "../../lib/push";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";
import { pushOffer, usePushOfferVisible } from "./offer";

export function PushOffer() {
  const { colors } = useTheme();
  const api = useApi();
  const visible = usePushOfferVisible();
  if (!visible) return null;

  async function turnOn() {
    pushOffer.close();
    const m = getPushMessaging();
    if ((await askPushPermission(m)) !== "granted" || !m) {
      toast("Notifications stay off. You can turn them on in Settings.");
      return;
    }
    try {
      await registerThisDevice(api, m);
      toast("You will be told when answers are ready.");
    } catch {
      toast("Notifications could not be set up. Try again in Settings.");
    }
  }

  return (
    <View style={[styles.row, { borderTopColor: colors.border }]} testID="push-offer" accessibilityLiveRegion="polite">
      <BellRing size={16} color={colors.mutedForeground} />
      <Text variant="small" tone="muted" style={styles.flex}>
        Leave while an answer is written and get told when it is ready?
      </Text>
      <Pressable accessibilityRole="button" onPress={() => pushOffer.close()} hitSlop={8} testID="push-offer-no">
        <Text variant="smallStrong" tone="muted">
          Not now
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          turnOn();
        }}
        hitSlop={8}
        testID="push-offer-yes"
      >
        <Text variant="smallStrong" tone="link">
          Turn on
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
