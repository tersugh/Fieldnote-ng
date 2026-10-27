# Fieldnote Android app plan

## Product decision

Fieldnote is Android-first. The primary user is a Nigerian smallholder farmer using an affordable Android phone, often with limited storage, mobile data, and intermittent connectivity, and may have no access to timely agricultural support. Fieldnote must provide direct, usable crop recommendations that the farmer can act on independently. The current browser prototype proves the casebook and Meta API workflow; the Android application is the product target and must be clearly identified as new hackathon work.

## Proposed client and data flow

- **Client:** Expo + React Native + TypeScript, with Android as the first supported platform.
- **Local casebook:** SQLite on the phone for crop cases, dated observations, notes, AI responses, and sync state. Store photo files in app-private storage and keep paths/metadata in SQLite.
- **Offline capture:** allow farmers to save a draft and follow-up without internet. Queue analysis requests until the farmer chooses to send them while connected. Never silently upload photos or audio.
- **Low-data photo handling:** resize/compress photos on-device before storage and upload. Keep the resized copy as the case evidence to limit storage, memory, and data use. Make retries explicit and avoid re-uploading after a confirmed response.
- **Model/API boundary:** the Android app talks to the Fieldnote server over HTTPS. The Meta API key remains on the server; it is never bundled in the APK. The server invokes Meta models only after the farmer requests the relevant operation.
- **Language:** English and Hausa interface and text workflow. Voice transcription is English-only for this demo; Hausa notes can be typed. Hausa model wording requires fluent-speaker review.
- **Farmer field plan and optional sharing:** keep recommendations, warning signs, dated notes, photos, and outcomes together so the farmer can act and track progress independently. Provide a share action for a concise case summary when the farmer wants an extension worker's second opinion.

## Android farmer workflow

1. Open Fieldnote and choose English or Hausa.
2. Start a crop incident, take a photo or choose one, and record crop, growth stage, location, and observations.
3. Save the case locally, even if offline. If online, explicitly request a Muse Spark assessment.
4. Review the observations, plausible causes, uncertainty, and prioritized actions; retain the plan in the local case.
5. Return later to add a dated follow-up, even without a connection. When online, request a comparison of the earlier and current photos.
6. Review or print the farmer-facing field plan. If desired, share the case summary through Android's native share sheet (for example, to WhatsApp or SMS) to request a second opinion.

## Meta model placement

- **Muse Voice Transcribe:** transcribe an English voice note into an editable observation before submission.
- **Muse Spark:** assess the farmer-submitted image and context, then compare dated images for follow-up. It supplies crop-aware observations and prioritized farmer-directed recommendations, with uncertainty clearly stated; it does not claim a confirmed diagnosis.
- **SAM 3.1:** optional planned build for a farmer-selected image region, shown as a visual mask in the case. It must be implemented and tested before it is included in the hackathon demo; segmentation is not diagnosis.
- **No model call:** local saving, case timeline, and farmer field plan.

## Build order for the hackathon

1. Create the Android app shell and English/Hausa navigation.
2. Implement SQLite case creation and local photo storage; prove that saved cases survive app restarts and airplane mode.
3. Add camera/gallery selection and on-device image resizing/compression.
4. Connect an explicit online action to the existing secure server for Muse Spark assessment.
5. Add dated follow-ups and the Muse Spark photo-comparison request.
6. Add English voice transcription, printable farmer field plan, and farmer-controlled native case sharing.
7. Test on a low-memory Android device or emulator, including airplane mode, weak connectivity, and retry behavior.

The existing browser prototype remains a reference during migration. Do not present its browser-based IndexedDB storage as the Android app's offline implementation. Update the build log with dated evidence as each Android feature is completed, and demo only features that were actually built during the hackathon.

