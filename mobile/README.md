# Fieldnote Android client

This is the Android-first React Native client. It targets affordable Android phones and keeps crop records on the device so farmers can capture evidence without a live connection.

## Current slice

- English/Hausa app interface.
- Crop incident and follow-up note form.
- Camera or gallery photo selection, resized to a maximum 1600-pixel edge and compressed as JPEG, then copied into app-private storage.
- SQLite casebook that survives app restarts.
- Explicit save-on-device and get-crop-advice actions.
- Muse Spark first-assessment and follow-up API payloads. The API key is not included in this app.

## Run

Requires Node.js 22.13 or newer and an Android 7+ device/emulator. Expo SDK 58 is paired with React Native 0.88; see the [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/).

```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_BASE_URL to the HTTPS server address.
npm install
npm run android
```

The server must be reachable from the phone. Do not put `MODEL_API_KEY` in this app or in `EXPO_PUBLIC_*`; configure it only in the server environment.

## Offline and data behavior

- Saving a field note writes its crop record to SQLite and copies its photo into app-private storage.
- Requesting crop advice is a separate user action. The image is sent to the server only after that action.
- If the network request fails, the local observation remains saved. The farmer can retry from the casebook.
- Photos are resized and compressed on-device before storage or upload to limit mobile data and peak memory use.

Photo preparation uses the installed `expo-image-manipulator` package's named `ImageManipulator` object export and its contextual API (`manipulate`, `resize`, `renderAsync`, `saveAsync`). This is not a namespace import. It bounds image loading, resizes the longer edge to 1600 pixels when needed, and saves JPEG at quality 0.65. Camera/gallery permissions, cancellation, preview, and the app-private copy on field-note save are preserved. Each failure identifies its step and revision; cleanup failures do not discard a successfully prepared photo. Device verification is still pending.

## Confirm the emulator is loading this checkout

The Expo project directory is `/Users/alberttersugh/Downloads/HACKATHON 2026/fieldnote-hackathonv1/mobile`, not the repository root. Its explicit entry is `index.ts`, which imports `./App` and registers it with Expo. The previous `expo/AppEntry` also resolved to this App; no competing App file was found in this checkout.

Start Expo from that mobile directory, then open the exact URL printed by that terminal in Expo Go. Check that the terminal's `Starting project at` path matches that directory. The port alone does not identify a checkout. In development, the updated screen shows `android-parity-photo-v2` below Hackathon prototype, followed by Notice a change / Know what to do next and the crop dropdown. If the marker is absent, investigate which project/bundle Expo Go loaded before testing this photo fix. Clearing a different server's cache does not identify the bundle shown by the emulator.

Test gallery and camera, cancellation, portrait/landscape photos above 1600 pixels, small photos, preview, and offline save/reopen. If a photo fails, report the entire alert including its revision and step. The original namespace call to `manipulate` was invalid; the subsequent `manipulateAsync` export does exist but wraps several native calls and cleanup. The latest emulator failure cannot be attributed to a particular call from the generic alert alone. No commands, builds, or emulator tests were run during this investigation.

## Current limitations

- This initial client has not yet been built or tested on a physical Android phone or emulator.
- English voice recording/transcription and the revised form/visit UI need device verification. Farmer field-plan export and photo compression benchmarks remain outstanding.
- Hausa UI and model output need fluent-speaker review. Voice transcription remains English-only.
- A configured HTTPS API endpoint is required for Meta analysis. Model analysis is not available offline.

## Android web parity and English voice — 27 October 2026

The single-column form follows the web palette, spacing, copy, crop choices (including Other), and growth stages. Android system sans-serif fonts approximate the web DM Sans/Manrope typography without remote font loading. The primary Review this plant action saves locally before requesting advice; Save field note offline remains separate. Saved visits retain photos, dated notes, review retry, follow-ups, and optional sharing.

Install the newly declared SDK-compatible dependency from mobile with `npx expo install expo-audio`. Expo 58.0.20 lists `expo-audio ~58.0.10` in bundledNativeModules.json. The package lock has deliberately not been regenerated; the install will update it. No other dependency upgrade is required. Microphone permission is configured for native builds, including removing the image-picker configuration that previously explicitly blocked RECORD_AUDIO.

English voice uses SDK 58 AudioStream with int16 PCM, not the AAC/M4A recording preset. After explicit consent, recording stops at 30 seconds (or manually), finalizes WAV, normalizes to mono 24 kHz / 16-bit PCM, and posts audio_data_url to /api/transcribe. The endpoint accepts mono 16-bit WAV at 16 or 24 kHz, at most 5 MB. Temporary audio is removed after completion, failure, or interruption. Existing typed notes are preserved on failure; successful text is editable before saving. Hausa voice stays disabled because transcription is not verified.

The browser error Unable to decode audio data comes from convertToWav calling AudioContext.decodeAudioData before the network request. Browser decoder/container incompatibility, empty audio, or truncation need the actual failing recording to distinguish; it is not normal UI copy or a server transcription response. Native PCM avoids that browser decoding step.

Manual verification still required: camera/gallery permission and cancellation; portrait/landscape/small-image preview and saved files; crop Other and all stage choices; English microphone denial, stop/30-second limit, background interruption, offline/server failure and transcript editing; disabled Hausa voice; offline save/restart, review retry, dated follow-up, and sharing. No commands, builds, typechecks, or emulator were run for this change.

## Voice diagnostics and answer refinement — 27 October 2026

Recording finalization was traced in the installed expo-audio Android sources: stopFileRecordingAsync calls writer.finish under the file-writer lock; finish updates the WAV header, syncs the descriptor, and closes the file before returning. The app awaits this before reading bytes. It now compares the finalized metadata with RIFF length, PCM format, sample rate, channels, sample width, frame alignment, data length, and duration. It checks the normalized PCM samples for zero/constant signals and shows only aggregate duration/rate/channel/peak/RMS information, never audio samples or base64. Hardware fallback rates are still normalized to mono 24 kHz, 16-bit PCM.

The server independently validates WAV bytes and 0.25–30-second duration, rejects empty/silent/constant/truncated/unsupported audio, and sends raw WAV in the existing multipart request/audio parts to Meta's file endpoint. A missing transcript field is now a response-contract error; an empty transcript after valid non-silent audio is reported accurately, without assuming the room is noisy. Non-silent audio does not prove intelligible speech. On an emulator, verify host microphone input as well as app permission. No actual failing recording or live Meta response was available in this workspace, so the capture-level cause and transcription success remain unverified. Temporary recordings are still deleted; typed notes remain usable and edits made during transcription are preserved. Hausa voice is disabled in the UI and rejected by the server.

For a saved assessment, choose View advice / answer question on the visit, type an answer, then Update advice. This saves the pending answer locally before requesting /api/refine with the original visit's crop, photo, notes, stage, location, previous assessment, question, answer, and up to 20 earlier completed Q&A turns. It does not create a visit or call the photo-comparison /api/followup route. Save answer offline keeps a pending turn without sending anything. Reopen the same visit to resume it after restarting. Successful responses replace that visit's current assessment and retain the prior/revised assessments and dated Q&A history in its SQLite JSON record; older cases need no schema migration. A next question can be answered in the same way. Voice answers are intentionally not enabled until transcription is verified.

Tests added to test_server.py cover refine context, Hausa text, input/assessment validation, upstream failure, separation from /api/followup, WAV metadata/silence/truncation, multipart file delivery, and response-contract errors. They use synthetic fixtures and mocked upstream requests. No commands, tests, builds, or emulator were run. No dependency installation is required for this change.

Device checks: record an English sentence and a silent clip; inspect only the aggregate diagnostics; test microphone denial and interruption; ensure typed edits survive failed/empty transcription. For refinement, save an answer offline, restart and reopen the visit, submit it, answer the next question, and check that earlier Q&A/revisions remain and no extra photo visit was created. Retry a failed update and confirm the pending turn is reused.
