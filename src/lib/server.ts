/**
 * The euron-open-ai-chat server the app talks to. One build can serve any self-hosted
 * server: the build's API_BASE_URL is the default, and people may enter their own on the
 * welcome screen (unless the build sets ALLOW_CUSTOM_SERVER=false). A server is accepted
 * only after its GET /api/meta answers like one.
 */
import type { AppMeta } from "../api/vendor/types";
import { config } from "../config";
import { PREF, prefs } from "./storage";

export function currentServer(): string {
  if (!config.allowCustomServer) return config.defaultApiBaseUrl;
  return prefs.getString(PREF.server) ?? config.defaultApiBaseUrl;
}

export function saveServer(apiBase: string): void {
  if (apiBase === config.defaultApiBaseUrl) prefs.remove(PREF.server);
  else prefs.setString(PREF.server, apiBase);
}

/**
 * What a person typed, as an API base: https is assumed, "/api" is added, trailing slashes
 * go. Plain http is allowed only for local addresses (a development server). Null when it
 * cannot be a server address.
 */
export function normalizeServer(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!host || (!host.includes(".") && host !== "localhost")) return null;
  const local = host === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local");
  if (url.protocol === "http:" && !local) return null;
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/api")) path = `${path}/api`;
  return `${url.protocol}//${url.host}${path}`;
}

/** Fetches the server's meta; throws a readable error when it is not an Open AI Chat server. */
export async function probeServer(apiBase: string, timeoutMs = 8000): Promise<AppMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase}/meta`, {
      headers: { Accept: "application/json", "X-Client": "native" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`The server answered ${res.status}. Check the address.`);
    const meta = (await res.json()) as Partial<AppMeta>;
    if (typeof meta.appName !== "string" || !meta.features || !meta.limits) throw new Error("That address is not an Open AI Chat server.");
    return meta as AppMeta;
  } catch (e) {
    if (controller.signal.aborted) throw new Error("The server did not answer in time.");
    if (e instanceof SyntaxError) throw new Error("That address is not an Open AI Chat server.");
    if (e instanceof TypeError) throw new Error("The server could not be reached. Check the address and your connection.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
