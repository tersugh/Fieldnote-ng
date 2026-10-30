# Fieldnote

**An Android-first crop-advice prototype for Nigerian smallholder farmers**, with web and Expo/React Native clients. Farmers save photos and observations, request AI guidance, return with new evidence, and optionally ask an extension worker for a second opinion. English and Hausa text interfaces are implemented; agronomic accuracy and Hausa quality still need field review.

## Crops and languages

Both clients offer the same 32 named crops plus **Other** with a free-text name: soybean, cocoa, yam, cassava, maize, rice, oil palm, groundnut, sesame, sorghum, cowpea, cashew, ginger, hibiscus, rubber, cotton, shea, chili pepper, tomato, sugarcane, millet, coffee, kola nut, gum arabic, turmeric, moringa, tobacco, plantain, banana, mango, pineapple and egusi. These are input choices, not evidence of crop-specific diagnostic accuracy or a validated disease catalogue.

English/Hausa interface labels, typed notes and clarification answers are supported, and advice is requested in the selected language. Switching the interface does not translate already saved advice. Some operational/error messages remain English; Hausa wording and model output need fluent-speaker review. **Voice transcription is English-only; Hausa voice is not enabled.**

## Current workflow and Meta technology

**Status audited 30 October 2026; verification wording corrected from the user's confirmations.** “Implemented” means present in current source. Automated evidence below uses fixtures/mocks; previously user-verified flows are listed separately under Checks and verification. Those confirmations are not a fresh combined release smoke test.

| Workflow | Technology / endpoint | Implemented today | Automated evidence |
| --- | --- | --- | --- |
| English voice → editable text | Muse Voice Transcribe (`muse-voice-transcribe-1.0`), `POST /api/transcribe` | Web notes and clarification answers; Android field notes. Android voice answers are disabled. Hausa speech is disabled in both clients and rejected by the server; Hausa typed notes/answers are supported. | WAV/multipart/error tests exist in `test_server.py`; not rerun in the audit. The recording flow was exercised but returned “no speech”; reliable transcription is not verified. |
| Initial photo assessment and advice | Muse Spark (`muse-spark-1.3`), `POST /api/diagnose` | Both clients send saved photo, crop, notes, stage and area; display observations, possible causes, actions, urgency and a question. | Web and Android save/request/result tests pass with mocked HTTP. |
| New-photo follow-up visit | Muse Spark, `POST /api/followup` | Both clients append a dated visit and compare it with the immediately preceding photo/note. | Comparison/retry/history tests pass with mocks. |
| Answer a clarification question | Muse Spark, `POST /api/refine` | Both clients send original visit context, prior assessment, question, answer and completed Q&A history. Revised advice stays on that visit; no new photo visit. | Web answer/failure/retry tests pass. Server refine tests exist but were not rerun; Android UI/refine integration is not device-verified. |
| Local casebook, offline save and retry | IndexedDB on web; SQLite + private photos on Android | Save before analysis; reopen saved visits; manually retry with the stored photo. Success updates the same visit. Connection failures stay pending; input/service errors need attention. No background upload/retry. | Offline save, simulated reload, failures, duplicate-tap guards and same-visit updates pass. Actual storage/restart durability remains unverified. |
| Optional extension-worker sharing | No model call | Review a summary first. Web: native share, optional capability-checked photo, copy/download fallbacks and separate print action. Android: native **text-only** share and selectable text; no photo attachment. | Summary, safe rendering, mocked sharing/fallback tests pass. Real share sheets/receiving apps are unverified. |
| Action checklist | No model call | Both clients snapshot existing advice verbatim; save To do/Done/Skipped states and short notes per visit. Later advice does not replace that checklist. | Save/reopen/progress/wording tests pass with simulated stores. |
| Farmer-set recheck reminder | No model call | Set/change/dismiss a case reminder; due cases link to a photo follow-up on the same case. **In-app only on both platforms. Android does not notify when closed**; `expo-notifications` is absent. | Date/due/dismissal/same-case tests pass. Reminder timing and foreground refresh are not separately user-verified. |
| Select an affected image area | SAM 3.1 (`sam-3-1`), proposed | **Unimplemented:** no segmentation endpoint, model request or client integration found. | No implementation tests or manual verification. |

The server returns `{assessment}` for the three advice routes and `{transcript}` for transcription. It validates mono 16-bit PCM WAV at 16/24 kHz (0.25–30 seconds); its Meta transcription request is multipart WAV. Non-silent audio does not establish intelligible speech. See [technology notes](META_TECH_WORKFLOW.md) and the source in [server.py](server.py).

## Run locally

### Web and server

Requires Python 3.10+. The server uses the standard library.

```bash
# First setup only: keep any existing .env rather than overwriting it.
cp .env.example .env
# Set MODEL_API_KEY in your editor; never commit .env.
python3 server.py
```

Open http://127.0.0.1:8000. Root `.env` is loaded without overriding existing process variables.

| Server variable | Purpose / default |
| --- | --- |
| `MODEL_API_KEY` | Server-only Meta credential; required for upstream requests. |
| `MODEL_API_URL`, `MODEL_NAME` | Defaults: `https://api.meta.ai/v1/responses`, `muse-spark-1.3`. |
| `VOICE_API_URL`, `VOICE_MODEL_NAME` | Defaults: `https://api.meta.ai/v1/asr/transcribe`, `muse-voice-transcribe-1.0`. |
| `PORT` | Defaults to `8000`; server binds to `127.0.0.1`. |

This is a development server whose static handler serves the repository directory. Do not expose that directory publicly (it can contain `.env`). For a physical phone, provide a reachable, guarded HTTPS route to the API endpoints; setting a LAN URL alone does not change the loopback bind. Browser microphone access requires a supporting browser and a secure context such as localhost/HTTPS.

### Android

The active entry is `mobile/index.ts` → `mobile/App.tsx`. Current dependencies are Expo SDK 58, React Native 0.88 and React 19.3. Use Node 22.13+ in the 22.x line, 24.3+ in the 24.x line, or 26+ (the installed React Native engine range), and an Android runtime compatible with this Expo SDK.

```bash
cd mobile
# First setup only: keep any existing mobile/.env.
cp .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL to the reachable Fieldnote API base URL.
npm ci
npm run android
```

`EXPO_PUBLIC_API_BASE_URL` is a public server URL, **never an API key**. `expo-audio` is already declared in both package manifest and lockfile; no separate feature dependency install is needed. See [mobile setup and verification](mobile/README.md).

`npm run android` runs `expo start --android`: it starts the development server and requests opening the Android runtime; it does not produce a standalone APK. The web client is plain HTML/CSS/JavaScript served by Python, with no separate web package install/build step. The server forwards explicit model requests; it provides no user accounts or backend case-storage API.

## Local data and farmer control

- Cases/photos remain in the browser's IndexedDB or Android's SQLite/private files. Clearing browser storage or app data can remove them; no backend case backup or cross-device sync is implemented.
- Save-only, checklist and reminder operations do not upload. Analysis, refinement and voice transcription send data only after the corresponding farmer action. The Fieldnote API does not persist case records; this is not a claim about Meta's retention policy.
- Web clarification drafts save as typed; Android offers **Save answer offline**. Both retain submitted Q&A and revised advice.
- Android prepares JPEGs with a maximum 1600-pixel edge and quality 0.65. Web accepts JPG/PNG/WebP up to 8 MB; it does not implement that Android resize pipeline.
- Reopening saved records is implemented, but there is no offline web app-shell/service-worker implementation. Loading the web UI while disconnected and physical storage durability need manual testing.
- Sharing is a separate, optional handoff. AI guidance is uncertain, not a confirmed diagnosis; prompts instruct against invented mixtures/doses. Safety and recommendation quality are not field-validated.

## Checks and verification

From the root, after installing mobile dependencies (the fixture suites use its TypeScript package):

```bash
node test_web_panel.mjs
node test_pending_android.mjs
node test_case_sharing.mjs
node test_case_actions.mjs
python3 -m unittest -v
python3 -m py_compile server.py
node --check app.js
cd mobile
npm run typecheck
```

Previously recorded automated results on **30 October 2026**: **32 distinct client test groups passed** (10 web, 7 Android save/retry, 7 sharing, 8 checklist/reminder). The checklist suite also imports/runs the web suite; do not double-count it. Tests were executed directly through JavaScript, and the installed TypeScript compiler API reported **zero diagnostics**, with no emit. These are simulated DOM/storage/network tests plus selected real handler execution, not browser/emulator E2E tests. Python test source was inspected, but its suite was **not rerun in that audit**. No dedicated documentation test configuration was found. **No tests were rerun for this documentation-only correction.**

**Previously user-verified:** the app opened in Expo Go; Hausa text worked; the Android photo flow returned a recommendation; the web result panel updated; and the action tracker worked as intended. The action-tracker report does not specify a separate pass on each platform. These are earlier feature-specific confirmations, not a fresh combined release smoke test.

**Voice:** the recording flow was exercised, but a “no speech” error occurred. Reliable transcription and successful editable-transcript delivery remain unverified; typed input remains available and Hausa voice is not enabled.

**Still unverified:** real reload/restart durability, Hausa linguistic quality and agronomic accuracy. Camera/gallery permission and cancellation edge cases, photo resizing, end-to-end comparison/refinement, and reminder timing/foreground refresh need separate confirmation. Existing sharing notes establish implementation and mocked tests only; real share sheets, receiving apps and recipient delivery remain unverified.

## Repository guide

- [server.py](server.py): static development host and four stateless API routes.
- [app.js](app.js), [index.html](index.html), [styles.css](styles.css): web client.
- [mobile/](mobile/): Android client, local persistence and input helpers.
- [HACKATHON_BUILD_LOG.md](HACKATHON_BUILD_LOG.md): dated work and verification record. Older plan/scaffold entries are historical, not current status.
- [LICENSE](LICENSE): MIT.

## Screenshots, roadmap and hackathon record

No screenshots are bundled in the project-owned source tree. Previously user-verified flows are recorded above; no fresh combined release smoke test or complete demo recording is established by those individual confirmations.

The immediate remaining work includes a fresh combined release smoke test, reliable transcription checks, restart/storage testing, and Hausa/agronomic review. SAM 3.1 segmentation remains proposed and unimplemented. Closed-app notifications, an offline web app shell, cross-device sync and Android photo-sharing/print export are not implemented; they are not promised capabilities of this version.

The [build log](HACKATHON_BUILD_LOG.md) records work beginning 26 October 2026 for the project's stated 26 October–4 November hackathon window: web/server integration, Android capture and local storage, photo comparisons, clarification, retry, sharing, checklists and reminders. It records Codex-assisted changes and verification limits. Historical scaffold/planning entries describe earlier stages; submission readiness, originality and event eligibility have not been independently verified by this documentation audit.
