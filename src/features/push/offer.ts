/**
 * The in-chat push offer: shown once, after an answer that took a while, on a server that
 * can push and a build that has Firebase. Answering it (yes or not now) never shows it
 * again; Settings, Notifications can still turn push on later.
 */
import { useSyncExternalStore } from "react";
import { PREF, prefs } from "../../lib/storage";

export const SLOW_ANSWER_MS = 10_000;

let visible = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const pushOffer = {
  /** Called by the turn runner when an answer ends in the foreground. */
  answered(ms: number, eligible: boolean) {
    if (!eligible || visible || ms < SLOW_ANSWER_MS || prefs.getString(PREF.pushOffered)) return;
    visible = true;
    emit();
  },
  close() {
    prefs.setString(PREF.pushOffered, new Date().toISOString());
    visible = false;
    emit();
  },
  /** Tests. */
  reset() {
    visible = false;
    prefs.remove(PREF.pushOffered);
    emit();
  },
};

export function usePushOfferVisible(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => visible
  );
}
