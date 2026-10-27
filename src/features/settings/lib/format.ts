/** Dates and small text helpers for the settings screens. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Oct 2026". */
export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 d ago", then the date. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} d ago`;
  return dateOnly(iso);
}

/** A readable device name from a session's user agent. The app itself shows as "iOS app" or "Android app". */
export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  if (/CFNetwork|Darwin\//.test(ua) && !/Mozilla/.test(ua)) return "iOS app";
  if (/okhttp/i.test(ua)) return "Android app";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
    ? "Opera"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\/|CriOS/.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : /curl|node|axios/i.test(ua)
    ? "App or script"
    : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
    ? "Android"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
    ? "Windows"
    : /CrOS/.test(ua)
    ? "ChromeOS"
    : /Linux/.test(ua)
    ? "Linux"
    : null;
  return os ? `${browser} on ${os}` : browser;
}

/** A TOTP secret in groups of four ("JBSW Y3DP EHPK 3PXP"), easier to type into an authenticator. */
export function groupSecret(secret: string): string {
  const clean = secret.replace(/[\s-]+/g, "").toUpperCase();
  return clean.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Six digits only, for code fields. */
export const digits6 = (s: string): string => s.replace(/\D/g, "").slice(0, 6);

/** The text someone saves with their recovery codes. */
export function recoveryCodesText(codes: string[], appName: string): string {
  return [`${appName} recovery codes`, "Each code signs you in once if you lose your authenticator app.", "", ...codes, ""].join("\n");
}

/** Converts a theme colour ("hsl(188, 87%, 29%)" or "#0e7c8c") to hex for native SDKs that only take hex. */
export function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const m = color.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (!m) return "#000000";
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const hue = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r = l;
  let g = l;
  let b = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
