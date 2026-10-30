# Hackathon Build Log

## Android entry and photo diagnostics — 27 October 2026

- Confirmed the exact Downloads checkout and its mobile Expo project. Web-parity UI already exists in the App.tsx resolved by the prior Expo entry; no competing App file was found. The emulator's reported old screen cannot yet be tied to this source or a specific stale-bundle cause.
- Added explicit local index.ts registration and a development-only android-parity-photo-v2 label to identify the loaded component.
- Inspected installed Expo 58.0.20, image-picker 58.0.10, image-manipulator 58.0.15, and file-system 58.0.12 exports/types and the Android manipulation implementation. Replaced the opaque manipulateAsync wrapper with the named native object and individually labelled load, resize, render, and JPEG-save steps. Kept a 1600-pixel maximum, quality 0.65, camera/gallery cancellation, preview, and private storage; added step-specific permission/picker/file/preview/copy errors and isolated cleanup failures.
- No runtime root cause or successful device result claimed. Commands, builds, and emulator execution remain with the user; no secrets or dependency versions changed.

## Android photo-selection fix — 27 October 2026

- Codex identified an invalid package-namespace call to `ImageManipulator.manipulate`: installed `expo-image-manipulator` 58.0.15 exports `manipulateAsync` and a nested `ImageManipulator` object, but no top-level `manipulate` function.
- Replaced that call with exported `manipulateAsync`, preserving aspect ratio with a maximum 1600-pixel edge, no upscaling, and JPEG compression at 0.65. Camera/gallery permissions, cancellation, preview, and copying into app-private storage on save remain intact.
- Inspected installed Expo 58.0.20 bundled-module metadata and Android image-manipulator sources for API compatibility. No commands, builds, typechecks, or emulator/device tests were run, as requested; device verification remains pending.

## Project start — 26 October 2026

**Starting point:** blank project directory created for this event.  
**Problem:** soybean farmers can notice disease symptoms early but still lose crops when timely, understandable support is hard to reach. This is grounded in my familys' experience with my grandmother's soybean farm.  
**Theme:** Build for Your World.  
**Product slice:** farmer records a crop issue with photo + voice/text notes → receives direct recommendations → returns with dated evidence → gets an updated action plan. Soybean is the origin story; the interface supports multiple crops and an open-ended crop name.

## Original contributions in this repository

- Responsive, mobile-first Fieldnote interface and image preview.
- Nigerian crop selector for soybean, cocoa, yam, cassava, maize, rice, oil palm, groundnut, sesame, sorghum, cowpea, cashew, ginger, hibiscus, rubber, cotton, shea, chili pepper, tomato, sugarcane, millet, coffee, kola nut, gum arabic, turmeric, moringa, tobacco, plantain, banana, mango, pineapple, egusi, and an open-ended option.
- New Python server with input validation and server-side Meta Model API integration.
- New crop-aware multimodal prompt and assessment schema, including explicit uncertainty, safe next steps, and escalation.
- New unit tests for input decoding and response handling.
- New README, setup instructions, and this contribution log.

## Voice note feature — 26 October 2026

- Added a 30-second browser microphone recording flow with no client-side key exposure.
- Converts the recording to mono, 24 kHz, 16-bit PCM WAV in the browser, matching Meta Voice Transcribe's documented accepted format.
- Sends the audio to a server-side `/api/transcribe` endpoint and inserts the transcript into the editable symptom field for farmer review before Muse Spark triage.
- The server validates WAV structure/format, keeps the API key server-side, and does not persist audio.
- Added tests for WAV validation and Meta's multipart transcription request.
- Official API references checked: Meta Model API Speech-to-text and Transcribe a recording guides.

## Crop incident casebook pivot — 26 October 2026

- Scope changed after reviewing the complete hackathon rules: the one-photo analyzer by itself risks falling under the disallowed “simple image analyzers” category.
- Added a device-local IndexedDB casebook that stores each incident's crop, location, dated notes, photos, and model-generated triage record.
- Added follow-up visits that send the previous and current photos together to Muse Spark and ask it to describe only visible changes, noting when angle, distance, or lighting make comparison unreliable.
- Added a browser-printable field plan with the farmer’s visit timeline, photos, notes, possible explanations, recommended next steps, and urgency guidance.
- Clarified data handling: photos stay in this browser's casebook but are sent to Meta for requested model analysis; recorded audio is sent to Meta for requested transcription; the Fieldnote server does not persist either.
- The new casebook and comparison workflow are original features added during the hackathon and should be called out in the demo as the central contribution.

## Hausa + English demo localization — 26 October 2026

- Added an English/Hausa language switch for the farmer-facing interface, crop labels, casebook, assessment labels, and printable field plan.
- Passes the selected language to the Muse Spark prompt so assessment text is requested in English or Hausa while preserving the JSON contract.
- English voice transcription remains available. Hausa voice capture is disabled because Meta's documented Muse Voice Transcribe language list does not include Hausa.
- Hausa copy and model output are an initial prototype and require review with fluent Hausa-speaking farmers or extension workers before claims of reliability.

## Android-first product direction — 26 October 2026

- Set the primary product target as an Android app for farmers using affordable Android phones and unreliable mobile connections.
- Defined Expo/React Native/TypeScript as the proposed client, with SQLite case storage and app-private photo files. Offline capture is local; model requests are explicit and wait for connectivity.
- Added a low-data requirement to resize/compress photos on-device and keep the Meta API key only on the server.
- Documented the current browser prototype as a workflow reference, not the finished Android app. The Android client and SQLite workflow are planned and must be built before they are shown as demo features.
- See [`ANDROID_APP_PLAN.md`](ANDROID_APP_PLAN.md) for the workflow and build order.

## Android client scaffold — 26 October 2026

- Added a new Expo/React Native/TypeScript Android client under `mobile/`.
- Added an English/Hausa incident form, camera/gallery selection, on-device photo copies, SQLite persistence, local case list, and separate save versus Meta-review actions.
- Added client request code for the existing first-assessment and follow-up server endpoints; the API key stays on the server and is not included in the Android client.
- Added on-device image resize (maximum 1600-pixel edge) and JPEG compression before saving or uploading, to reduce storage, memory, and mobile data use.
- Not yet built, installed, or tested on Android because this workspace has no Expo CLI, Android SDK, or emulator. Treat this as a scaffold until build and device checks are recorded.

## Local Meta credentials — 27 October 2026

- Added standard-library `.env` loading to the server so a developer can configure `MODEL_API_KEY` locally without terminal environment injection.
- Existing process variables take precedence; `.env` remains ignored by Git and the key is never packaged in the Android client.
- Added a unit test for local `.env` parsing and precedence.
- Live Meta request is still pending because no key is configured in this workspace, despite account credits being active.

## Evidence to add during the event

- [ ] Dated commits for each feature.
- [ ] Screen recording showing the complete new flow.
- [ ] A small, rights-cleared test set with source and labels recorded, if used.
- [ ] Notes on model failures, uncertainty handling, and what changed after testing.
- [ ] Public repository URL and final demo URL.

## Direct farmer-advice pivot — 27 October 2026

- Product direction clarified: Fieldnote must give farmers practical recommendations directly because many have no access to extension workers. The app should not make a referral or handoff the core outcome.
- Replaced the handoff-centered value proposition with a farmer-directed advice loop: photo and context → ranked possible causes → prioritized actions → dated follow-up → updated plan.
- Kept extension-worker support as an optional farmer choice: added a case-summary share action so a farmer can request a second opinion after receiving the app's own recommendations.
- Updated the Muse Spark initial and follow-up prompts to return specific feasible actions, urgency and warning signs, and one focused question when more evidence would improve the recommendation. The model must still communicate uncertainty and must not invent pesticide products, mixtures, or doses.
- Updated browser and Android-facing copy, the printable artifact, README, Android plan, and Meta workflow to describe a farmer-owned field plan.
- Expert-quality advice is the product goal, not a validated claim yet. Build out authoritative Nigerian crop guidance, review Hausa with fluent speakers, and test recommendations with farmers before claiming expert-level reliability.

## Android web parity and voice input — 27 October 2026

- Codex adapted the web intro, story, EN/HA copy, cream/green cards, crop and stage choices, results, and dated casebook to one scrollable Android column. Kept SQLite, private photo copies, offline save, review retry, follow-up comparison, and optional extension-worker sharing.
- Retained the installed-package photo fix: exported manipulateAsync with a maximum 1600-pixel edge and JPEG compression 0.65; added selected filename and prepared-file size validation.
- Added SDK 58 expo-audio AudioStream recording, explicit transcription consent, permission/recording/transcribing/success/failure states, 30-second limit, interruption cleanup, and native PCM WAV normalization for the existing /api/transcribe contract. Hausa transcription remains disabled.
- Declared expo-audio ~58.0.10 from installed Expo bundled-module metadata; installation and lockfile update are left to the user. No dependency upgrades, environment edits, commands, builds, emulator runs, or runtime tests performed. Static source inspection only; visual and device verification remain pending.

## WAV validation and answer-and-refine workflow — 27 October 2026

- Codex traced installed Expo native WAV finalization and confirmed the app awaits it before reading. Added finalized-metadata/byte consistency checks and non-silent PCM checks on Android and server, with aggregate-only diagnostics. Preserved Meta multipart WAV delivery. Empty transcript and unsupported response shapes now have distinct accurate errors; silence is rejected before upstream upload. No failing recording was available, so no claim is made that captured audio contains intelligible speech or that live transcription works.
- Added a dedicated /api/refine route for answers about the same observation, with bounded input validation, original context/photo, prior assessment, Q&A history, English/Hausa text, and the same assessment response structure. /api/followup remains the separate-visit photo comparison route.
- Added Android answer input, Update advice, offline answer saving, per-visit result selection, and dated persistent Q&A/revision history in existing SQLite JSON records. Pending answers survive failure and can be reopened; voice answers remain disabled until verified.
- Added focused endpoint and synthetic WAV/multipart tests. No commands, tests, builds, emulator, live API calls, dependency changes, or secret edits performed.

## Web farmer clarification conversation — 28 October 2026

- Added a web answer form and Update advice below the model question, using the existing shared /api/refine contract without changing server or mobile code. Preserved the separate /api/followup photo-visit flow.
- Added ordered per-visit Q&A history and revised assessments in IndexedDB, serialized draft saves, pending-turn retry, and per-visit casebook reopening. Fixed result lifecycle ordering that hid freshly returned advice and acknowledged writes only after transaction commit.
- Reused browser voice recording/transcription for editable English answers with destination/session tracking, consent, cancellation, and error handling. Hausa voice remains disabled; typed answers work in both interfaces. Escaped model and farmer text in rendered conversation content.
- Updated web documentation. No commands, tests, builds, emulator changes, secret access, or dependency changes performed. No web-specific test suite was present; browser behavior remains unverified.

## Web result-panel transition — 29 October 2026

- Codex identified author `display:flex` rules overriding the browser's `hidden` styles on the empty and loading states. Added a panel-scoped hidden rule so the result replaces those states visibly.
- Kept prior advice and clarification drafts visible when selecting a comparison photo, preparing a later visit, and on request failure. Successful diagnosis, comparison, and refinement focus and scroll the existing field-case panel, respecting reduced motion and resetting the advice scroll position. Removed the redundant casebook scroll call; retained the branding and separate visit/conversation workflows.
- Added `test_web_panel.mjs` and updated web documentation. Six success/failure workflow checks passed by executing JavaScript directly with simulated DOM, storage, and HTTP; static checks cover the CSS hidden rule and single result container. No shell commands, builds, emulator, live service calls, dependency changes, backend/Android edits, or secret access. Actual browser layout and IndexedDB verification remain pending.

## Optional web and Android extension-worker handoff — 29 October 2026

- Codex extended the existing saved-case share actions with farmer-readable review before sharing, visit/stage/context and clarification history, latest available guidance identified by visit, and an explicit uncertainty/optional-second-opinion note. Generation and review stay local and separate from AI diagnosis/refinement and photo visits.
- Web uses capability-checked native text/photo sharing plus copy, downloadable UTF-8 text, and manual selection fallback. Photo selection is optional and defaults to the latest supported saved photo only within the explicit photo-sharing action. Review content uses value/textContent, never model-provided HTML.
- Android uses a selectable-text review modal and the installed native text Share API. No local photo URI is sent through its unsupported Android URL path. Errors leave the preview available for retry or manual copy; no delivery claim is made.
- Added caseSharing.ts and test_case_sharing.mjs; updated web/mobile docs. Seven sharing fixture-test groups and six existing panel workflow checks passed through direct JavaScript execution. Installed Android TypeScript compiler API: zero diagnostics, no emit. Tests mock platform/storage/DOM behavior; real browser/device sheets, clipboard, photo targets and recipient delivery are not verified.
- No dependencies added or upgraded; no backend, environment, secret, database schema, or AI request changes. No shell commands, builds, emulator, or real case uploads.

## Save-first pending analysis on web and Android — 29 October 2026

- Codex changed web analysis to commit the case/photo to IndexedDB before sending; added local-only save, pending/error states, saved-photo/detail reopening and explicit retry. Sharing is available for offline cases too.
- Android now stores pending/error/complete metadata with each SQLite visit, preserves per-visit location, and uses a synchronous gate across save/copy/analysis. The new analysis helper loads stored photos and updates the same visit, merging with the latest saved case.
- Both platforms distinguish connection/timeout/interrupted-response failures from input/configuration/model errors, stop loading on completion/failure, validate returned advice, and never automatically upload or retry. Existing clarification and photo-visit history are retained.
- Expanded test_web_panel.mjs and added test_pending_android.mjs. Results: 10 web, 7 Android, and 7 sharing test groups passed; installed Android TypeScript compiler API returned no diagnostics with no emit. Tests use simulated DOM/storage/photo/network calls. Real IndexedDB/SQLite durability, restarts, live APIs, network interruptions and offline web-shell availability remain unverified.
- Updated web/mobile docs. No backend storage, environment/secret edits, dependency changes, shell commands, builds, or emulator runs.

## Offline checklist and farmer-controlled recheck reminders — 30 October 2026

- Codex added per-visit checklist snapshots of existing advice, with unchanged wording, To do/Done/Skipped states and short notes. Explicit local saves retain progress independently of later AI guidance and preserve visit/clarification history.
- Added case-level local recheck times, set/change/dismiss controls, due-first casebook ordering and same-case photo-follow-up links. Due checks run locally while open/on foreground return; no automatic photo visit, upload, AI call or backend reminder service.
- Web uses IndexedDB; Android uses existing SQLite JSON. Installed Android dependencies do not include expo-notifications, so the UI clearly provides in-app reminders only with no OS permission request or closed-app alert. No notification dependency was installed.
- Added mobile/caseActions.ts, mobile/CaseActionPanel.tsx and test_case_actions.mjs; updated web/Android integration, regression harnesses and documentation.
- Verification: 8 new action/reminder test groups plus 24 existing regression groups passed through direct JavaScript execution. Installed Android TypeScript compiler API: zero diagnostics, no emit. Tests use simulated local stores/DOM/platform calls; real browser/Android restart durability, timers, date controls and layout remain manual checks. Native notification permission/delivery was not implemented/tested. No shell commands, builds, emulator runs, backend/secret edits or dependency changes.
