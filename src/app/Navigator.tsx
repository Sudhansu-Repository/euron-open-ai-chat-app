/**
 * Navigation. Signed out: the auth stack, Welcome first. Signed in: a drawer whose content
 * is the sidebar (new chat, search, projects, images, the chat list) around the chat
 * screen, with every other screen pushed over it.
 *
 * Started offline with a stored session ("offline"), the signed-in tree opens anyway on
 * the cached chats (app/query.ts) and the session is retried as soon as the network is
 * back.
 */
import NetInfo from "@react-native-community/netinfo";
import { createDrawerNavigator, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import * as Auth from "../features/auth/AuthScreens";
import { ChatScreen } from "../features/chat/ChatScreen";
import { SearchScreen } from "../features/chat/SearchScreen";
import { Sidebar } from "../features/chat/Sidebar";
import { ImagesScreen, ImageViewerScreen } from "../features/images";
import { ProjectScreen, ProjectsScreen } from "../features/projects";
import { PushBridge } from "../features/push/PushBridge";
import * as Settings from "../features/settings";
import { Spinner } from "../ui/components/Feedback";
import { useTheme } from "../ui/theme/ThemeProvider";
import { linking, signedOutLinking } from "./linking";
import { navigationRef } from "./navigation-ref";
import type { DrawerParams, RootParams } from "./routes";
import { useSession } from "./session";
import { UpdateGate } from "./UpdateGate";

const Stack = createNativeStackNavigator<RootParams>();
const Drawer = createDrawerNavigator<DrawerParams>();

const renderSidebar = (p: DrawerContentComponentProps) => <Sidebar {...p} />;

function Main() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <Drawer.Navigator
      drawerContent={renderSidebar}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        swipeEdgeWidth: 48,
        overlayColor: colors.overlay,
        drawerStyle: {
          width: Math.min(340, width * 0.84),
          backgroundColor: colors.ground2,
        },
      }}
    >
      <Drawer.Screen name="Chat" component={ChatScreen} />
    </Drawer.Navigator>
  );
}

/**
 * Offline at launch: retry the stored session when the network comes back. Only a change
 * from disconnected to connected counts: NetInfo calls the listener at once with the
 * current state, and retrying on that would loop when the device is online but the server
 * is not answering.
 */
function useRetryWhenOnline() {
  const { status, retry } = useSession();
  useEffect(() => {
    if (status !== "offline") return;
    let wasConnected: boolean | null = null;
    return NetInfo.addEventListener((s) => {
      const connected = !!s.isConnected && s.isInternetReachable !== false;
      if (wasConnected === false && connected) retry();
      wasConnected = connected;
    });
  }, [status, retry]);
}

export function Navigator() {
  const { colors, scheme } = useTheme();
  const { status } = useSession();
  useRetryWhenOnline();
  const navTheme = useMemo<Theme>(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.background,
        text: colors.foreground,
        border: colors.border,
        primary: colors.primary,
        notification: colors.danger,
      },
    };
  }, [colors, scheme]);

  if (status === "booting") {
    return (
      <View style={[styles.boot, { backgroundColor: colors.background }]}>
        <Spinner />
      </View>
    );
  }
  const signedIn = status === "signedIn" || status === "offline";

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={signedIn ? linking : signedOutLinking}>
      <UpdateGate>
        {signedIn ? <PushBridge /> : null}
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {signedIn ? (
            <>
              <Stack.Screen name="Main" component={Main} />
              <Stack.Screen name="Search" component={SearchScreen} options={{ animation: "fade" }} />
              <Stack.Screen name="Projects" component={ProjectsScreen} />
              <Stack.Screen name="Project" component={ProjectScreen} />
              <Stack.Screen name="Images" component={ImagesScreen} />
              <Stack.Screen name="ImageViewer" component={ImageViewerScreen} options={{ presentation: "fullScreenModal", animation: "fade" }} />
              <Stack.Screen name="Settings" component={Settings.SettingsScreen} />
              <Stack.Screen name="Personalization" component={Settings.PersonalizationScreen} />
              <Stack.Screen name="Memories" component={Settings.MemoriesScreen} />
              <Stack.Screen name="SharedLinks" component={Settings.SharedLinksScreen} />
              <Stack.Screen name="Profile" component={Settings.ProfileScreen} />
              <Stack.Screen name="Security" component={Settings.SecurityScreen} />
              <Stack.Screen name="Sessions" component={Settings.SessionsScreen} />
              <Stack.Screen name="Notifications" component={Settings.NotificationsScreen} />
              <Stack.Screen name="Appearance" component={Settings.AppearanceScreen} />
              <Stack.Screen name="Privacy" component={Settings.PrivacyScreen} />
              <Stack.Screen name="About" component={Settings.AboutScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Welcome" component={Auth.WelcomeScreen} />
              <Stack.Screen name="Server" component={Auth.ServerScreen} />
              <Stack.Screen name="SignIn" component={Auth.SignInScreen} />
              <Stack.Screen name="SignUp" component={Auth.SignUpScreen} />
              <Stack.Screen name="CheckEmail" component={Auth.CheckEmailScreen} />
              <Stack.Screen name="ForgotPassword" component={Auth.ForgotPasswordScreen} />
              <Stack.Screen name="VerifyEmail" component={Auth.VerifyEmailScreen} />
            </>
          )}
        </Stack.Navigator>
      </UpdateGate>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
});
