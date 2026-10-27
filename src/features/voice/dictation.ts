/**
 * Dictation: record from the microphone (AAC in an MP4/M4A container on both platforms,
 * which the server accepts as audio/mp4), send it to POST /api/speech/transcribe and hand
 * the text back to the composer. One recording at a time; at most MAX_SECONDS long.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { createSound, AudioEncoderAndroidType, OutputFormatAndroidType } from "react-native-nitro-sound";

type Sound = ReturnType<typeof createSound>;
import { isApiError } from "../../api/vendor/client/errors";
import { useApi } from "../../app/session";

export const MAX_SECONDS = 120;

export type DictationState = "idle" | "recording" | "transcribing";

async function micAllowed(): Promise<boolean> {
  if (Platform.OS !== "android") return true; // iOS asks on first use (NSMicrophoneUsageDescription)
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: "Microphone",
    message: "Dictation needs the microphone to turn your speech into text.",
    buttonPositive: "Allow",
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export function useDictation(onText: (text: string) => void, onError: (message: string) => void) {
  const api = useApi();
  const [state, setState] = useState<DictationState>("idle");
  const [seconds, setSeconds] = useState(0);
  const sound = useRef<Sound | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAndSend = useCallback(async () => {
    const s = sound.current;
    if (!s) return;
    if (timer.current) clearTimeout(timer.current);
    s.removeRecordBackListener();
    setState("transcribing");
    try {
      const uri = await s.stopRecorder();
      const recorded = await (await fetch(uri.includes("://") ? uri : `file://${uri}`)).blob();
      // Both platforms record AAC in an MP4 container; label it so whatever the file says.
      const { text } = await api.speech.transcribe(new Blob([recorded], { type: "audio/mp4" }));
      if (text.trim()) onText(text.trim());
      else onError("Nothing was heard. Try again a little closer to the microphone.");
    } catch (e) {
      onError(isApiError(e) ? e.message : "Dictation did not work. Try again.");
    } finally {
      setState("idle");
      setSeconds(0);
    }
  }, [api, onText, onError]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!(await micAllowed())) {
      onError("Allow the microphone in Settings to dictate.");
      return;
    }
    try {
      const s = sound.current ?? createSound();
      sound.current = s;
      s.setSubscriptionDuration(0.25);
      s.addRecordBackListener((m: { currentPosition?: number }) => setSeconds(Math.floor((m.currentPosition ?? 0) / 1000)));
      await s.startRecorder(undefined, {
        AVFormatIDKeyIOS: "aac",
        AVNumberOfChannelsKeyIOS: 1,
        AVSampleRateKeyIOS: 16000,
        OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSamplingRate: 16000,
        AudioChannels: 1,
        AudioEncodingBitRate: 32000,
      });
      setState("recording");
      timer.current = setTimeout(() => {
        stopAndSend();
      }, MAX_SECONDS * 1000);
    } catch {
      onError("The microphone could not start.");
      setState("idle");
    }
  }, [state, onError, stopAndSend]);

  /** Throw the recording away. */
  const cancel = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    sound.current?.removeRecordBackListener();
    await sound.current?.stopRecorder().catch(() => undefined);
    setState("idle");
    setSeconds(0);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      sound.current?.removeRecordBackListener();
      sound.current?.stopRecorder().catch(() => undefined);
    },
    []
  );

  return { state, seconds, start, stop: stopAndSend, cancel };
}
