/**
 * Attachments in the composer: picked from the camera, the photo library or Files, then
 * uploaded at once (POST /api/files ticket, PUT straight to storage, complete, wait for
 * READY), so they are ready by the time the message is sent. The bytes stream from disk:
 * React Native's XMLHttpRequest sends a `{ uri }` body natively, nothing is read into
 * JavaScript.
 */
import { useCallback, useRef, useState } from "react";
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from "@react-native-documents/picker";
import ReactNativeBlobUtil from "react-native-blob-util";
import { launchCamera, launchImageLibrary, type Asset } from "react-native-image-picker";
import type { ChatFile, FilePurpose } from "../../api/vendor/types";
import { isApiError } from "../../api/vendor/client/errors";
import { useApi } from "../../app/session";

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export interface Pending {
  key: string;
  name: string;
  type: string;
  /** Local preview for images. */
  uri: string;
  progress: number;
  file: ChatFile | null;
  error: string | null;
}

const fromAsset = (a: Asset): PickedFile | null =>
  a.uri
    ? {
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}.jpg`,
        type: a.type ?? "image/jpeg",
        size: a.fileSize ?? 0,
      }
    : null;

/** Photos (or a new one from the camera). Cancelling returns []. */
export async function pickPhotos(source: "camera" | "library", limit: number): Promise<PickedFile[]> {
  const opts = {
    mediaType: "photo" as const,
    quality: 0.9 as const,
    maxWidth: 2560,
    maxHeight: 2560,
    includeExtra: false,
  };
  const res = source === "camera" ? await launchCamera({ ...opts, saveToPhotos: false }) : await launchImageLibrary({ ...opts, selectionLimit: limit });
  if (res.didCancel) return [];
  if (res.errorCode)
    throw new Error(res.errorCode === "permission" ? "Allow access to your photos in Settings." : res.errorMessage ?? "That picture could not be opened.");
  return (res.assets ?? []).map(fromAsset).filter((f): f is PickedFile => !!f);
}

/** Documents from Files (PDF, Word, Excel, text, images). Copied locally so Android content:// works everywhere. */
export async function pickFiles(multiple: boolean): Promise<PickedFile[]> {
  try {
    const picked = await pick({
      allowMultiSelection: multiple,
      type: [types.pdf, types.doc, types.docx, types.xls, types.xlsx, types.csv, types.plainText, types.images, "text/markdown", "application/json"],
    });
    const copies = await keepLocalCopy({
      files: picked.map((p) => ({ uri: p.uri, fileName: p.name ?? "file" })) as [{ uri: string; fileName: string }],
      destination: "cachesDirectory",
    });
    return picked
      .map((p, i) => {
        const c = copies[i];
        const uri = c && c.status === "success" ? c.localUri : p.uri;
        return {
          uri,
          name: p.name ?? "file",
          type: p.type ?? "application/octet-stream",
          size: p.size ?? 0,
        };
      })
      .filter((f) => !!f.uri);
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return [];
    throw e;
  }
}

/** The upload ticket needs the exact size; pickers do not always report it. */
async function withSize(f: PickedFile): Promise<PickedFile> {
  if (f.size > 0 || !f.uri.startsWith("file://")) return f;
  try {
    const st = await ReactNativeBlobUtil.fs.stat(decodeURIComponent(f.uri.replace(/^file:\/\//, "")));
    return { ...f, size: Number(st.size) || 0 };
  } catch {
    return f;
  }
}

let seq = 0;

export function useAttachments(purpose: Exclude<FilePurpose, "GENERATED"> = "ATTACHMENT") {
  const api = useApi();
  const [items, setItems] = useState<Pending[]>([]);
  const aborts = useRef(new Map<string, AbortController>());

  const patch = (key: string, p: Partial<Pending>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const add = useCallback(
    (files: PickedFile[]) => {
      for (const f of files) {
        const key = `a${++seq}`;
        const controller = new AbortController();
        aborts.current.set(key, controller);
        setItems((list) => [
          ...list,
          {
            key,
            name: f.name,
            type: f.type,
            uri: f.uri,
            progress: 0,
            file: null,
            error: null,
          },
        ]);
        withSize(f)
          .then((sized) =>
            api.files.upload({
              purpose,
              file: {
                uri: sized.uri,
                name: sized.name,
                type: sized.type,
                size: sized.size,
              } as unknown as Blob & { name: string },
              onProgress: (fraction) => patch(key, { progress: fraction }),
              signal: controller.signal,
            })
          )
          .then((file) => patch(key, { file, progress: 1 }))
          .catch((e) => {
            if ((e as Error).name === "AbortError") return;
            patch(key, { error: isApiError(e) ? e.message : "Upload failed" });
          })
          .finally(() => aborts.current.delete(key));
      }
    },
    [api, purpose]
  );

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort();
    setItems((list) => list.filter((x) => x.key !== key));
  }, []);

  const clear = useCallback(() => {
    for (const c of aborts.current.values()) c.abort();
    aborts.current.clear();
    setItems([]);
  }, []);

  const ready = items.every((x) => x.file && !x.error);
  return {
    items,
    add,
    remove,
    clear,
    ready,
    files: items.map((x) => x.file).filter((f): f is ChatFile => !!f),
  };
}
