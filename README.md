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

## Web clarification conversation — 28 October 2026

Below an assessment question, type an answer and choose **Update advice**. This uses the existing POST /api/refine endpoint with the saved visit’s crop, image, original notes, stage, location, previous assessment, question, answer, language, and up to 20 completed earlier Q&A turns. The returned assessment replaces the displayed advice; another question allows another answer. This does not create a photo visit. **Add follow-up** continues to compare a new visit photo through /api/followup.

Drafts are saved in the existing IndexedDB case record as you type. Submitted turns retain the prior assessment, question, answer, date, and revised assessment. Use **View advice / answer question** for the relevant visit in the casebook to reopen its conversation after reloading. A failed request keeps the current advice and draft; retrying reuses the pending turn. If browser storage fails, the draft stays visible and the app reports that it was not saved. IndexedDB writes are now acknowledged only after transaction commit.

The optional English voice button uses the same browser recording, WAV conversion, and /api/transcribe flow as field notes. It asks permission to send audio, appends editable text to the chosen field, and leaves typed text intact on failure. Switching cases or languages cancels the old recording/transcription session so a late transcript cannot enter another answer. Hausa speech remains unverified and disabled; Hausa typed answers remain available. Model questions, answers, and revised advice are escaped before HTML rendering.

At implementation on 28 October, no web-specific test suite was present and no commands or browser tests were run. Remaining manual checks include two successive answers, reload and reopen an earlier visit, English voice editing and failure, Hausa typed answers, and literal rendering of text containing HTML.

### Web field-case panel transition — 29 October 2026

Diagnosis, photo comparison, and Update advice now replace the advice in the existing field-case panel and scroll/focus that panel on success. The branding stays in place. Panel elements with `hidden` stay hidden even when their CSS uses flex layout, so the empty illustration and spinner cannot remain above the result. Selecting a comparison photo and failed requests preserve the previous assessment and clarification answer. Photo comparisons remain separate visits; clarification answers revise their existing visit.

`test_web_panel.mjs` is a dependency-free regression suite runnable with `node test_web_panel.mjs`. Six workflow checks passed through direct JavaScript execution with simulated DOM, storage, and HTTP: success and failure for initial diagnosis, comparison, and clarification (including retry and separate history). The suite also checks the hidden-state CSS rule and the single result container. It does not verify browser layout, actual IndexedDB, or live API responses. In a browser, verify that the spinner disappears and the latest advice comes into view in all three workflows, including on a narrow screen and with reduced motion enabled.

## Optional extension-worker sharing — 29 October 2026

Choose **Share with extension worker** on a saved case to review a locally generated summary before opening share options. It includes crop, optional area/stage, each saved visit and farmer observation, submitted clarification Q&A (pending advice is labelled), the current question, and the latest available AI guidance. Guidance is labelled with its visit; a newer offline note does not make older guidance appear current. AI guidance is explicitly uncertain, and sharing is an optional second opinion, separate from diagnosis and photo comparison.

Web offers native text sharing when available, plus Copy summary and a UTF-8 text download. Clipboard denial leaves the review selectable for manual copying. Supported saved photos can be selected by visit and shared with the summary through a separate optional button only when the browser reports file-sharing support. Text-only sharing stays available if photo sharing fails. Cancellation keeps the review and saved case intact. Fieldnote makes no network request for this action; the farmer chooses the recipient in their selected app.

Android reviews the same summary in a modal with selectable text, then uses the installed React Native Share API. That Android API supports text but not a local photo attachment, so photos are intentionally omitted and the review explains this. Failed sharing leaves the summary available to retry or copy manually. Neither platform reports confirmed delivery.

Verification: seven fixture-test groups in `test_case_sharing.mjs` passed through direct JavaScript execution, covering both summary implementations, missing fields, Hausa parity, literal rendering, capability checks, native-share payloads, cancellation/errors, copy, download, and review-before-sharing. The six existing panel workflow checks passed. Android TypeScript checked through the installed compiler API with no diagnostics and no emitted files. Tests use mocked DOM/platform calls, not actual browser/Android UI. No new dependencies, backend changes, uploads, shell commands, builds, or emulator runs.

To rerun locally: `node test_case_sharing.mjs` (uses the already installed mobile TypeScript package) and `node test_web_panel.mjs`. Device/browser checks still needed: review a multi-visit case; cancel and retry the native sheet; inspect the received text; test web clipboard denial and download; test a supported web photo target; on Android long-press the summary to copy. Native share completion does not establish recipient delivery.

## Save now, retry analysis later — 29 October 2026

Web now has **Save on this device — analyze later**. This commits the selected photo Blob and all entered details to the existing IndexedDB casebook without sending a request. The analysis action also saves first, before sending anything. Saved visits without advice show **Pending analysis**, **View saved details**, and **Retry analysis**. The details view includes the stored photo, notes, stage, and area. Offline visits can also be shared with an extension worker without first obtaining AI advice.

Retry reads that saved visit, sends its stored context/photo (and the immediately preceding photo/note for a comparison), and updates the same visit rather than appending another. The API result determines success; an offline browser hint does not prevent an explicit retry. There are no online-event listeners, background jobs, or automatic uploads/retries. A request timeout or connection/interrupted-response failure leaves the saved visit pending. Invalid input, unreadable photos, configuration problems, malformed responses, and model/service failures are distinct needs-attention errors, not labelled offline. All retries remain manual.

Android uses the same workflow with SQLite JSON records and app-private photos. Saving copies the photo before committing the visit. Both platforms preserve clarification and separate-visit history, use synchronous operation guards against rapid duplicate taps, and re-read the saved case before merging advice. Old visits without advice are treated as pending without a database schema migration.

Verification: 10 web workflow groups, 7 Android workflow groups, and 7 sharing regression groups passed by direct JavaScript execution. They exercise offline saving, reopening with a fresh app context, retry success/failure, interrupted/malformed responses, rapid duplicate taps, same-visit updates, comparison and clarification preservation, and sharing. Android TypeScript checked through the installed compiler API: zero diagnostics, no emit. Run locally with `node test_web_panel.mjs`, `node test_pending_android.mjs`, and `node test_case_sharing.mjs`.

These tests simulate IndexedDB/SQLite, photo I/O and HTTP; they do not establish physical device/browser durability. Still verify: save offline, close/reopen, inspect the stored photo/details, explicitly retry after restoring connectivity, interrupt a request, and confirm no duplicate visit or automatic upload. Actual storage quota failures, private-photo access after Android restart, live service responses and offline web-shell loading remain unverified. No backend case storage, dependency change, API-key access, shell commands, builds, or emulator runs were added/performed.
