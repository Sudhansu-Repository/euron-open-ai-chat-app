/** A navigation handle for code outside screens (push notification taps). */
import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootParams } from "./routes";

export const navigationRef = createNavigationContainerRef<RootParams>();

/** Opens a conversation from anywhere; false while navigation is not ready yet. */
export function openConversation(id: string): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate("Main", { screen: "Chat", params: { id } });
  return true;
}
