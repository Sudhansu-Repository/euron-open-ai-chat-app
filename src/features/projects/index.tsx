/**
 * Projects: a name, standing instructions every chat in it follows, files the assistant
 * can search (search_project_files), and its chats. The list shows counts as type; the
 * project screen is a column of sections on hairlines, no cards.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, MoreHorizontal, Plus, SquarePen, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { isApiError } from "../../api/vendor/client/errors";
import type { ChatFile } from "../../api/vendor/types";
import { qk } from "../../app/query";
import type { RootScreen } from "../../app/routes";
import { useApi } from "../../app/session";
import { Button, IconButton } from "../../ui/components/Button";
import { EmptyState, ErrorState, Skeleton } from "../../ui/components/Feedback";
import { Header, Screen } from "../../ui/components/Layout";
import { Sheet } from "../../ui/components/Sheet";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";
import { pickFiles } from "../chat/attachments";
import { SheetRow } from "../chat/Composer";
import { useConversations, useProject, useProjects } from "../chat/queries";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ProjectsScreen({ navigation }: RootScreen<"Projects">) {
  const { colors } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const projects = useProjects();
  const [creating, setCreating] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (name: string) => api.projects.create({ name }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: qk.projects });
      setCreating(null);
      navigation.navigate("Project", { id: p.id });
    },
    onError: (e) => toast(isApiError(e) ? e.message : "The project could not be created."),
  });

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]} testID="projects-screen">
      <Header
        title="Projects"
        onBack={() => navigation.goBack()}
        right={<IconButton label="New project" onPress={() => setCreating("")} icon={<Plus size={22} color={colors.foreground} />} />}
      />
      {projects.isError && !projects.data ? (
        <ErrorState
          message="Projects could not be loaded."
          onRetry={() => {
            projects.refetch();
          }}
        />
      ) : (
        <FlatList
          data={projects.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: space[8] }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("Project", { id: item.id })}
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.muted }]}
              testID="project-row"
            >
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="small" tone="muted">{`${plural(item.chatCount, "chat", "chats")} · ${plural(item.fileCount, "file", "files")}`}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            projects.isPending ? (
              <View style={styles.pad}>
                <Skeleton height={18} width="60%" />
              </View>
            ) : (
              <EmptyState
                title="No projects yet"
                body="Group chats, files and instructions for one piece of work."
                action={{
                  label: "New project",
                  onPress: () => setCreating(""),
                }}
              />
            )
          }
        />
      )}
      <Sheet visible={creating !== null} title="New project" onClose={() => setCreating(null)} scroll={false}>
        <View style={styles.sheetBody}>
          <TextInput
            value={creating ?? ""}
            onChangeText={setCreating}
            autoFocus
            placeholder="Name"
            placeholderTextColor={colors.subtleForeground}
            maxLength={80}
            style={[styles.field, { color: colors.foreground, borderColor: colors.input }]}
            testID="project-name"
          />
          <Button label="Create" block loading={create.isPending} disabled={!creating?.trim()} onPress={() => create.mutate(creating!.trim())} testID="project-create" />
        </View>
      </Sheet>
    </View>
  );
}

function fileStatus(f: ChatFile): string {
  if (f.status === "READY") return f.pageCount ? plural(f.pageCount, "page", "pages") : "Ready";
  if (f.status === "REJECTED") return f.rejectedReason ?? "Could not be read";
  return "Reading";
}

export function ProjectScreen({ navigation, route }: RootScreen<"Project">) {
  const { colors } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const { id } = route.params;
  const project = useProject(id);
  const chats = useConversations({ projectId: id });
  const [instructions, setInstructions] = useState("");
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  useEffect(() => {
    if (project.data) setInstructions(project.data.instructions);
  }, [project.data?.instructions]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.project(id) });
    qc.invalidateQueries({ queryKey: qk.projects });
  };
  const update = useMutation({
    mutationFn: (body: { name?: string; instructions?: string }) => api.projects.update(id, body),
    onSuccess: (p) => {
      qc.setQueryData(qk.project(id), p);
      qc.invalidateQueries({ queryKey: qk.projects });
      toast("Saved");
    },
    onError: (e) => toast(isApiError(e) ? e.message : "That did not save."),
  });
  const removeFile = useMutation({
    mutationFn: (fileId: string) => api.projects.removeFile(id, fileId),
    onSuccess: refresh,
    onError: () => toast("The file could not be removed."),
  });

  async function addFiles() {
    let picked;
    try {
      picked = await pickFiles(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That file could not be opened.");
      return;
    }
    for (const f of picked) {
      setUploading((n) => n + 1);
      api.files
        .upload({
          purpose: "PROJECT",
          file: {
            uri: f.uri,
            name: f.name,
            type: f.type,
            size: f.size,
          } as unknown as Blob & { name: string },
        })
        .then((file) => api.projects.addFile(id, file.id))
        .then(refresh)
        .catch((e) => toast(isApiError(e) ? `${f.name}: ${e.message}` : `${f.name} could not be added.`))
        .finally(() => setUploading((n) => n - 1));
    }
  }

  function confirmDelete() {
    setMenu(false);
    Alert.alert("Delete this project?", "Its files go too. Its chats stay, outside any project.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          api.projects
            .remove(id)
            .then(() => {
              qc.invalidateQueries({ queryKey: qk.projects });
              qc.invalidateQueries({ queryKey: qk.chatsAll });
              navigation.goBack();
            })
            .catch(() => toast("The project could not be deleted.")),
      },
    ]);
  }

  const p = project.data;
  const chatItems = (chats.data?.pages ?? []).flatMap((pg) => pg.items);
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]} testID="project-screen">
      <Header
        title={p?.name ?? ""}
        onBack={() => navigation.goBack()}
        right={<IconButton label="Project options" onPress={() => setMenu(true)} icon={<MoreHorizontal size={22} color={colors.foreground} />} />}
      />
      {project.isError && !p ? (
        <ErrorState
          message="The project could not be loaded."
          onRetry={() => {
            project.refetch();
          }}
        />
      ) : !p ? (
        <View style={styles.pad}>
          <Skeleton height={18} width="50%" />
        </View>
      ) : (
        <Screen>
          <Button
            label="New chat in this project"
            icon={<SquarePen size={18} color={colors.inkForeground} />}
            block
            onPress={() =>
              navigation.navigate("Main", {
                screen: "Chat",
                params: { projectId: id, nonce: Date.now() },
              })
            }
            style={{ marginTop: space[4] }}
            testID="project-new-chat"
          />

          <Text variant="eyebrow" tone="subtle" style={styles.section}>
            Instructions
          </Text>
          <Text variant="small" tone="muted">
            Every chat in this project follows these.
          </Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            multiline
            placeholder="For example: answer as a careful editor; keep it short."
            placeholderTextColor={colors.subtleForeground}
            maxLength={8000}
            style={[styles.instructions, { color: colors.foreground, borderColor: colors.input }]}
            testID="project-instructions"
          />
          {instructions !== p.instructions ? (
            <Button
              label="Save instructions"
              variant="outline"
              loading={update.isPending}
              onPress={() => update.mutate({ instructions })}
              style={styles.start}
              testID="project-save"
            />
          ) : null}

          <View style={styles.sectionHead}>
            <Text variant="eyebrow" tone="subtle">
              Files
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                addFiles();
              }}
              hitSlop={8}
              testID="project-add-file"
            >
              <Text variant="smallStrong" tone="link">
                Add files
              </Text>
            </Pressable>
          </View>
          <Text variant="small" tone="muted">
            The assistant searches these when a question needs them.
          </Text>
          {uploading ? (
            <View style={styles.fileRow}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text variant="small" tone="muted">{`Uploading ${plural(uploading, "file", "files")}`}</Text>
            </View>
          ) : null}
          {p.files.map((f) => (
            <View key={f.id} style={[styles.fileRow, { borderBottomColor: colors.border }]} testID="project-file">
              <FileText size={18} color={colors.mutedForeground} />
              <View style={styles.fill}>
                <Text variant="body" numberOfLines={1}>
                  {f.fileName}
                </Text>
                <Text variant="caption" tone={f.status === "REJECTED" ? "danger" : "muted"}>
                  {fileStatus(f)}
                </Text>
              </View>
              <IconButton label={`Remove ${f.fileName}`} onPress={() => removeFile.mutate(f.id)} icon={<Trash2 size={17} color={colors.mutedForeground} />} />
            </View>
          ))}
          {!p.files.length && !uploading ? (
            <Text variant="small" tone="subtle" style={{ marginTop: space[2] }}>
              No files yet.
            </Text>
          ) : null}

          <Text variant="eyebrow" tone="subtle" style={styles.section}>
            Chats
          </Text>
          {chatItems.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate("Main", {
                  screen: "Chat",
                  params: { id: c.id },
                })
              }
              style={({ pressed }) => [styles.chatRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}
              testID="project-chat"
            >
              <Text variant="body" numberOfLines={1}>
                {c.title}
              </Text>
            </Pressable>
          ))}
          {!chatItems.length && !chats.isPending ? (
            <Text variant="small" tone="subtle">
              No chats yet.
            </Text>
          ) : null}
        </Screen>
      )}
      <Sheet visible={menu} title={p?.name ?? "Project"} onClose={() => setMenu(false)} scroll={false}>
        <View style={styles.sheetList}>
          <SheetRow
            label="Rename"
            onPress={() => {
              setMenu(false);
              setRenaming(p?.name ?? "");
            }}
          />
          <SheetRow label="Delete project" destructive onPress={confirmDelete} last />
        </View>
      </Sheet>
      <Sheet visible={renaming !== null} title="Rename project" onClose={() => setRenaming(null)} scroll={false}>
        <View style={styles.sheetBody}>
          <TextInput
            value={renaming ?? ""}
            onChangeText={setRenaming}
            autoFocus
            maxLength={80}
            style={[styles.field, { color: colors.foreground, borderColor: colors.input }]}
          />
          <Button
            label="Save"
            block
            disabled={!renaming?.trim()}
            onPress={() => {
              update.mutate({ name: renaming!.trim() });
              setRenaming(null);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  fill: { flex: 1 },
  pad: { padding: space[5] },
  row: {
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  section: { marginTop: space[8], marginBottom: space[1] },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space[8],
    marginBottom: space[1],
  },
  instructions: {
    ...type.body,
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: space[3],
    marginVertical: space[3],
    textAlignVertical: "top",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  chatRow: {
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetList: { paddingHorizontal: space[2] },
  sheetBody: { padding: space[4], gap: space[3] },
  field: {
    ...type.body,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
});
