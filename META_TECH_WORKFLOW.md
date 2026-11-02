# Meta technology in Fieldnote

Current status is audited in the [root README workflow table](README.md#current-workflow-and-meta-technology). “Implemented” refers to source code, not successful live-model or device verification. Older planning documents and dated build-log entries do not override current code.

| Technology | Current use | Status / boundary |
| --- | --- | --- |
| Muse Spark (`muse-spark-1.3` by default) | `/api/diagnose`: initial crop photo/context; `/api/followup`: previous/current photos; `/api/refine`: answer a clarification using the original visit, prior assessment and Q&A. | All three routes and both clients are implemented. New-photo visits and same-visit clarification are separate workflows. Client fixture tests pass; live responses and agronomic quality remain unverified. |
| Muse Voice Transcribe (`muse-voice-transcribe-1.0` by default) | `/api/transcribe`: English WAV → editable transcript. Server sends multipart WAV to Meta. | Implemented for web notes/answers and Android field notes. Android voice answers and all Hausa voice input are disabled. Hausa text is supported. Server validation tests exist; live capture/transcription is unverified. |
| SAM 3.1 (`sam-3-1`), proposed | Potential future visual mask for a farmer-selected affected area. | **Unimplemented.** No current segmentation endpoint or client/model call. A mask would not establish a disease diagnosis. |
| No model call | Local storage, offline save/manual retry controls, summary sharing, saved-action checklists and farmer-set reminders. | Implemented locally on both clients. Web sharing has native/copy/download options and optional supported photo sharing; Android native sharing is text only. Reminders are in-app only, with no closed-app Android notifications. Fixture tests pass; real device/storage/UI behavior remains unverified. |

Server defaults can be overridden by `MODEL_API_URL`/`MODEL_NAME` and `VOICE_API_URL`/`VOICE_MODEL_NAME`. `MODEL_API_KEY` stays on the server. These names describe the integration configured in the repository, not independently verified account access or model availability.

## Quality and demo boundaries

- Prompts request direct, crop-aware actions, uncertainty, distinguishing checks and urgency; they instruct against invented chemical mixtures/doses. Output quality and safety require local agronomic and farmer validation.
- English/Hausa text interfaces and requested output language are implemented; Hausa copy/output still need fluent-speaker review.
- Photo comparison is evidence review, not proof that an intervention caused an improvement.
- Optional extension-worker handoff is separate from AI guidance. Checklist actions reuse saved wording without generating new treatment instructions.
- Demonstrate live voice, device behavior or SAM only after that capability has actually been verified/implemented. Record evidence in [HACKATHON_BUILD_LOG.md](HACKATHON_BUILD_LOG.md).
