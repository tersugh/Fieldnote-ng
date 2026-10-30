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
- **Optional sharing:** review the saved-case summary, then use native **text-only** sharing or manually copy selectable text. No Android photo attachment or printable field-plan export is implemented. Sharing does not call the Fieldnote backend; delivery is not confirmed.
- **Checklist:** snapshot existing advice wording per visit, mark To do/Done/Skipped, add notes up to 300 characters, then Save progress. Later advice does not replace the snapshot.
- **Recheck:** set/change/dismiss a case-level local date/time (`YYYY-MM-DD HH:mm`). Due cases appear first and open photo follow-up on the same case. Reminders are **in-app only**, refreshed while open/on foreground return. **No notifications are sent when the app is closed.** No notification permission is requested, so denial cannot block these local controls.
- **SAM 3.1:** planned only; no segmentation integration exists.

All checklist/reminder changes use existing SQLite records without a schema migration or AI request. Local recovery paths are implemented; clearing app data removes local records, and actual restart durability still requires device verification.

## Code map

| File | Responsibility |
| --- | --- |
| [App.tsx](App.tsx) | UI, SQLite operations, photo/voice capture, saved visits and clarification flow. |
| [analysis.ts](analysis.ts) | Saved-visit analysis, result validation, error status and operation gate. |
| [voice.ts](voice.ts) | WAV validation and normalization; aggregate diagnostics, not proof of intelligible speech. |
| [caseSharing.ts](caseSharing.ts) | Local summary and native text-share adapter. |
| [caseActions.ts](caseActions.ts), [CaseActionPanel.tsx](CaseActionPanel.tsx) | Checklist state/date helpers and offline controls. |
| [app.json](app.json) | Camera/microphone permissions and Expo plugins; background recording disabled. |

## Verification

```bash
npm run typecheck
cd ..
# Now at repository root:
node test_pending_android.mjs
node test_case_sharing.mjs
node test_case_actions.mjs
node test_web_panel.mjs
python3 -m unittest -v
```

**Previously recorded automated results, 30 October 2026:** the installed TypeScript compiler API returned zero diagnostics with no emit. Client fixture suites passed 32 distinct groups overall, including 7 Android save/retry groups and cross-platform sharing/checklist tests. They execute selected handlers/helpers against simulated stores/photos/network; they are not Android UI tests. Server WAV/refinement tests exist but were not rerun in that audit. **No tests were rerun for this documentation-only correction.**

**Previously user-verified:** Expo Go opened, Hausa text worked and the Android photo flow returned a recommendation. The user also confirmed the web result-panel update and that the action tracker worked as intended; the tracker report does not establish a separate pass on each platform or restart durability. These earlier checks were not a fresh combined release smoke test.

**Voice was exercised, not reliably verified:** recording reached a “no speech” error. Successful transcription and editable-transcript delivery still need verification. Hausa voice remains disabled.

**Still unverified:** restart/storage and checklist durability, Hausa linguistic quality and agronomic accuracy. Separate camera/gallery permission/cancellation and resize checks, microphone denial/interruption, offline retry, photo comparison, clarification and reminder timing/foreground refresh also need confirmation. Sharing notes record implementation and mocked tests, not successful native share-sheet or recipient-delivery checks. No build, emulator or live-service check was performed for this correction.

## Screenshots and remaining work

No Android screenshots are bundled in the project-owned source tree. A fresh combined release smoke test and reliable voice transcription remain outstanding; SAM 3.1, closed-app notifications, photo attachments in native sharing and Android print export are not implemented. There is no backend case backup or cross-device sync. The [build log](../HACKATHON_BUILD_LOG.md) contains dated hackathon contributions and test evidence; older scaffold and [Android plan](../ANDROID_APP_PLAN.md) entries are historical planning, not current completion or verification claims.
