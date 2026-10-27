/**
 * About: the app's version and build, the server it talks to and what that server calls
 * itself, and the open-source notices (the app is MIT licensed; the fonts are under the
 * SIL Open Font License).
 */
import { Linking } from "react-native";
import DeviceInfo from "react-native-device-info";
import { useMeta } from "../../app/meta";
import { useSession } from "../../app/session";
import { safeExternalUrl } from "../../lib/urls";
import { Row } from "../../ui/components/Layout";
import { Text } from "../../ui/components/Text";
import { space } from "../../ui/theme/tokens";
import { GroupLabel, Page } from "./components";

export const REPO_URL = "https://github.com/euron-sde-team/euron-open-ai-chat-app";
export const SERVER_REPO_URL = "https://github.com/euron-sde-team/euron-open-ai-chat";

export function hostOf(url: string): string {
  const m = url.match(/^[a-z]+:\/\/([^/?#]+)/i);
  return m ? m[1]! : url;
}

const open = (url: string) => {
  const safe = safeExternalUrl(url);
  if (safe) Linking.openURL(safe).catch(() => undefined);
};

export function AboutScreen() {
  const meta = useMeta();
  const { server } = useSession();
  return (
    <Page title="About" testID="settings-about-screen">
      <GroupLabel first>This app</GroupLabel>
      <Row label="Version" value={`${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`} testID="about-version" />
      <Row label="Server" value={hostOf(server)} testID="about-server" last />

      <GroupLabel>{meta.data?.appName ?? "This server"}</GroupLabel>
      {meta.data?.tagline ? (
        <Text tone="muted" style={{ paddingVertical: space[2] }}>
          {meta.data.tagline}
        </Text>
      ) : null}
      {meta.data?.support.email ? (
        <Row
          label="Support"
          detail={meta.data.support.email}
          onPress={() => {
            Linking.openURL(`mailto:${meta.data!.support.email}`).catch(() => undefined);
          }}
          last
        />
      ) : null}

      <GroupLabel>Open source</GroupLabel>
      <Row label="Source code" detail="This app is free software under the MIT License." onPress={() => open(REPO_URL)} testID="about-source" />
      <Row label="Server source code" detail="The server it talks to, also MIT licensed." onPress={() => open(SERVER_REPO_URL)} />
      <Row label="Fonts" detail="Bricolage Grotesque and Hanken Grotesk, under the SIL Open Font License 1.1." last />
    </Page>
  );
}
