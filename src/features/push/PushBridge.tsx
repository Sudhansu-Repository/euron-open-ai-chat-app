/**
 * Mount once inside NavigationContainer while signed in (app/Navigator.tsx). It:
 *
 *   binds the turn runner to the signed-in client and cache;
 *   hands live answers to the server when the app goes to the background (arming a push
 *   when this device can receive one) and follows them again on return;
 *   registers this device's FCM token after sign-in when permission was already given
 *   (it never asks here), and again whenever the token rotates;
 *   opens the conversation when a notification is tapped, from the background or from a
 *   cold start; a notification arriving in the foreground becomes a short toast.
 */
import { getInitialNotification, onMessage, onNotificationOpenedApp, onTokenRefresh } from "@react-native-firebase/messaging";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFeatures } from "../../app/meta";
import { navigationRef, openConversation } from "../../app/navigation-ref";
import { useSession } from "../../app/session";
import {
  canReceivePush,
  conversationOf,
  forgetThisDevice,
  getPushMessaging,
  pushDecision,
  readPushPermission,
  registerPushToken,
  registerThisDevice,
} from "../../lib/push";
import { PREF, prefs } from "../../lib/storage";
import { toast } from "../../ui/components/Toast";
import { bindTurnRunner, handOffToBackground, resumeDetached } from "../chat/turn-runner";
import { pushOffer } from "./offer";

function openWhenReady(conversationId: string | null, tries = 0) {
  if (!conversationId) return;
  if (navigationRef.isReady() && openConversation(conversationId)) return;
  if (tries < 50) setTimeout(() => openWhenReady(conversationId, tries + 1), 100);
}

export function PushBridge() {
  const { api, me, status } = useSession();
  const qc = useQueryClient();
  const features = useFeatures();
  const pushOn = features.push;
  const pushRef = useRef(pushOn);
  pushRef.current = pushOn;
  const messaging = getPushMessaging();
  const registeredFor = useRef<string | null>(null);

  // The turn runner and the background hand-off.
  useEffect(() => {
    const unbind = bindTurnRunner(api, qc, {
      onSlowAnswer: (ms) => pushOffer.answered(ms, pushRef.current && !!getPushMessaging() && !prefs.getString(PREF.pushToken)),
    });
    let last = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      // Only a real background counts: iOS goes "inactive" for Control Center or an incoming call.
      if (next === "background" && last !== "background") handOffToBackground(canReceivePush(pushRef.current));
      if (next === "active" && last === "background") resumeDetached();
      last = next;
    });
    return () => {
      sub.remove();
      unbind();
    };
  }, [api, qc]);

  // Register silently when permission is already granted (a returning user, a new sign-in).
  useEffect(() => {
    if (status !== "signedIn" || !me || !messaging || registeredFor.current === me.id) return;
    let alive = true;
    (async () => {
      const permission = await readPushPermission(messaging);
      const decision = pushDecision({
        pushEnabled: pushOn,
        hasFirebase: true,
        signedIn: true,
        permission,
        offered: !!prefs.getString(PREF.pushOffered),
      });
      if (decision !== "register") return;
      await registerThisDevice(api, messaging);
      if (alive) registeredFor.current = me.id;
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [status, me, api, messaging, pushOn]);

  // Server switched push off: forget the token so nothing is armed.
  useEffect(() => {
    if (!pushOn && prefs.getString(PREF.pushToken)) forgetThisDevice(messaging);
  }, [pushOn, messaging]);

  // Token rotation and foreground messages.
  useEffect(() => {
    if (!messaging || !pushOn) return;
    const offRefresh = onTokenRefresh(messaging, (token) => {
      if (prefs.getString(PREF.pushToken)) registerPushToken(api, token).catch(() => undefined);
    });
    const offMessage = onMessage(messaging, (m) => {
      if (conversationOf(m)) toast(m.notification?.body ?? "Your answer is ready.");
    });
    return () => {
      offRefresh();
      offMessage();
    };
  }, [messaging, pushOn, api]);

  // Taps: from the background, and the one that cold-started the app.
  useEffect(() => {
    if (!messaging) return;
    const off = onNotificationOpenedApp(messaging, (m) => openWhenReady(conversationOf(m)));
    getInitialNotification(messaging)
      .then((m) => openWhenReady(conversationOf(m)))
      .catch(() => undefined);
    return off;
  }, [messaging]);

  return null;
}
