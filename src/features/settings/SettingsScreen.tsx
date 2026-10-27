/** Settings: who you are, then grouped rows on hairlines, then sign out. */
import { useNavigation } from "@react-navigation/native";
import { Alert, View } from "react-native";
import { useFeatures, useMeta } from "../../app/meta";
import { useSession } from "../../app/session";
import { Button } from "../../ui/components/Button";
import { Row } from "../../ui/components/Layout";
import { Avatar } from "../../ui/components/Media";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";
import { useUsage } from "../chat/queries";
import { GroupLabel, Page } from "./components";
import { signOutDevice } from "./lib/signout";
import { u } from "./styles";

const MODE_WORD = { system: "System", light: "Light", dark: "Dark" } as const;

/** "12,400 of 50,000 tokens today" or "No daily limit". Exported for tests. */
export function allowanceText(used: number, limit: number | null, unit: string): string {
  return limit === null ? `No daily ${unit} limit` : `${used.toLocaleString()} of ${limit.toLocaleString()} ${unit} today`;
}

export function SettingsScreen() {
  const session = useSession();
  const { me, server } = session;
  const meta = useMeta().data;
  const features = useFeatures();
  const usage = useUsage().data;
  const { mode } = useTheme();
  const navigation = useNavigation();
  if (!me) return null;

  const confirmSignOut = (everywhere: boolean) =>
    Alert.alert(
      everywhere ? "Sign out of all devices?" : "Sign out?",
      everywhere ? "Every device, including this one, is signed out." : "Chats saved on this phone for offline reading are removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: everywhere ? "Sign out everywhere" : "Sign out",
          style: "destructive",
          onPress: () => {
            signOutDevice(session, { everywhere });
          },
        },
      ]
    );

  return (
    <Page title="Settings" testID="settings-screen">
      <View style={[u.rowCenter, { gap: space[4], marginTop: space[6] }]}>
        <Avatar uri={me.avatarUrl} name={me.displayName} size={56} />
        <View style={u.flex}>
          <Text variant="heading" numberOfLines={1}>
            {me.displayName}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {me.email}
          </Text>
        </View>
      </View>
      {usage ? (
        <View style={{ marginTop: space[4] }}>
          <Text variant="small" tone="muted">
            {allowanceText(usage.tokens.used, usage.tokens.limit, "tokens")}
          </Text>
          {features.imageGeneration ? (
            <Text variant="small" tone="muted">
              {allowanceText(usage.images.used, usage.images.limit, "images")}
            </Text>
          ) : null}
        </View>
      ) : null}

      <GroupLabel>Assistant</GroupLabel>
      <Row
        label="Personalization"
        detail="Custom instructions, answer style, default model"
        onPress={() => navigation.navigate("Personalization")}
        testID="settings-personalization"
      />
      {features.memory ? <Row label="Memory" onPress={() => navigation.navigate("Memories")} testID="settings-memory" /> : null}
      {features.sharing ? <Row label="Shared links" onPress={() => navigation.navigate("SharedLinks")} testID="settings-shares" /> : null}
      {features.push ? <Row label="Notifications" onPress={() => navigation.navigate("Notifications")} testID="settings-notifications" /> : null}
      <Row label="Appearance" value={MODE_WORD[mode]} onPress={() => navigation.navigate("Appearance")} testID="settings-appearance" last />

      <GroupLabel>Account</GroupLabel>
      <Row label="Profile" onPress={() => navigation.navigate("Profile")} testID="settings-profile-row" />
      <Row label="Security" detail="Password and two-step verification" onPress={() => navigation.navigate("Security")} testID="settings-security" />
      <Row label="Devices" onPress={() => navigation.navigate("Sessions")} testID="settings-sessions" />
      <Row label="Your data" detail="Download it, or delete the account" onPress={() => navigation.navigate("Privacy")} testID="settings-privacy" last />

      <GroupLabel>About</GroupLabel>
      <Row label="About" value={meta?.appName} onPress={() => navigation.navigate("About")} testID="settings-about" last />
      <Text variant="caption" tone="subtle" style={{ marginTop: space[2] }} numberOfLines={1}>
        {server.replace(/^https?:\/\//, "").replace(/\/api$/, "")}
      </Text>

      <View style={{ gap: space[2], marginTop: space[8] }}>
        <Button label="Sign out" variant="outline" block onPress={() => confirmSignOut(false)} testID="settings-sign-out" />
        <Button label="Sign out of all devices" variant="ghost" block onPress={() => confirmSignOut(true)} testID="settings-sign-out-all" />
      </View>
    </Page>
  );
}
