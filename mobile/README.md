# Fieldnote Android

Implemented Expo/React Native client. **Expo Go launch, Hausa text use and the Android photo-to-recommendation flow were previously user-verified**; no fresh combined release smoke test is recorded. The active entry is [index.ts](index.ts), which registers [App.tsx](App.tsx). Current packages: Expo SDK 58, React Native 0.88, React 19.3. Feature/Meta status is maintained in the [root README](../README.md#current-workflow-and-meta-technology).

The crop choices match the web app: [32 named crops plus Other](../README.md#crops-and-languages). They are form options, not validated crop/disease coverage. English/Hausa text and requested advice language are implemented; some operational messages remain English, and switching language does not translate saved advice. Hausa voice is not enabled.

## Setup

Use Node matching React Native's installed engine range: `^22.13.0 || ^24.3.0 || >=26.0.0`. Use an Android device/emulator and Expo runtime compatible with SDK 58.

From this directory:

```bash
# First setup only: do not overwrite an existing mobile/.env.
cp .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL to the reachable Fieldnote API base URL.
npm ci
npm run android
# Or: npm start, then open that terminal's exact URL in compatible Expo Go.
```

`npm run android` is `expo start --android`, not an APK build. A compatible Android runtime and the host's device/emulator tooling must already be available. The previously confirmed Expo Go launch does not establish compatibility on every intended device or verify a standalone build.

Run the Python server separately as described in the root README. It binds to host loopback, not the LAN. The standard Android emulator's host alias is usually `http://10.0.2.2:8000`; verify reachability and runtime HTTP policy. A physical phone needs a reachable API deployment/guarded HTTPS forwarding route. Do not expose the development server's repository-wide static directory publicly.

`EXPO_PUBLIC_API_BASE_URL` contains only the server URL. Keep `MODEL_API_KEY` in the server environment/root `.env`, never in mobile code or any `EXPO_PUBLIC_*` variable. `expo-audio` is already in package.json and package-lock.json; `npm ci` installs it. No notification package is installed.

If an old screen appears, confirm Expo's “Starting project at” points to **this checkout's mobile directory** and open its exact printed URL. Port/cache clearing alone does not identify the checkout. Development builds display the `android-parity-photo-v2` revision marker.

## Implemented farmer workflow

- **Capture:** crop/Other, growth stage, area, notes, camera/gallery permissions and cancellation, filename/preview. The named `ImageManipulator` contextual API produces JPEG at quality 0.65 with a maximum 1600-pixel edge. Saving copies the prepared image into app-private storage. Photo errors identify the failing step. The user previously confirmed that an Android photo flow returned a recommendation; separate camera/gallery paths, cancellation, resizing and restart durability are not thereby verified.
- **English voice notes:** explicit consent and microphone permission, up to 30 seconds. The app awaits WAV finalization, validates/normalizes PCM with [voice.ts](voice.ts), then requests `/api/transcribe`. Successful text is editable; typed notes remain usable on failure. Hausa voice is disabled. Hausa typed notes and requested model output are supported but need fluent-speaker review.
- **Save first / retry:** SQLite JSON records and private photo files retain visits before analysis. Save-only does not upload. **Retry analysis** uses the stored photo/details and updates the same visit. Network/timeout failures remain pending; input, configuration and model errors show needs-attention status. Duplicate actions are guarded; no background retry.
- **Photo visits:** adding a dated visit to an existing case uses `/api/followup` with the immediately preceding photo/note. Initial visits use `/api/diagnose`.
- **Clarification:** select a saved visit, type an answer and choose **Save answer offline** or **Update advice**. `/api/refine` updates that visit and retains Q&A/revisions, without adding a photo visit. **Android voice answers are not enabled**, even though voice field notes are implemented.
- **Optional sharing:** review the complete saved-case summary, then confirm local PDF creation. The PDF contains all summary text plus a dated photo page for every saved visit in order. Local photos are embedded; missing photos are explicitly labelled. `expo-print` ~58.0.8 generates the PDF; `expo-sharing` ~58.0.21 opens the native share sheet with `application/pdf`. Both were aligned with SDK 58 using `npx expo install expo-print expo-sharing` and are in the lockfile (`npm ci` installs them). The generated file stays in app cache for retry; the OS may clear it. No server/AI request or case mutation occurs. Cancellation/failure preserves the review. The native API does not confirm recipient delivery or distinguish every dismissal.
- **Checklist:** snapshot existing advice wording per visit, mark To do/Done/Skipped, add notes up to 300 characters, then Save progress. Successful saves collapse the editor and retain a visible saved checklist; Edit checklist reopens saved progress. Failed saves keep entries open with a retryable error. Later advice does not replace the snapshot.
- **Recheck:** set/change/dismiss a case-level reminder using native Android date and time pickers. A new draft starts tomorrow at 09:00 in device-local time; an existing reminder opens at its saved time. Picker selection/cancellation never saves: confirm with Save reminder. Successful saves collapse the editor and show the saved time; failures retain the draft. Due cases appear first and open photo follow-up on the same case. Reminders are **in-app only**, refreshed while open/on foreground return. **No notifications are sent when the app is closed.** No notification permission is requested, so denial cannot block these local controls.
- **Casebook navigation:** separate Checklist, Reminder, View advice and Answer question actions select the saved visit and scroll to its section after layout. Photo follow-up remains a separate action. Local saves show pressed/loading/success feedback and block duplicate submissions.
- **SAM 3.1:** planned only; no segmentation integration exists.

All checklist/reminder changes use existing SQLite records without a schema migration or AI request. Local recovery paths are implemented; clearing app data removes local records, and actual restart durability still requires device verification.

## Code map

| File | Responsibility |
| --- | --- |
| [App.tsx](App.tsx) | UI, SQLite operations, photo/voice capture, saved visits and clarification flow. |
| [analysis.ts](analysis.ts) | Saved-visit analysis, result validation, error status and operation gate. |
| [voice.ts](voice.ts) | WAV validation and normalization; aggregate diagnostics, not proof of intelligible speech. |
| [caseSharing.ts](caseSharing.ts) | Complete local summary used by review and PDF export. |
| [casePdf.ts](casePdf.ts) | Escaped printable HTML, embedded visit photos/missing-photo labels and PDF share options. |
| [caseActions.ts](caseActions.ts), [CaseActionPanel.tsx](CaseActionPanel.tsx) | Checklist state/date helpers and offline controls. |
| [app.json](app.json) | Camera/microphone permissions and Expo plugins; background recording disabled. |

## Verification

```bash
npm run typecheck
cd ..
# Now at repository root:
node test_pending_android.mjs
node test_case_sharing.mjs
node test_case_pdf.mjs
node test_case_actions.mjs
node test_android_actions.mjs
node test_web_panel.mjs
python3 -m unittest -v
```

**Previously recorded automated results, 30 October 2026:** the installed TypeScript compiler API returned zero diagnostics with no emit. Client fixture suites passed 32 distinct groups overall, including 7 Android save/retry groups and cross-platform sharing/checklist tests. They execute selected handlers/helpers against simulated stores/photos/network; they are not Android UI tests. Server WAV/refinement tests exist but were not rerun in that audit. **No tests were rerun for this documentation-only correction.**

**Previously user-verified:** Expo Go opened, Hausa text worked and the Android photo flow returned a recommendation. The user also confirmed the web result-panel update and that the action tracker worked as intended; the tracker report does not establish a separate pass on each platform or restart durability. These earlier checks were not a fresh combined release smoke test.

**Voice was exercised, not reliably verified:** recording reached a “no speech” error. Successful transcription and editable-transcript delivery still need verification. Hausa voice remains disabled.

**Still unverified:** restart/storage and checklist durability, Hausa linguistic quality and agronomic accuracy. Separate camera/gallery permission/cancellation and resize checks, microphone denial/interruption, offline retry, photo comparison, clarification and reminder timing/foreground refresh also need confirmation. Sharing notes record implementation and mocked tests, not successful native share-sheet or recipient-delivery checks. No build, emulator or live-service check was performed for this correction.

## Screenshots and remaining work

**1 November 2026 interaction fix:** added `@react-native-community/datetimepicker` **9.2.1**, matching the installed Expo SDK 58 bundled-module manifest; package and lockfile are updated (`npm ci` installs it). Android typecheck passed. `test_android_actions.mjs` passed four focused groups for save/retry/duplicate taps, editor reopening, picker drafts/cancellation and section navigation. Existing action, Android retry and sharing suites also passed (including the web regression suite imported by the action tests). These use simulated hooks, storage, native dialogs and layout measurements; actual picker rendering, scroll placement and restart durability still need device verification. No emulator or build was run for this fix.

**PDF sharing checks, 1 November 2026:** Android typecheck passed. Tests exercise the actual confirmation handler and mock native print/share APIs: multi-visit inline images, missing-image labels, safe text, duplicate confirmation, failed/cancelled sharing and retry preserve the case. A real web-generated six-page PDF fixture was rendered and inspected, and its embedded images and Hausa glyphs were checked. Android WebView PDF layout, photo decoding and native share/recipient behavior remain device-unverified.

No Android screenshots are bundled in the project-owned source tree. A fresh combined release smoke test and reliable voice transcription remain outstanding; SAM 3.1 and closed-app notifications are not implemented. Photo-inclusive PDF sharing is implemented, with the device limits noted above. There is no backend case backup or cross-device sync. The [build log](../HACKATHON_BUILD_LOG.md) contains dated hackathon contributions and test evidence; older scaffold and [Android plan](../ANDROID_APP_PLAN.md) entries are historical planning, not current completion or verification claims.

**Android PDF diagnostics, 1 November 2026:** printing now validates the returned local URI, positive page count, nonempty file and PDF signature before sharing that original URI. Generation and share-sheet errors show separate phases and safe error codes; no notes, image bytes or paths are logged. Failed sharing retains the generated file and review for retry. Android typecheck and focused PDF/sharing tests passed using mocked native APIs. Emulator inspection was attempted but did not reproduce the reported failure; the original native failure and real print/share behavior remain unverified. If it recurs, report the bracketed phase/code from the review.

**PDF signature-read correction, 1 November 2026:** the user reproduced `validate-signature: ERR_UNEXPECTED`, isolating the legacy Base64 range read. PDF validation now uses SDK 58 `File.open(FileMode.ReadOnly)` and bounded `readBytes` to check `%PDF-`, with handle cleanup on success/failure. URI, page count, file-info and size checks remain. Android typecheck and focused PDF/sharing tests pass; the corrected native read and share sheet still need a device retry. No dependency or web behavior changes.

**Expo Go PDF permission correction, 1 November 2026:** the subsequent user-reported `validate-signature: ERR_INVALID_PERMISSION` exposed the host-cache versus experience-sandbox mismatch: Expo Print writes under Android's host `cache/Print`, while FileSystem enforces the project's read permissions. The earlier File.open approach is superseded. Printing now requests `base64: true`, letting Expo Print read its own output; validation decodes only the `%PDF-` header from that result. URI/pages/file-info/size checks remain, and sharing uses the unchanged original URI. The base64 temporarily occupies memory but is not logged or persisted. Typecheck and PDF/sharing tests pass, including denied File access and invalid/missing returned signatures. The corrected flow still needs an Expo Go retry; no runtime success is claimed.

**Android sharing URI correction, 1 November 2026:** Expo Sharing also enforces project-scoped read permission and rejects Print's host-cache URI with ERR_SHARING_INVALID_ARGS. After validation, Fieldnote writes those same bytes into the project's cache, verifies the copy's exact size, and shares its file URI. The original PDF is retained. Android receives only mimeType/application/pdf and dialogTitle; iOS receives UTI/com.adobe.pdf. Copy/share failures retain the review and retry state. Typecheck and PDF/sharing tests pass. This supersedes the earlier statement that the original Print URI is passed directly to sharing.

**Emulator check, 1 November 2026:** confirmed the corrected export opens Android com.android.intentresolver share chooser in the running Expo Go emulator. No recipient was selected; Back was sent to dismiss it. Recipient delivery/PDF opening in another app was not tested.

**Android voice capture check, 2 November 2026:** the reported 30 s / 24 kHz mono capture had peak 0.02% and RMS 0.01% (approximately −80 dBFS RMS), an extremely quiet signal. Android now displays source and converted PCM levels/durations and whether the 30-second cap trimmed audio. A conservative near-silence gate blocks upload when peak <0.1% and RMS <0.03%; typed notes remain usable. This is not speech detection or automatic gain. The installed SDK's AudioStream uses MIC with 24 kHz mono int16 requested; it exposes no gain/source option. Native stop finalizes the WAV before reading. Synthetic voice tests and Android typecheck passed; no new live microphone recording or physical-device verification was performed. Actual source-level diagnostics are still needed to identify why the microphone input was quiet. No backend/Meta changes or raw-audio debug logging/files were added.
