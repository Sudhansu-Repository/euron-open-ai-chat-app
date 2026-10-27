/**
 * Deep links on the app's scheme (`openchat://` by default):
 *
 *   openchat://c/:id                a conversation (push notification taps use this)
 *   openchat://projects/:id         a project
 *   openchat://images               the image gallery
 *   openchat://settings             settings
 *   openchat://verify-email?token=  email verification, when the server's mail links here
 *                                   (signed out only: that is when the screen exists)
 */
import type { LinkingOptions } from "@react-navigation/native";
import { config } from "../config";
import type { RootParams } from "./routes";

export const prefixes = [`${config.scheme}://`];

export const linking: LinkingOptions<RootParams> = {
  prefixes,
  config: {
    screens: {
      Main: { screens: { Chat: "c/:id?" } },
      Project: "projects/:id",
      Projects: "projects",
      Images: "images",
      Settings: "settings",
      SharedLinks: "settings/shared-links",
      Memories: "settings/memories",
    },
  },
};

/** While signed out only email verification is linkable; every other link waits for sign-in. */
export const signedOutLinking: LinkingOptions<RootParams> = {
  prefixes,
  config: { screens: { VerifyEmail: "verify-email" } },
};

/** The deep link for a conversation (what a push notification opens). */
export function chatLink(conversationId: string): string {
  return `${config.scheme}://c/${encodeURIComponent(conversationId)}`;
}
