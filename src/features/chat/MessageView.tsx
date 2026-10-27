/**
 * One message. The user's own words sit in a soft bubble on the right; answers are plain
 * prose on the page ground (never a card), with what the assistant did above them as
 * single muted lines ("Searched the web"), images it made below, and quiet actions under
 * a finished answer: copy, read aloud, regenerate, feedback, share, and "< 2 / 3 >" to move
 * between versions. A long press opens the same actions in a sheet.
 */
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from "@react-navigation/native";
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSearch,
  Globe,
  Image as ImageIcon,
  Link2,
  Pencil,
  RefreshCw,
  Share2,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react-native";
import { memo, useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, Share, StyleSheet, View } from "react-native";
import type { ChatFile, Message, ToolName } from "../../api/vendor/types";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space } from "../../ui/theme/tokens";
import { Markdown } from "./markdown/Markdown";
import { turnState } from "./turn-runner";

/** The same words the server uses for each failure (ERROR_MESSAGES in turns.ts). */
export const ERROR_TEXT: Record<string, string> = {
  QUOTA_EXCEEDED: "You have used today's allowance. It resets at midnight UTC.",
  MODEL_UNAVAILABLE: "This model is not available right now. Pick another model and try again.",
  PROVIDER_ERROR: "The model provider had a problem answering. Try again in a moment.",
  PROVIDER_RATE_LIMITED: "The model provider is busy. Try again in a moment.",
  CONTEXT_TOO_LONG: "This conversation is too long for the model. Start a new chat or remove some attachments.",
  CONTENT_BLOCKED: "This request cannot be answered.",
  INTERNAL: "Something went wrong. Try again.",
};

const TOOL_ICON: Record<ToolName, typeof Globe> = {
  web_search: Globe,
  open_url: Link2,
  generate_image: ImageIcon,
  remember: Brain,
  search_project_files: FileSearch,
};

export interface MessageActions {
  onRegenerate: (m: Message) => void;
  onEdit: (m: Message) => void;
  onBranch: (m: Message, siblingId: string) => void;
  onFeedback: (m: Message, value: 1 | -1 | null) => void;
  onSources: (m: Message, n?: number) => void;
  onReadAloud?: (m: Message) => void;
  onLongPress: (m: Message) => void;
  readingId: string | null;
  readingStatus: "idle" | "loading" | "playing";
}

function Thumb({ file }: { file: ChatFile }) {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [failed, setFailed] = useState(false);
  if (file.kind !== "IMAGE")
    return (
      <View style={styles.docLine}>
        <BookOpen size={14} color={colors.mutedForeground} />
        <Text variant="small" tone="muted" numberOfLines={1}>
          {file.fileName}
        </Text>
      </View>
    );
  const uri = file.thumbUrl ?? file.url;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Open ${file.fileName}`}
      disabled={!file.url}
      onPress={() =>
        file.url &&
        nav.navigate("ImageViewer", {
          fileId: file.id,
          url: file.url,
          width: file.width,
          height: file.height,
        })
      }
    >
      {uri && !failed ? (
        <Image source={{ uri }} style={[styles.thumb, { backgroundColor: colors.muted }]} onError={() => setFailed(true)} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.muted }]} />
      )}
    </Pressable>
  );
}

function Generated({ file, prompt }: { file: ChatFile; prompt: string }) {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [failed, setFailed] = useState(false);
  const ratio = file.width && file.height ? file.width / file.height : 1;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel="Open the image"
      disabled={!file.url}
      onPress={() =>
        file.url &&
        nav.navigate("ImageViewer", {
          fileId: file.id,
          url: file.url,
          prompt,
          width: file.width,
          height: file.height,
        })
      }
      style={[styles.generated, { aspectRatio: ratio, backgroundColor: colors.muted }]}
      testID="generated-image"
    >
      {file.url && !failed ? (
        <Image source={{ uri: file.url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={styles.center}>
          <Text variant="small" tone="muted">
            {failed ? "Connect to load this image" : "Image"}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Branches({ message, onBranch }: { message: Message; onBranch: MessageActions["onBranch"] }) {
  const { colors } = useTheme();
  const i = message.siblingIds.indexOf(message.id);
  if (message.siblingIds.length < 2 || i < 0) return null;
  const go = (d: number) => {
    const id = message.siblingIds[i + d];
    if (id) onBranch(message, id);
  };
  return (
    <View style={styles.branches} testID="branch-switcher">
      <Pressable accessibilityRole="button" accessibilityLabel="Previous version" disabled={i === 0} onPress={() => go(-1)} hitSlop={8} style={i === 0 && styles.dim}>
        <ChevronLeft size={16} color={colors.mutedForeground} />
      </Pressable>
      <Text variant="caption" tone="muted">{`${i + 1} / ${message.siblingIds.length}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next version"
        disabled={i === message.siblingIds.length - 1}
        onPress={() => go(1)}
        hitSlop={8}
        style={i === message.siblingIds.length - 1 && styles.dim}
      >
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function Act({ label, onPress, children, testID }: { label: string; onPress: () => void; children: React.ReactNode; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.act, pressed && styles.dim]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

export const MessageView = memo(function MessageViewImpl({ message, actions, last }: { message: Message; actions: MessageActions; last: boolean }) {
  const { colors } = useTheme();
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);
  const citable = useCallback((n: number) => message.sources.some((s) => s.n === n), [message.sources]);
  const onCite = useCallback((n: number) => actions.onSources(message, n), [actions, message]);
  const icon = colors.mutedForeground;

  const copy = () => {
    Clipboard.setString(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (message.role === "USER") {
    return (
      <Pressable
        onLongPress={() => actions.onLongPress(message)}
        delayLongPress={350}
        style={styles.userWrap}
        testID="message-user"
        accessibilityHint="Long press for actions"
      >
        {message.attachments.length ? (
          <View style={styles.userFiles}>
            {message.attachments.map((f) => (
              <Thumb key={f.id} file={f} />
            ))}
          </View>
        ) : null}
        <View style={[styles.bubble, { backgroundColor: colors.ground2 }]}>
          <Text variant="answer" selectable>
            {message.content}
          </Text>
        </View>
        <View style={styles.userMeta}>
          <Branches message={message} onBranch={actions.onBranch} />
          <Act label="Edit" onPress={() => actions.onEdit(message)} testID="message-edit">
            <Pencil size={15} color={icon} />
          </Act>
        </View>
      </Pressable>
    );
  }

  const streaming = message.status === "STREAMING";
  const failed = message.status === "FAILED";
  const reading = actions.readingId === message.id;
  const error = failed ? turnState.errorOf(message.id) ?? ERROR_TEXT[message.errorCode ?? "INTERNAL"] ?? ERROR_TEXT.INTERNAL : null;
  const waiting = streaming && !message.content && !message.toolSteps.length;

  return (
    <Pressable
      onLongPress={() => actions.onLongPress(message)}
      delayLongPress={350}
      disabled={streaming}
      style={styles.answerWrap}
      testID="message-assistant"
      accessibilityHint="Long press for actions"
    >
      {message.toolSteps.map((s, i) => {
        const Icon = TOOL_ICON[s.tool] ?? Globe;
        return (
          <View key={i} style={styles.step} testID="tool-step">
            {s.status === "RUNNING" ? <ActivityIndicator size="small" color={icon} /> : <Icon size={14} color={s.status === "FAILED" ? colors.danger : icon} />}
            <Text variant="small" tone={s.status === "FAILED" ? "danger" : "muted"}>
              {s.label}
            </Text>
          </View>
        );
      })}

      {message.reasoning ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showReasoning }} onPress={() => setShowReasoning((v) => !v)} style={styles.step}>
          <ChevronDown size={14} color={icon} style={showReasoning ? undefined : styles.rotated} />
          <Text variant="small" tone="muted">
            {streaming && !message.content ? "Thinking" : "Thought process"}
          </Text>
        </Pressable>
      ) : null}
      {message.reasoning && showReasoning ? (
        <View style={[styles.reasoning, { borderLeftColor: colors.border }]}>
          <Text variant="small" tone="muted">
            {message.reasoning}
          </Text>
        </View>
      ) : null}

      {waiting ? <ActivityIndicator style={styles.waiting} color={icon} accessibilityLabel="Writing the answer" /> : null}
      {message.content ? <Markdown text={message.content} citable={citable} onCite={onCite} testID="message-content" /> : null}

      {message.outputs.map((f) => (
        <Generated key={f.id} file={f} prompt={message.content} />
      ))}

      {message.status === "CANCELLED" ? (
        <Text variant="small" tone="muted" style={styles.note}>
          Stopped.
        </Text>
      ) : null}
      {error ? (
        <View style={styles.errorRow} testID="message-error">
          <Text variant="small" tone="danger" style={styles.flex}>
            {error}
          </Text>
          {message.errorCode !== "QUOTA_EXCEEDED" && message.errorCode !== "CONTENT_BLOCKED" ? (
            <Pressable accessibilityRole="button" onPress={() => actions.onRegenerate(message)} hitSlop={8} testID="message-retry">
              <Text variant="smallStrong" tone="link">
                Try again
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!streaming ? (
        <View style={styles.actions}>
          <Branches message={message} onBranch={actions.onBranch} />
          {message.content ? (
            <Act label={copied ? "Copied" : "Copy"} onPress={copy} testID="message-copy">
              <Copy size={16} color={copied ? colors.primary : icon} />
            </Act>
          ) : null}
          {actions.onReadAloud && message.content ? (
            <Act label={reading ? "Stop reading" : "Read aloud"} onPress={() => actions.onReadAloud!(message)} testID="message-read">
              {reading && actions.readingStatus === "loading" ? (
                <ActivityIndicator size="small" color={icon} />
              ) : reading ? (
                <Square size={14} color={colors.primary} fill={colors.primary} />
              ) : (
                <Volume2 size={17} color={icon} />
              )}
            </Act>
          ) : null}
          {last || failed ? (
            <Act label="Regenerate" onPress={() => actions.onRegenerate(message)} testID="message-regenerate">
              <RefreshCw size={16} color={icon} />
            </Act>
          ) : null}
          {message.status === "COMPLETE" ? (
            <>
              <Act
                label={message.feedback === 1 ? "Remove good rating" : "Good answer"}
                onPress={() => actions.onFeedback(message, message.feedback === 1 ? null : 1)}
                testID="message-up"
              >
                <ThumbsUp size={16} color={message.feedback === 1 ? colors.primary : icon} fill={message.feedback === 1 ? colors.primary : "none"} />
              </Act>
              <Act
                label={message.feedback === -1 ? "Remove bad rating" : "Bad answer"}
                onPress={() => actions.onFeedback(message, message.feedback === -1 ? null : -1)}
                testID="message-down"
              >
                <ThumbsDown size={16} color={message.feedback === -1 ? colors.primary : icon} fill={message.feedback === -1 ? colors.primary : "none"} />
              </Act>
              <Act
                label="Share text"
                onPress={() => {
                  Share.share({ message: message.content });
                }}
              >
                <Share2 size={16} color={icon} />
              </Act>
            </>
          ) : null}
          {message.sources.length ? (
            <Pressable accessibilityRole="button" onPress={() => actions.onSources(message)} hitSlop={8} style={styles.sourcesLink} testID="message-sources">
              <Text variant="smallStrong" tone="muted">
                {message.sources.length === 1 ? "1 source" : `${message.sources.length} sources`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.35 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  rotated: { transform: [{ rotate: "-90deg" }] },
  userWrap: {
    alignItems: "flex-end",
    marginBottom: space[5],
    marginLeft: space[10],
  },
  userFiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[2],
    marginBottom: space[2],
  },
  bubble: {
    borderRadius: radius.card,
    paddingHorizontal: space[4],
    paddingVertical: space[2] + 2,
    maxWidth: "100%",
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    marginTop: 4,
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  docLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
  },
  answerWrap: { marginBottom: space[6] },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space[2],
  },
  reasoning: {
    borderLeftWidth: 2,
    paddingLeft: space[3],
    marginBottom: space[3],
  },
  waiting: { alignSelf: "flex-start", marginVertical: space[2] },
  generated: {
    width: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
    marginVertical: space[2],
  },
  note: { marginTop: space[1] },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    marginTop: space[2],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
    marginTop: space[1],
    marginLeft: -6,
  },
  act: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  branches: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginRight: 4,
  },
  sourcesLink: { marginLeft: space[2], paddingVertical: 6 },
});
