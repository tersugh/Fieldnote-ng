

## Product and scope

- Fieldnote is an Android-first AI crop adviser for Nigerian smallholder farmers who often have no access to timely agricultural support. Give farmers direct, practical recommendations they can act on independently and let them track progress with dated follow-ups. Preserve an easy, optional way to share a case with an extension worker when the farmer chooses.
- Demo language scope is English and Hausa. Hausa text and model output need fluent-speaker review; Muse Voice Transcribe is English-only in this release.
- Keep Android status, browser status, and planned work clearly distinct. Never claim a feature is implemented, field-tested, or live-verified unless it has been tested.
- Give prioritized, crop-aware actions directly to the farmer. State uncertainty plainly, ask focused questions when needed, and do not claim confirmed diagnoses or invent chemical mixtures/doses. Keep human support optional; the farmer may share the case for a second opinion.

## Hackathon constraints

- Event build window: 26 October–4 November 2026. Clearly log when and what was built in `HACKATHON_BUILD_LOG.md`.
- The public submission must show only work created during the event, identify contributions, use code/data/assets with rights, and include a three-minute demo.
- Avoid the disallowed generic project categories in the rules. The distinctive demo is a farmer-directed advice loop: photo/context → actionable recommendations → dated follow-up → updated recommendations.
- Do not include real farmer records, private farm photographs, API keys, or other secrets in Git.

## Architecture

- `server.py`: Python standard-library HTTP server and server-side Meta Model API calls. The key is read from the process environment or repository-root `.env`.
- `app.js`, `index.html`, `styles.css`: browser workflow prototype using IndexedDB.
- `mobile/`: Expo/React Native/TypeScript Android client. Device-local SQLite casebook and app-private photo storage. The current client scaffold is not yet built or device-tested.
- Meta API keys must stay on the server. Mobile `EXPO_PUBLIC_*` variables may contain the server URL only.
- Preserve explicit farmer consent before sending photos or audio to Meta. Keep local capture useful when model calls are unavailable.

## Change and verification practice

- Prefer small, integrated changes that extend the current farmer workflow.
- Update the relevant README or workflow document and add a dated build-log entry for substantive hackathon work.
- Run `python3 -m unittest -v`, `python3 -m py_compile server.py`, `node --check app.js`, and `git diff --check` when relevant.
- For Android changes, run the Expo typecheck/build and record device/emulator tests when the required tools are available. Do not treat Python tests as Android verification.
- Do not commit `.env`; `.env.example` is safe to publish.
