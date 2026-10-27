/**
 * Images: everything this account generated, newest first, in a grid, with a prompt box to
 * make another (POST /api/images). Tap opens the viewer: pinch to zoom, save to Photos
 * (add-only permission), share, or start a chat about it.
 */
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Download, Share2, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Image, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RNShare from "react-native-share";
import { isApiError } from "../../api/vendor/client/errors";
import { ASPECT_RATIOS, type AspectRatio, type GeneratedImage } from "../../api/vendor/types";
import { qk } from "../../app/query";
import type { RootScreen } from "../../app/routes";
import { useApi } from "../../app/session";
import { IconButton } from "../../ui/components/Button";
import { EmptyState, ErrorState } from "../../ui/components/Feedback";
import { Header } from "../../ui/components/Layout";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";

const GAP = 3;

export function ImagesScreen({ navigation }: RootScreen<"Images">) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const cols = width > 700 ? 4 : 3;
  const size = (width - GAP * (cols - 1)) / cols;
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const list = useInfiniteQuery({
    queryKey: qk.images,
    queryFn: ({ pageParam }) => api.images.list({ cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: () => api.images.create({ prompt: prompt.trim(), aspectRatio: ratio }),
    onSuccess: () => {
      setPrompt("");
      qc.invalidateQueries({ queryKey: qk.images });
      qc.invalidateQueries({ queryKey: qk.usage });
    },
    onError: (e) => toast(isApiError(e) ? e.message : "The image could not be made."),
  });
  const items = (list.data?.pages ?? []).flatMap((p) => p.items);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]} testID="images-screen">
      <Header title="Images" onBack={() => navigation.goBack()} />
      {list.isError && !items.length ? (
        <ErrorState
          message="Your images could not be loaded."
          onRetry={() => {
            list.refetch();
          }}
        />
      ) : (
        <FlatList
          data={items}
          key={cols}
          numColumns={cols}
          keyExtractor={(i) => i.id}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: space[4] }}
          renderItem={({ item }) => (
            <Tile
              image={item}
              size={size}
              onPress={() =>
                item.file.url &&
                navigation.navigate("ImageViewer", {
                  fileId: item.file.id,
                  url: item.file.url,
                  prompt: item.prompt,
                  width: item.file.width,
                  height: item.file.height,
                })
              }
            />
          )}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          ListEmptyComponent={
            !list.isPending ? (
              <EmptyState title="No images yet" body="Describe one below, or ask for a picture in any chat." />
            ) : (
              <ActivityIndicator style={{ margin: space[8] }} />
            )
          }
        />
      )}
      <View
        style={[
          styles.composer,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + space[2],
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratios}>
          {ASPECT_RATIOS.map((r) => (
            <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: r === ratio }} onPress={() => setRatio(r)} hitSlop={4} style={styles.ratio}>
              <Text variant="smallStrong" tone={r === ratio ? "default" : "muted"} style={r === ratio ? styles.chosen : undefined}>
                {r}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.input }]}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Describe an image"
            placeholderTextColor={colors.subtleForeground}
            multiline
            style={[styles.input, { color: colors.foreground }]}
            testID="images-prompt"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create the image"
            disabled={!prompt.trim() || create.isPending}
            onPress={() => create.mutate()}
            style={[styles.send, { backgroundColor: prompt.trim() ? colors.ink : colors.muted }]}
            testID="images-create"
          >
            {create.isPending ? (
              <ActivityIndicator color={colors.inkForeground} size="small" />
            ) : (
              <ArrowUp size={18} color={prompt.trim() ? colors.inkForeground : colors.subtleForeground} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Tile({ image, size, onPress }: { image: GeneratedImage; size: number; onPress: () => void }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = image.file.thumbUrl ?? image.file.url;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={image.prompt}
      onPress={onPress}
      style={{ width: size, height: size, backgroundColor: colors.muted }}
      testID="image-tile"
    >
      {uri && !failed ? <Image source={{ uri }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} /> : null}
    </Pressable>
  );
}

async function canSaveToPhotos(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) >= 29) return true; // iOS asks on first save (add-only)
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** Downloads the image to the cache folder (signed URLs are short-lived; the file is what gets saved or shared). */
async function download(url: string, fileId: string): Promise<string> {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/image-${fileId}.png`;
  if (await ReactNativeBlobUtil.fs.exists(path)) return path;
  const res = await ReactNativeBlobUtil.config({ path }).fetch("GET", url);
  if (res.info().status >= 400) throw new Error("download failed");
  return path;
}

export function ImageViewerScreen({ navigation, route }: RootScreen<"ImageViewer">) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { url, fileId, prompt } = route.params;
  const ratio = route.params.width && route.params.height ? route.params.width / route.params.height : 1;
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  async function save() {
    setBusy("save");
    try {
      if (!(await canSaveToPhotos())) throw new Error("denied");
      const path = await download(url, fileId);
      await CameraRoll.saveAsset(`file://${path}`, { type: "photo" });
      toast("Saved to Photos");
    } catch {
      toast("The image could not be saved. Allow adding to Photos in Settings.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const path = await download(url, fileId);
      await RNShare.open({
        url: `file://${path}`,
        type: "image/png",
        failOnCancel: false,
      });
    } catch {
      toast("The image could not be shared.");
    } finally {
      setBusy(null);
    }
  }

  const fitW = Math.min(width, height * ratio);
  return (
    <View style={[styles.fill, styles.viewer]} testID="image-viewer">
      <ScrollView
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        contentContainerStyle={styles.zoom}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bouncesZoom
      >
        <Image source={{ uri: url }} style={{ width: fitW, height: fitW / ratio }} resizeMode="contain" accessibilityLabel={prompt ?? "Image"} />
      </ScrollView>
      <View style={[styles.viewerTop, { paddingTop: insets.top }]}>
        <IconButton label="Close" onPress={() => navigation.goBack()} icon={<X size={26} color="#fff" />} />
        <View style={styles.flexRow}>
          <IconButton
            label="Save to Photos"
            onPress={() => {
              save();
            }}
            icon={busy === "save" ? <ActivityIndicator color="#fff" /> : <Download size={22} color="#fff" />}
          />
          <IconButton
            label="Share"
            onPress={() => {
              share();
            }}
            icon={busy === "share" ? <ActivityIndicator color="#fff" /> : <Share2 size={22} color="#fff" />}
          />
        </View>
      </View>
      {prompt ? (
        <View style={[styles.caption, { paddingBottom: insets.bottom + space[3] }]}>
          <Text variant="small" style={styles.captionText} numberOfLines={4}>
            {prompt}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  captionText: { color: "#E6EAF0" },
  chosen: { textDecorationLine: "underline" },
  fill: { flex: 1 },
  flexRow: { flexDirection: "row" },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[3],
    paddingTop: space[2],
  },
  ratios: {
    gap: space[4],
    paddingHorizontal: space[2],
    paddingBottom: space[2],
  },
  ratio: { paddingVertical: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space[2],
  },
  input: {
    ...type.body,
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingHorizontal: space[2],
    paddingTop: 8,
    paddingBottom: 8,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  viewer: { backgroundColor: "#05070B" },
  zoom: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  viewerTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space[2],
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    backgroundColor: "rgba(5,7,11,0.6)",
  },
});
