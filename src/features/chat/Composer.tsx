/**
 * The composer: one floating surface at the bottom with the text, attachments as small
 * thumbnails above it, and a row of quiet controls: attach, tools (web search, image),
 * dictation, the model, then send (or stop while an answer is being written).
 *
 * Only what the server turned on shows (AppMeta.features). Offline, it is read-only with
 * a one-line reason. Enter inserts a line break, as on every phone keyboard; send is the
 * button.
 */
import { ArrowUp, Camera, FileText, Globe, Image as ImageIcon, ImagePlus, Mic, Paperclip, Plus, Square, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFeatures, useMeta } from "../../app/meta";
import { Sheet } from "../../ui/components/Sheet";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { fonts, radius, space, type } from "../../ui/theme/tokens";
import { useDictation } from "../voice/dictation";
import { pickFiles, pickPhotos, useAttachments } from "./attachments";
import type { ChatFile } from "../../api/vendor/types";

export interface ComposerSubmit {
  content: string;
  files: ChatFile[];
  webSearch: boolean;
  mode: "chat" | "image";
}

export interface ComposerProps {
  onSend: (input: ComposerSubmit) => Promise<void>;
  onStop?: () => void;
  streaming: boolean;
  offline: boolean;
  /** The model picker, rendered by the screen (it owns the selection). */
  modelControl: React.ReactNode;
  /** Whether the selected model can see images; picking photos for one that cannot warns. */
  vision: boolean;
  webSearchDefault?: boolean;
  placeholder?: string;
}

function Control({
  label,
  onPress,
  active,
  disabled,
  children,
  testID,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.control, active && { backgroundColor: colors.primarySoft }, (pressed || disabled) && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

export function Composer({ onSend, onStop, streaming, offline, modelControl, vision, webSearchDefault = false, placeholder }: ComposerProps) {
  const { colors } = useTheme();
  const features = useFeatures();
  const limits = useMeta().data?.limits;
  const [text, setText] = useState("");
  const [webSearch, setWebSearch] = useState(webSearchDefault);
  const [imageMode, setImageMode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const attachments = useAttachments();
  const maxFiles = limits?.maxFilesPerMessage ?? 10;
  const dictation = useDictation(
    useCallback((t: string) => setText((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t)), []),
    useCallback((m: string) => toast(m), [])
  );

  const canSend = !offline && !streaming && !sending && text.trim().length > 0 && attachments.ready && dictation.state === "idle";

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend({
        content: text.trim(),
        files: attachments.files,
        webSearch,
        mode: imageMode ? "image" : "chat",
      });
      setText("");
      attachments.clear();
      setImageMode(false);
    } catch {
      // The screen shows why; keep what was typed.
    } finally {
      setSending(false);
    }
  }

  async function addFrom(source: "camera" | "library" | "files") {
    setMenu(false);
    const room = maxFiles - attachments.items.length;
    if (room <= 0) {
      toast(`Up to ${maxFiles} files per message.`);
      return;
    }
    try {
      const picked = source === "files" ? await pickFiles(room > 1) : await pickPhotos(source, room);
      if (source !== "files" && picked.length && !vision) toast("This model cannot see images. Pick a model marked vision.");
      attachments.add(picked.slice(0, room));
    } catch (e) {
      toast(e instanceof Error ? e.message : "That file could not be opened.");
    }
  }

  if (offline) {
    return (
      <View style={[styles.offline, { borderTopColor: colors.border }]} testID="composer-offline">
        <Text variant="small" tone="muted" center>
          You are offline. Your recent chats are here to read; sending waits for a connection.
        </Text>
      </View>
    );
  }

  const recording = dictation.state === "recording";
  return (
    <View style={styles.outer}>
      <View style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.input }]} testID="composer">
        {attachments.items.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} keyboardShouldPersistTaps="handled">
            {attachments.items.map((a) => (
              <View key={a.key} style={[styles.thumb, { backgroundColor: colors.muted }]} testID="composer-attachment">
                {a.type.startsWith("image/") ? (
                  <Image source={{ uri: a.uri }} style={styles.thumbImage} />
                ) : (
                  <View style={styles.docThumb}>
                    <FileText size={18} color={colors.mutedForeground} />
                    <Text variant="caption" tone="muted" numberOfLines={2} style={styles.docName}>
                      {a.name}
                    </Text>
                  </View>
                )}
                {!a.file && !a.error ? (
                  <View style={[styles.thumbVeil, { backgroundColor: colors.overlay }]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {a.error ? (
                  <View style={[styles.thumbVeil, { backgroundColor: colors.dangerSoft }]}>
                    <Text variant="caption" tone="danger" numberOfLines={3} center>
                      {a.error}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.name}`}
                  onPress={() => attachments.remove(a.key)}
                  hitSlop={8}
                  style={[styles.thumbRemove, { backgroundColor: colors.ink }]}
                >
                  <X size={12} color={colors.inkForeground} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {recording || dictation.state === "transcribing" ? (
          <View style={styles.recording} testID="composer-recording">
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text variant="bodyStrong" style={styles.flex}>
              {recording ? `Listening  ${Math.floor(dictation.seconds / 60)}:${String(dictation.seconds % 60).padStart(2, "0")}` : "Turning speech into text"}
            </Text>
            {recording ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard recording"
                onPress={() => {
                  dictation.cancel();
                }}
                hitSlop={8}
              >
                <Text variant="smallStrong" tone="muted">
                  Discard
                </Text>
              </Pressable>
            ) : (
              <ActivityIndicator color={colors.mutedForeground} />
            )}
          </View>
        ) : (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={imageMode ? "Describe the image" : placeholder ?? "Ask anything"}
            placeholderTextColor={colors.subtleForeground}
            multiline
            maxLength={limits?.maxMessageChars ?? 32000}
            style={[styles.input, { color: colors.foreground }]}
            accessibilityLabel="Message"
            testID="composer-input"
          />
        )}

        <View style={styles.row}>
          <Control label="Add photos and files" onPress={() => setMenu(true)} testID="composer-add">
            <Plus size={20} color={colors.foreground} />
          </Control>
          {features.webSearch && !imageMode ? (
            <Control label={webSearch ? "Web search on" : "Web search off"} active={webSearch} onPress={() => setWebSearch((v) => !v)} testID="composer-web">
              <Globe size={18} color={webSearch ? colors.primarySoftForeground : colors.mutedForeground} />
            </Control>
          ) : null}
          {features.imageGeneration ? (
            <Control label={imageMode ? "Image mode on" : "Create an image"} active={imageMode} onPress={() => setImageMode((v) => !v)} testID="composer-image">
              <ImageIcon size={18} color={imageMode ? colors.primarySoftForeground : colors.mutedForeground} />
            </Control>
          ) : null}
          <View style={styles.flex}>{modelControl}</View>
          {features.dictation && !recording && dictation.state === "idle" ? (
            <Control
              label="Dictate"
              onPress={() => {
                dictation.start();
              }}
              testID="composer-mic"
            >
              <Mic size={19} color={colors.mutedForeground} />
            </Control>
          ) : null}
          {recording ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop and transcribe"
              onPress={() => {
                dictation.stop();
              }}
              style={[styles.send, { backgroundColor: colors.ink }]}
              testID="composer-mic-stop"
            >
              <ArrowUp size={18} color={colors.inkForeground} />
            </Pressable>
          ) : streaming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop the answer"
              onPress={onStop}
              style={[styles.send, { backgroundColor: colors.ink }]}
              testID="composer-stop"
            >
              <Square size={13} color={colors.inkForeground} fill={colors.inkForeground} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={() => {
                send();
              }}
              style={[styles.send, { backgroundColor: canSend ? colors.ink : colors.muted }]}
              testID="composer-send"
            >
              {sending ? (
                <ActivityIndicator color={colors.inkForeground} size="small" />
              ) : (
                <ArrowUp size={18} color={canSend ? colors.inkForeground : colors.subtleForeground} />
              )}
            </Pressable>
          )}
        </View>
      </View>

      <Sheet visible={menu} title="Add" onClose={() => setMenu(false)} scroll={false} testID="composer-add-sheet">
        <View style={styles.sheetList}>
          <SheetRow
            icon={<Camera size={20} color={colors.foreground} />}
            label="Camera"
            onPress={() => {
              addFrom("camera");
            }}
            testID="add-camera"
          />
          <SheetRow
            icon={<ImagePlus size={20} color={colors.foreground} />}
            label="Photos"
            onPress={() => {
              addFrom("library");
            }}
            testID="add-photos"
          />
          <SheetRow
            icon={<Paperclip size={20} color={colors.foreground} />}
            label="Files"
            detail="PDF, Word, Excel, text"
            onPress={() => {
              addFrom("files");
            }}
            testID="add-files"
            last
          />
        </View>
      </Sheet>
    </View>
  );
}

export function SheetRow({
  icon,
  label,
  detail,
  onPress,
  destructive,
  last,
  testID,
}: {
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.sheetRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: colors.muted },
      ]}
    >
      {icon}
      <View style={styles.flex}>
        <Text variant="bodyStrong" tone={destructive ? "danger" : "default"}>
          {label}
        </Text>
        {detail ? (
          <Text variant="small" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  outer: { paddingHorizontal: space[3], paddingTop: space[1] },
  surface: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: space[2],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  input: {
    ...type.answer,
    fontFamily: fonts.body.regular,
    minHeight: 40,
    maxHeight: 160,
    paddingHorizontal: space[2],
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 2, paddingTop: 2 },
  control: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  thumbs: {
    gap: space[2],
    paddingHorizontal: space[1],
    paddingBottom: space[2],
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: "hidden" },
  thumbImage: { width: 64, height: 64 },
  docThumb: { flex: 1, padding: 6, gap: 2 },
  docName: { fontSize: 10, lineHeight: 12 },
  thumbVeil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  thumbRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  recording: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: 40,
    paddingHorizontal: space[2],
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  offline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  sheetList: { paddingHorizontal: space[2] },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[4],
  },
});
