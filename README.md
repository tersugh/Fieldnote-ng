# Fieldnote

**An Android-first AI crop adviser for Nigerian smallholder farmers.**

Fieldnote is an AI-powered crop adviser for Nigerian smallholder farmers who may have no access to timely agricultural support. A farmer shares a crop photo and field notes to receive understandable, prioritized recommendations they can act on independently, then tracks results over dated follow-ups. It is inspired by Albert's grandmother, a soybean farmer who faced losses when early signs did not lead to timely, useful help. The prototype supports Nigerian crops beyond soybean and has English and Hausa text interfaces.

> **Hackathon prototype:** The browser workflow is implemented. An Expo/React Native Android client scaffold is in progress and has not yet been built or tested on a phone. Live Meta API output and Hausa quality have not been field-validated. See the status below before treating a planned feature as complete.

## What it does

1. A farmer starts a crop incident with a photo and field notes.
2. When connected, Muse Spark uses the photo and farm context to explain visible signs, rank plausible causes, and give prioritized, practical next steps directly to the farmer.
3. The farmer saves the advice and case history on the device, including while offline.
4. On a later visit, Muse Spark compares earlier and current photos, updates the assessment, and helps the farmer decide what to do next.
5. If the farmer wants another opinion, they can share the case summary with an extension worker through the phone's share menu or print the full field plan.

The central feature is an **AI crop-advice loop**: observe, receive an actionable plan, follow progress, and adapt the next steps. Fieldnote gives direct support first; a farmer can choose to involve an extension worker whenever they want a second opinion. It communicates uncertainty, does not claim a confirmed diagnosis, and does not provide unsafe chemical mixtures or dosing.

## Meta models in the workflow

| Farmer workflow | Meta technology | Role | Status |
| --- | --- | --- | --- |
| English voice note | Muse Voice Transcribe | Turns speech into editable field notes for farmer review. | Browser prototype only. Hausa voice transcription is not enabled. |
| Initial photo and context | Muse Spark (`muse-spark-1.3`) | Explains visible signs, ranks plausible causes, and gives prioritized actions tailored to the crop, stage, notes, and area. | Implemented in browser prototype; Android request code is scaffolded but untested. |
| Dated follow-up photos | Muse Spark (`muse-spark-1.3`) | Compares earlier and current evidence, updates the assessment, and recommends what to do next; it notes when image differences limit comparison. | Implemented in browser prototype; Android follow-up flow is incomplete. |
| Focus on an affected plant area | SAM 3.1 (`sam-3-1`) | Planned: creates a visual mask for the area the farmer wants assessed. | Not implemented. Segmentation will not be presented as disease diagnosis. |
| Local crop casebook and optional sharing | No model call | Stores dated observations and recommendations locally. If the farmer chooses, shares a concise case summary through the device share menu; a printable field plan includes the photo timeline. | Browser share and print actions implemented; Android native share-sheet code is scaffolded but untested. |

Only English and Hausa are in the current demo scope. Muse Spark is prompted to answer in the chosen language, but Hausa output needs review by fluent speakers. Muse Voice Transcribe is currently used for English only. More detail is in [`META_TECH_WORKFLOW.md`](META_TECH_WORKFLOW.md).

## Current implementation status

- **Browser prototype:** crop incident form, photo and notes, English/Hausa interface, IndexedDB casebook, Muse Spark crop advice and follow-up comparison, English voice transcription, optional share-summary action, printable field plan.
- **Android client scaffold:** bilingual form, camera/gallery selection, on-device image resize/compression, SQLite case storage, app-private photo copies, explicit save and crop-advice actions, native share-sheet code.
- **Not yet verified:** Android install/build/device behavior, live Meta API requests, Hausa quality with farmers, and recommendation quality in real farm conditions.
- **Planned:** Android voice transcription, complete Android follow-up and field-plan flows, SAM 3.1 visual evidence, Android build/device testing.

The Android client uses Expo/React Native and Expo SDK 58. The [Expo SDK reference](https://docs.expo.dev/versions/v58.0.0/) lists Android 7 and later as supported. Read [`ANDROID_APP_PLAN.md`](ANDROID_APP_PLAN.md) and [`mobile/README.md`](mobile/README.md) before running it.

## Run the browser prototype

Requires Python 3.10 or newer; the server uses only the Python standard library.

```bash
cp .env.example .env
# Add MODEL_API_KEY to .env using your editor; never commit the file.
python3 server.py
```

Open <http://127.0.0.1:8000>. The server loads `.env`; environment variables already set in the process take precedence. Keep `MODEL_API_KEY` on the server. Never put it in the Android app or any `EXPO_PUBLIC_*` variable.

## Run the Android client

Requires Node.js 22.13 or newer and an Android 7+ device or emulator. Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to a server address reachable from the Android device. This variable is the server URL, not a secret. The Meta key stays in the server's root `.env`.

```bash
cd mobile
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_BASE_URL.
npm install
npm run android
```

The client saves crop notes and compressed photos locally before any model request. Meta analysis requires connectivity and an explicitly requested review. See the Android setup and limitations in [`mobile/README.md`](mobile/README.md).

## Checks

From the repository root:

```bash
python3 -m unittest -v
python3 -m py_compile server.py
node --check app.js
```

The Android client has not yet been type-checked or built in this workspace because Expo CLI and Android tooling are not installed here.

## Data and safety boundaries

- Crop cases and photos are stored on the farmer's device. The Fieldnote server does not retain case records.
- A photo or English voice recording is sent to Meta only after the farmer requests the related operation.
- No API secret is bundled in a browser or mobile client.
- Model output is AI-generated crop guidance, not a guaranteed diagnosis. It should explain uncertainty and offer the safest useful next action directly to the farmer. Any pesticide use must follow a locally registered product label; never infer or invent mixtures or doses. Field validation is still needed before claiming expert-level reliability.
- No private farm records, personal farm photos, or third-party datasets are included in this repository.

## Hackathon new-work record

This project began during the Meta Global AI Developer Hackathon on **26 October 2026**. The event rules require new work from 26 October to 4 November, a public repository, a three-minute demo, and clear identification of team contributions. See [`HACKATHON_BUILD_LOG.md`](HACKATHON_BUILD_LOG.md) for the dated contribution record and evidence checklist. Keep that log current and show only completed, event-built features in the demo.

## License

MIT. See [`LICENSE`](LICENSE).
