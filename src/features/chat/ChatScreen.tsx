/**
 * The chat. No id: a new chat (an empty state with a greeting and a few starter prompts),
 * optionally inside a project. With an id: the conversation's current branch, newest at
 * the bottom, the composer under it.
 *
 * The list is inverted: offset 0 is the newest message, so it stays pinned to the bottom
 * while an answer streams, and sending scrolls back there. Opening a conversation whose answer is still
 * being written (a push tap, or coming back to it) rejoins the turn (turn-runner resume).
 */
import Clipboard from "@react-native-clipboard/clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { Archive, FolderInput, Link, Menu, Pencil, Pin, PinOff, SquarePen, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { isApiError } from "../../api/vendor/client/errors";
import type { Message, Source } from "../../api/vendor/types";
import { useFeatures, useMeta } from "../../app/meta";
import { qk } from "../../app/query";
import type { ChatScreenProps } from "../../app/routes";
import { useSession } from "../../app/session";
import { Button, IconButton } from "../../ui/components/Button";
import { ErrorState, Skeleton } from "../../ui/components/Feedback";
import { Sheet } from "../../ui/components/Sheet";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";
import { PushOffer } from "../push/PushOffer";
import { toggleRead, useReading } from "../voice/readAloud";
import { useChatActions } from "./actions";
import { Composer, SheetRow, type ComposerSubmit } from "./Composer";
import { MessageView, type MessageActions } from "./MessageView";
import { ModelControl, useSelectedModel } from "./ModelPicker";
import { useConversation, usePreferences, useProjects } from "./queries";
import { SourcesSheet } from "./SourcesSheet";
import { regenerate, resume, sendMessage, stop, turnState } from "./turn-runner";

export const STARTERS = [
  {
    title: "Explain a concept",
    prompt: "Explain how vaccines train the immune system, simply.",
  },
  {
    title: "Write something",
    prompt: "Write a short, friendly note asking my team to review a document by Friday.",
  },
  {
    title: "Plan",
    prompt: "Plan a three-day trip to Lisbon with one quiet day.",
  },
  {
    title: "Code",
    prompt: "Write TypeScript code that groups an array of objects by a key.",
  },
];

function useActiveTurn(conversationId: string | undefined) {
  return useSyncExternalStore(turnState.subscribe, () => turnState.activeIn(conversationId));
}

export function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { api, server, status, me, accessToken } = useSession();
  const features = useFeatures();
  const meta = useMeta().data;
  const net = useNetInfo();
  const offline = status === "offline" || net.isConnected === false;
  const id = route.params?.id;
  const projectId = route.params?.projectId ?? null;
  const convo = useConversation(id);
  const prefsQuery = usePreferences();
  const projects = useProjects();
  const { model, models, choose } = useSelectedModel();
  const activeTurn = useActiveTurn(id);
  const actions = useChatActions();
  const reading = useReading();
  const [sources, setSources] = useState<{ list: Source[]; n?: number } | null>(null);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{
    message: Message;
    text: string;
  } | null>(null);
  const [chatMenu, setChatMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Rejoin an answer still being written when the conversation opens (or comes back into view).
  useFocusEffect(
    useCallback(() => {
      if (convo.data?.activeTurnId && !offline) resume(convo.data);
    }, [convo.data, offline])
  );
  useEffect(() => {
    if (convo.data?.activeTurnId && !offline) resume(convo.data);
  }, [convo.data, offline]);

  const messages = useMemo(() => [...(convo.data?.messages ?? [])].reverse(), [convo.data?.messages]);
  const project = (projects.data ?? []).find((p) => p.id === (convo.data?.projectId ?? projectId));
  const streaming = !!activeTurn || (convo.data?.messages.some((m) => m.status === "STREAMING") ?? false);

  const send = useCallback(
    async (input: ComposerSubmit) => {
      try {
        const convId = await sendMessage({
          conversationId: id ?? null,
          projectId: id ? undefined : projectId,
          content: input.content,
          fileIds: input.files.map((f) => f.id),
          files: input.files,
          webSearch: input.webSearch,
          mode: input.mode,
          modelId: model?.id,
        });
        if (!id) navigation.setParams({ id: convId, projectId: undefined });
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (e) {
        toast(isApiError(e) ? e.message : "The message was not sent. Try again.");
        throw e;
      }
    },
    [id, projectId, model?.id, navigation]
  );

  const messageActions = useMemo<MessageActions>(
    () => ({
      onRegenerate: (m) => {
        if (!id) return;
        regenerate(id, m, { modelId: model?.id }).catch((e) => toast(isApiError(e) ? e.message : "Could not regenerate."));
      },
      onEdit: (m) => setEditing({ message: m, text: m.content }),
      onBranch: (m, siblingId) => {
        if (!id) return;
        // Show the sibling's branch: the server walks down to its newest leaf.
        actions.switchBranch.mutate({
          conversationId: id,
          messageId: siblingId,
        });
        m;
      },
      onFeedback: (m, value) => actions.feedback.mutate({ message: m, value }),
      onSources: (m, n) => setSources({ list: m.sources, n }),
      onReadAloud: features.readAloud
        ? (m) => {
            toggleRead(api, server, m.id, async () => accessToken()).catch(() => toast("Read aloud did not work."));
          }
        : undefined,
      onLongPress: (m) => setMenuFor(m),
      readingId: reading.messageId,
      readingStatus: reading.status,
    }),
    [id, model?.id, actions.switchBranch, actions.feedback, features.readAloud, api, server, accessToken, reading]
  );

  async function submitEdit() {
    if (!editing || !id || !editing.text.trim()) return;
    const { message, text } = editing;
    setEditing(null);
    try {
      await sendMessage({
        conversationId: id,
        parentId: message.parentId,
        content: text.trim(),
        modelId: model?.id,
        fileIds: message.attachments.map((f) => f.id),
        files: message.attachments,
      });
    } catch (e) {
      toast(isApiError(e) ? e.message : "The edit was not sent.");
    }
  }

  async function shareLink() {
    if (!id) return;
    setChatMenu(false);
    try {
      const share = await api.shares.create(id);
      await Share.share({
        message: share.url,
        url: share.url,
        title: share.title,
      });
      qc.invalidateQueries({ queryKey: qk.shares });
    } catch (e) {
      toast(isApiError(e) ? e.message : "The link could not be created.");
    }
  }

  function confirmDelete() {
    if (!id) return;
    setChatMenu(false);
    Alert.alert("Delete this chat?", `"${convo.data?.title ?? "Chat"}" and its messages are deleted for good.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          actions.remove.mutate(id, {
            onSuccess: () => navigation.setParams({ id: undefined, projectId: undefined }),
          }),
      },
    ]);
  }

  const title = id ? convo.data?.title ?? "" : project ? project.name : "";
  const empty = !id || (convo.data && convo.data.messages.length === 0);
  const firstName = (me?.displayName ?? "").split(" ")[0];

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]} testID="chat-screen">
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton label="Open the sidebar" onPress={() => navigation.openDrawer()} icon={<Menu size={22} color={colors.foreground} />} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title ? `${title}. Chat options` : "Chat options"}
          disabled={!id}
          onPress={() => setChatMenu(true)}
          style={styles.titleWrap}
          testID="chat-title"
        >
          <Text variant="subheading" numberOfLines={1} center>
            {title}
          </Text>
          {id && project ? (
            <Text variant="caption" tone="muted" numberOfLines={1} center>
              {project.name}
            </Text>
          ) : null}
        </Pressable>
        <IconButton
          label="New chat"
          onPress={() =>
            navigation.setParams({
              id: undefined,
              projectId: project?.id,
              nonce: Date.now(),
            })
          }
          icon={<SquarePen size={21} color={colors.foreground} />}
        />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.fill} keyboardVerticalOffset={0}>
        {id && convo.isPending ? (
          <View style={styles.loading}>
            <Skeleton width="70%" height={18} />
            <Skeleton width="90%" height={14} style={{ marginTop: space[4] }} />
            <Skeleton width="80%" height={14} style={{ marginTop: space[2] }} />
          </View>
        ) : id && convo.isError && !convo.data ? (
          <View style={styles.loading}>
            <ErrorState
              message={offline ? "This chat is not saved on this phone. Connect to open it." : "The chat could not be loaded."}
              onRetry={
                offline
                  ? undefined
                  : () => {
                      convo.refetch();
                    }
              }
            />
          </View>
        ) : empty ? (
          <View style={styles.empty} testID="chat-empty">
            <Text variant="title">{project ? `New chat in ${project.name}` : firstName ? `What's on your mind, ${firstName}?` : "What's on your mind?"}</Text>
            {!project ? (
              <View style={styles.starters}>
                {STARTERS.map((s) => (
                  <Pressable
                    key={s.title}
                    accessibilityRole="button"
                    disabled={offline}
                    onPress={() => {
                      send({
                        content: s.prompt,
                        files: [],
                        webSearch: prefsQuery.data?.webSearchDefault ?? false,
                        mode: "chat",
                      }).catch(() => undefined);
                    }}
                    style={({ pressed }) => [styles.starter, { borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}
                    testID="starter"
                  >
                    <Text variant="bodyStrong">{s.title}</Text>
                    <Text variant="small" tone="muted" numberOfLines={1}>
                      {s.prompt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => <MessageView message={item} actions={messageActions} last={index === 0} />}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            testID="message-list"
          />
        )}
        <PushOffer />
        <View style={{ paddingBottom: Math.max(insets.bottom, space[2]) }}>
          <Composer
            key={`${id ?? "new"}:${route.params?.nonce ?? 0}`}
            onSend={send}
            onStop={() => activeTurn && stop(activeTurn).catch(() => toast("Could not stop the answer."))}
            streaming={streaming}
            offline={offline}
            vision={!!model?.supportsVision}
            webSearchDefault={prefsQuery.data?.webSearchDefault ?? false}
            placeholder={meta?.appName ? `Message ${meta.appName}` : undefined}
            modelControl={<ModelControl model={model} models={models} onChoose={choose} />}
          />
        </View>
      </KeyboardAvoidingView>

      <SourcesSheet sources={sources?.list ?? null} highlight={sources?.n} onClose={() => setSources(null)} />

      <Sheet visible={!!menuFor} title={menuFor?.role === "USER" ? "Your message" : "Answer"} onClose={() => setMenuFor(null)} scroll={false} testID="message-menu">
        <View style={styles.sheetList}>
          <SheetRow
            label="Copy"
            onPress={() => {
              if (menuFor) {
                Clipboard.setString(menuFor.content);
                toast("Copied");
              }
              setMenuFor(null);
            }}
          />
          {menuFor?.role === "USER" ? (
            <SheetRow
              label="Edit and resend"
              onPress={() => {
                if (menuFor) setEditing({ message: menuFor, text: menuFor.content });
                setMenuFor(null);
              }}
            />
          ) : null}
          {menuFor?.role === "ASSISTANT" && features.readAloud ? (
            <SheetRow
              label={reading.messageId === menuFor.id ? "Stop reading" : "Read aloud"}
              onPress={() => {
                if (menuFor) messageActions.onReadAloud?.(menuFor);
                setMenuFor(null);
              }}
            />
          ) : null}
          {menuFor?.role === "ASSISTANT" ? (
            <SheetRow
              label="Regenerate"
              onPress={() => {
                if (menuFor) messageActions.onRegenerate(menuFor);
                setMenuFor(null);
              }}
            />
          ) : null}
          <SheetRow
            label="Share text"
            onPress={() => {
              if (menuFor) Share.share({ message: menuFor.content });
              setMenuFor(null);
            }}
            last
          />
        </View>
      </Sheet>

      <Sheet visible={!!editing} title="Edit message" onClose={() => setEditing(null)} scroll={false} testID="edit-sheet">
        <View style={styles.editBody}>
          <Text variant="small" tone="muted">
            Sending starts a new version of this conversation from here. The old one stays, one tap away.
          </Text>
          <TextInput
            value={editing?.text ?? ""}
            onChangeText={(t) => setEditing((e) => (e ? { ...e, text: t } : e))}
            multiline
            autoFocus
            style={[styles.editInput, { color: colors.foreground, borderColor: colors.input }]}
            testID="edit-input"
          />
          <Button
            label="Send"
            block
            disabled={!editing?.text.trim() || offline}
            onPress={() => {
              submitEdit();
            }}
            testID="edit-send"
          />
        </View>
      </Sheet>

      <Sheet visible={chatMenu} title={convo.data?.title ?? "Chat"} onClose={() => setChatMenu(false)} scroll={false} testID="chat-menu">
        <View style={styles.sheetList}>
          <SheetRow
            icon={<Pencil size={19} color={colors.foreground} />}
            label="Rename"
            onPress={() => {
              setChatMenu(false);
              setRenaming(convo.data?.title ?? "");
            }}
            testID="chat-rename"
          />
          <SheetRow
            icon={convo.data?.pinned ? <PinOff size={19} color={colors.foreground} /> : <Pin size={19} color={colors.foreground} />}
            label={convo.data?.pinned ? "Unpin" : "Pin"}
            onPress={() => {
              setChatMenu(false);
              if (id) actions.update.mutate({ id, pinned: !convo.data?.pinned });
            }}
            testID="chat-pin"
          />
          {features.projects ? (
            <SheetRow
              icon={<FolderInput size={19} color={colors.foreground} />}
              label="Move to a project"
              onPress={() => {
                setChatMenu(false);
                setMoving(true);
              }}
            />
          ) : null}
          {features.sharing ? (
            <SheetRow
              icon={<Link size={19} color={colors.foreground} />}
              label="Share a link"
              detail="A frozen copy anyone with the link can read"
              onPress={() => {
                shareLink();
              }}
              testID="chat-share"
            />
          ) : null}
          <SheetRow
            icon={<Archive size={19} color={colors.foreground} />}
            label="Archive"
            onPress={() => {
              setChatMenu(false);
              if (id) actions.update.mutate({ id, archived: true }, { onSuccess: () => navigation.setParams({ id: undefined }) });
            }}
          />
          <SheetRow icon={<Trash2 size={19} color={colors.danger} />} label="Delete" destructive onPress={confirmDelete} testID="chat-delete" last />
        </View>
      </Sheet>

      <Sheet visible={renaming !== null} title="Rename chat" onClose={() => setRenaming(null)} scroll={false}>
        <View style={styles.editBody}>
          <TextInput
            value={renaming ?? ""}
            onChangeText={setRenaming}
            autoFocus
            maxLength={120}
            style={[styles.renameInput, { color: colors.foreground, borderColor: colors.input }]}
            testID="rename-input"
          />
          <Button
            label="Save"
            block
            disabled={!renaming?.trim()}
            onPress={() => {
              if (id && renaming?.trim()) actions.update.mutate({ id, title: renaming.trim() });
              setRenaming(null);
            }}
            testID="rename-save"
          />
        </View>
      </Sheet>

      <Sheet visible={moving} title="Move to a project" onClose={() => setMoving(false)}>
        {(projects.data ?? []).map((p, i, all) => (
          <SheetRow
            key={p.id}
            label={p.name}
            detail={convo.data?.projectId === p.id ? "In this project" : undefined}
            onPress={() => {
              setMoving(false);
              if (id) actions.update.mutate({ id, projectId: p.id });
            }}
            last={i === all.length - 1 && !convo.data?.projectId}
          />
        ))}
        {convo.data?.projectId ? (
          <SheetRow
            label="Remove from the project"
            onPress={() => {
              setMoving(false);
              if (id) actions.update.mutate({ id, projectId: null });
            }}
            last
          />
        ) : null}
        {!projects.data?.length ? (
          <Text tone="muted" style={{ paddingVertical: space[4] }}>
            No projects yet. Create one from the sidebar.
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[1],
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space[2],
    minHeight: 48,
    justifyContent: "center",
  },
  list: { paddingHorizontal: space[4], paddingTop: space[2] },
  loading: { flex: 1, padding: space[5] },
  empty: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: space[5],
    paddingBottom: space[4],
  },
  starters: { marginTop: space[6] },
  starter: {
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetList: { paddingHorizontal: space[2] },
  editBody: { padding: space[4], gap: space[3] },
  editInput: {
    ...type.answer,
    minHeight: 120,
    maxHeight: 260,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: space[3],
    textAlignVertical: "top",
  },
  renameInput: {
    ...type.body,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
});
