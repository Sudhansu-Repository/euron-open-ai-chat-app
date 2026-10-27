# Voice

Two features, both done by the server's speech models: dictation into the composer, and read aloud
for answers. The app records and plays; it never runs a speech model itself. Code:
[`src/features/voice/`](../../src/features/voice/). Both use `react-native-nitro-sound`.

## 1. Dictation

Shown only when the server reports `features.dictation`.
[`dictation.ts`](../../src/features/voice/dictation.ts) (`useDictation`), used by
[`Composer.tsx`](../../src/features/chat/Composer.tsx):

1. **Permission.** Android asks for `RECORD_AUDIO` with a short reason. iOS asks on first use with
   `NSMicrophoneUsageDescription` ("Dictation turns what you say into text in the message box.").
   A refusal shows "Allow the microphone in Settings to dictate."
2. **Record.** AAC in an MP4 container on both platforms, mono, 16 kHz (32 kbps on Android). The
   composer shows "Listening 0:12" with the elapsed time, a cancel and a stop control. Recording
   stops by itself after **120 seconds** (`MAX_SECONDS`).
3. **Send.** The file is read into a `Blob`, labelled `audio/mp4`, and sent to
   `POST /api/speech/transcribe` through the vendored client. The composer shows "Turning speech
   into text".
4. **Insert.** The text is appended to whatever is already in the composer. An empty result shows
   "Nothing was heard. Try again a little closer to the microphone."; an API error shows its
   message.

Cancel throws the recording away. Leaving the screen stops the recorder. Send stays disabled while
dictation is recording or transcribing.

## 2. Read aloud

Shown under finished answers when the server reports `features.readAloud`.
[`readAloud.ts`](../../src/features/voice/readAloud.ts):

1. **Download to a file.** `GET /api/messages/:id/speech` (audio from the server's speech model, in
   the voice chosen in Personalization) is fetched with `react-native-blob-util` straight to
   `<cache>/read-<messageId>.mp3`, with the access token and `X-Client: native`. The bytes never
   pass through JavaScript as base64. The request times out after 60 seconds.
2. **Refresh once.** On a 401 (the access token expired) it deletes the partial file, calls the
   client's `refreshSession()` and tries again.
3. **Play.** The file is played from disk. One answer plays at a time: starting another, or tapping
   the same one again, stops the first.
4. **Clean up.** When playback ends or is stopped, the file is deleted.

The state (`idle`, `loading`, `playing`, and which message) is a small store that the message
actions subscribe to with `useSyncExternalStore`.

### Voices

Personalization lists the voices the server accepts (`alloy`, `ash`, `ballad`, `coral`, `echo`,
`fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`) and saves the choice to the account's
preferences. The list is mirrored from the server's speech integration; a server that adds a voice
needs the app's list updated too.

## 3. Locally

Against `make up` the server's stubs answer transcription and speech with deterministic stand-ins,
so both features can be tried without a key.

## 4. Not covered

There are no unit tests for the voice code yet: it is thin glue over the recorder and the player,
and the Jest setup mocks both. Interactive QA on devices is in progress
([testing.md](../guides/testing.md)); until it is done, treat dictation and read aloud as untested
on real hardware.
