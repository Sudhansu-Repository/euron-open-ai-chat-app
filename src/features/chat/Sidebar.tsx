/**
 * The drawer: new chat, search, projects and images at the top, then pinned chats and the
 * rest grouped by date (Today, Yesterday, Previous 7 days, ...), with the account at the
 * bottom. Rows are type on the ground, the open chat marked with a soft tint; no boxes.
 */
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { FolderOpen, Images, Search, Settings as SettingsIcon, SquarePen } from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ConversationSummary } from "../../api/vendor/types";
import { useFeatures } from "../../app/meta";
import type { RootParams } from "../../app/routes";
import { useSession } from "../../app/session";
import { Avatar } from "../../ui/components/Media";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space } from "../../ui/theme/tokens";
import { groupByDate, useConversations, usePinned, useUsage } from "./queries";

function NavRow({ icon, label, onPress, testID }: { icon: React.ReactNode; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.6 }]}
    >
      {icon}
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}

export function Sidebar({ navigation, state }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const root = useNavigation<NavigationProp<RootParams>>();
  const { me } = useSession();
  const features = useFeatures();
  const list = useConversations();
  const pinned = usePinned();
  const usage = useUsage();
  const currentId = (state.routes[state.index]?.params as { id?: string } | undefined)?.id;

  const sections = useMemo(() => {
    const items = (list.data?.pages ?? []).flatMap((p) => p.items).filter((c) => !c.pinned);
    const out: { title: string; data: ConversationSummary[] }[] = [];
    if (pinned.data?.length) out.push({ title: "Pinned", data: pinned.data });
    for (const g of groupByDate(items)) out.push({ title: g.label, data: g.items });
    return out;
  }, [list.data, pinned.data]);

  const open = (id?: string) => {
    navigation.navigate("Chat", { id, nonce: id ? undefined : Date.now() });
    navigation.closeDrawer();
  };
  const go = (name: "Search" | "Projects" | "Images" | "Settings") => {
    navigation.closeDrawer();
    root.navigate(name);
  };

  const tokens = usage.data?.tokens;
  const left = tokens?.limit ? Math.max(0, 1 - tokens.used / tokens.limit) : null;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + space[2] }]} testID="sidebar">
      <View style={styles.top}>
        <NavRow icon={<SquarePen size={20} color={colors.foreground} />} label="New chat" onPress={() => open()} testID="sidebar-new" />
        <NavRow icon={<Search size={20} color={colors.foreground} />} label="Search chats" onPress={() => go("Search")} testID="sidebar-search" />
        {features.projects ? (
          <NavRow icon={<FolderOpen size={20} color={colors.foreground} />} label="Projects" onPress={() => go("Projects")} testID="sidebar-projects" />
        ) : null}
        {features.imageGeneration ? (
          <NavRow icon={<Images size={20} color={colors.foreground} />} label="Images" onPress={() => go("Images")} testID="sidebar-images" />
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        style={styles.fill}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text variant="caption" tone="subtle" style={styles.group}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const active = item.id === currentId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => open(item.id)}
              style={({ pressed }) => [styles.chatRow, active && { backgroundColor: colors.primarySoft }, pressed && !active && { backgroundColor: colors.muted }]}
              testID="sidebar-chat"
            >
              <Text variant="body" numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: space[4] }} color={colors.mutedForeground} /> : undefined}
        ListEmptyComponent={
          !list.isPending ? (
            <Text variant="small" tone="muted" style={styles.group}>
              Your chats will show up here.
            </Text>
          ) : undefined
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => go("Settings")}
        style={[
          styles.account,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + space[3],
          },
        ]}
        testID="sidebar-settings"
      >
        <Avatar name={me?.displayName} uri={me?.avatarUrl ?? null} size={32} />
        <View style={styles.fill}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {me?.displayName ?? ""}
          </Text>
          {left !== null ? <Text variant="caption" tone="muted">{`${Math.round(left * 100)}% of today's allowance left`}</Text> : null}
        </View>
        <SettingsIcon size={19} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: space[2], paddingBottom: space[2] },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[3],
    height: 44,
  },
  list: { paddingHorizontal: space[2], paddingBottom: space[4] },
  group: {
    paddingHorizontal: space[3],
    paddingTop: space[4],
    paddingBottom: space[1],
  },
  chatRow: {
    paddingHorizontal: space[3],
    height: 40,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
