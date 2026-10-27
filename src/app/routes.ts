/**
 * Every screen and its params, in one place. Screens navigate with these names only, so a
 * renamed route fails the typecheck instead of a tap.
 *
 * Signed out: the auth stack (Welcome first). Signed in: the drawer (the chat, with the
 * sidebar as its drawer) plus screens pushed over it.
 */
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DrawerScreenProps } from "@react-navigation/drawer";

export type DrawerParams = {
  /** No id: a new chat (optionally inside a project). */
  Chat: { id?: string; projectId?: string; nonce?: number } | undefined;
};

export type RootParams = {
  // Signed out
  Welcome: undefined;
  Server: undefined;
  SignIn: undefined;
  SignUp: undefined;
  CheckEmail: { email: string };
  ForgotPassword: undefined;
  VerifyEmail: { token: string };
  // Signed in
  Main: NavigatorScreenParams<DrawerParams> | undefined;
  Search: undefined;
  Projects: undefined;
  Project: { id: string };
  Images: undefined;
  ImageViewer: {
    fileId: string;
    url: string;
    prompt?: string | null;
    width?: number | null;
    height?: number | null;
  };
  Settings: undefined;
  Personalization: undefined;
  Memories: undefined;
  SharedLinks: undefined;
  Profile: undefined;
  Security: undefined;
  Sessions: undefined;
  Notifications: undefined;
  Appearance: undefined;
  Privacy: undefined;
  About: undefined;
};

export type RootScreen<K extends keyof RootParams> = NativeStackScreenProps<RootParams, K>;
export type ChatScreenProps = DrawerScreenProps<DrawerParams, "Chat">;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootParams {}
  }
}
