/**
 * Euron Open AI Chat App: the iOS and Android client for a Euron Open AI Chat server
 * (run euron-open-ai-chat first). Providers, outermost first: gestures, safe area,
 * keyboard, theme, server state (persisted for offline reading), session, navigation.
 */
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useState } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Navigator } from "./src/app/Navigator";
import { CACHE_MAX_AGE, createQueryClient, persister, wireQueryLifecycle } from "./src/app/query";
import { SessionProvider } from "./src/app/session";
import { ThemeProvider, useTheme } from "./src/ui/theme/ThemeProvider";

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />;
}

export default function App() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => wireQueryLifecycle(), []);
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <ThemedStatusBar />
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister,
                maxAge: CACHE_MAX_AGE,
                buster: "v1",
              }}
            >
              <SessionProvider>
                <Navigator />
              </SessionProvider>
            </PersistQueryClientProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
