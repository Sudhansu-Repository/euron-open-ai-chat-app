/**
 * Notifications: one switch, "Tell me when an answer is ready". On means this device is
 * registered for push (asking the system the first time); the server only ever pushes for
 * an answer the app left while it was being written.
 */
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { useFeatures } from "../../app/meta";
import { useSession } from "../../app/session";
import { askPushPermission, forgetThisDevice, getPushMessaging, readPushPermission, registerThisDevice, unregisterThisDevice, type PushPermission } from "../../lib/push";
import { PREF, prefs } from "../../lib/storage";
import { Button } from "../../ui/components/Button";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { space } from "../../ui/theme/tokens";
import { Notice, Page, SwitchRow } from "./components";

export function NotificationsScreen() {
  const { api } = useSession();
  const features = useFeatures();
  const messaging = getPushMessaging();
  const [permission, setPermission] = useState<PushPermission>("undetermined");
  const [on, setOn] = useState(() => !!prefs.getString(PREF.pushToken));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    readPushPermission(messaging).then(setPermission);
  }, [messaging]);

  async function toggle(next: boolean) {
    if (!messaging) return;
    setBusy(true);
    try {
      if (next) {
        const p = permission === "granted" ? "granted" : await askPushPermission(messaging);
        setPermission(p);
        if (p !== "granted") return;
        await registerThisDevice(api, messaging);
        setOn(true);
      } else {
        await unregisterThisDevice(api);
        await forgetThisDevice(messaging);
        setOn(false);
      }
      prefs.setString(PREF.pushOffered, new Date().toISOString());
    } catch {
      toast("Notifications could not be changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = !messaging || !features.push;
  return (
    <Page title="Notifications" testID="settings-notifications-screen">
      <Text tone="muted" variant="small" style={{ marginTop: space[6], marginBottom: space[4] }}>
        If you leave the app while an answer is being written, it can tell you when the answer is ready. Nothing else is ever sent.
      </Text>
      <SwitchRow
        label="Tell me when an answer is ready"
        value={on && permission === "granted"}
        onChange={(v) => {
          toggle(v);
        }}
        disabled={unavailable || busy}
        testID="settings-push-switch"
        last
      />
      {unavailable ? <Notice body={!features.push ? "This server does not send notifications." : "This build of the app has no notification service set up."} /> : null}
      {!unavailable && permission === "denied" ? (
        <Notice tone="warning" body="Notifications are turned off for this app in your phone's settings.">
          <Button
            label="Open phone settings"
            variant="ghost"
            size="sm"
            onPress={() => {
              Linking.openSettings();
            }}
          />
        </Notice>
      ) : null}
    </Page>
  );
}
