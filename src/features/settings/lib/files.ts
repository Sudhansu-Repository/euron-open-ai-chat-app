/**
 * Files out of the account area: the data export is fetched through the authenticated API
 * client (so a stale token refreshes as usual), written to the cache directory with
 * react-native-blob-util, and shared from there. Nothing is kept outside the cache.
 */
import ReactNativeBlobUtil from "react-native-blob-util";

/** A file name safe for the cache directory ("my data.json" becomes "my-data.json"). */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "file";
}

/** "priya-nair-data-2026-10-26.json" */
export function exportFileName(username: string, now: Date = new Date()): string {
  return safeFileName(`${username}-data-${now.toISOString().slice(0, 10)}.json`);
}

/** A local file URI as a plain path for blob-util ("file:///a%20b.jpg" -> "/a b.jpg"). */
export function pathFromUri(uri: string): string {
  const raw = uri.replace(/^file:\/\//, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const fileUri = (path: string) => (path.startsWith("file://") ? path : `file://${path}`);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Writes a downloaded body into the cache directory and returns its path. */
export async function saveBlobToCache(blob: Blob, name: string): Promise<string> {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeFileName(name)}`;
  if (await ReactNativeBlobUtil.fs.exists(path)) await ReactNativeBlobUtil.fs.unlink(path);
  await ReactNativeBlobUtil.fs.writeFile(path, await blobToBase64(blob), "base64");
  return path;
}
