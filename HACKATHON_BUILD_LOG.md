# Hackathon Build Log

## Project start — 26 October 2026

**Starting point:** blank project directory created for this event.  
**Problem:** soybean farmers can notice disease symptoms early but still lose crops when timely, understandable support is hard to reach. This is grounded in Albert's family experience with his grandmother's soybean farm.  
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
