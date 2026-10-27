# Meta technology in Fieldnote

## Product promise

Fieldnote is an Android-first AI crop adviser for Nigerian smallholder farmers who may not have timely outside support. A farmer can submit a photo and farm context, receive direct crop-specific recommendations, save the plan, and return with new evidence to update the advice. If they want a second opinion, they can share a case summary with an extension worker. The target is expert-quality guidance a farmer can act on independently. That quality still has to be earned through authoritative local agronomy sources, fluent Hausa review, and field testing; this prototype is not yet validated at that level.

## Model-to-workflow map

| Farmer workflow | Meta technology | Input | Output and farmer value | Status / boundary |
| --- | --- | --- | --- | --- |
| Record an observation by voice | **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | English voice recording | Editable field note for the farmer to review before asking for advice. | Browser prototype only. Hausa speech transcription is not enabled. |
| Ask what may be affecting a crop | **Muse Spark** (`muse-spark-1.3`) | Crop photo, crop, growth stage, farmer notes, and area if known | Visible signs, ranked plausible causes, checks to distinguish them, prioritized actions, urgency, and one useful follow-up question. | Browser prototype implemented; Android request code is scaffolded but untested. Recommendations are AI-generated and need local source grounding and field validation. |
| Revisit and update the plan | **Muse Spark** (`muse-spark-1.3`) | Earlier and current photos plus dated notes | Describes supported changes, revisits likely causes, and recommends next actions based on the new evidence. | Browser prototype implemented; Android follow-up flow is incomplete. Not proof that an intervention caused a change. |
| Highlight the affected plant area | **SAM 3.1** (`sam-3-1`) — proposed | Farmer-selected point, box, or prompt on a photo | Segments the area the farmer wants advice about, helping focus the assessment. | Not implemented. Segmentation does not diagnose disease. |
| Save the farm history or share it by choice | No model call | Photos, notes, recommendations, dated follow-ups | Keeps the farmer's plan and progress together. A share action lets the farmer send a concise case summary to an extension worker if they choose. | Browser share/print actions implemented; Android native share-sheet code is scaffolded but untested. |

## Recommendation quality requirements

- Make the advice direct and useful even when no outside adviser is available. Keep an optional, farmer-controlled way to involve an extension worker for a second opinion.
- Separate what the photo shows from what may be causing it. Give likelihood qualitatively and say what evidence is missing.
- Give short, prioritized actions the farmer can take now, with alternatives that account for likely resource constraints. Ask a focused question if it would materially improve the recommendation.
- Ground crop-specific interventions in trustworthy Nigerian or regionally relevant agronomy references as that source library is built. Do not invent citations, local product names, pesticide mixtures, or doses. When crop-protection products are mentioned, direct the farmer to locally registered products and their label precautions.
- Track the farmer's follow-up evidence and whether the situation improved, worsened, or stayed unclear; use this evidence to update the next recommendation without claiming causation.
- Keep recommendations in clear English or Hausa. Hausa copy and model output need review by fluent Hausa-speaking farmers before reliability claims.

## Why these models

- **Muse Spark** interprets images with farm context and compares dated evidence, then turns that evidence into prioritized, farmer-directed recommendations.
- **Muse Voice Transcribe** lets farmers speak an English field note and review its transcript. It is not enabled for Hausa in this demo.
- **SAM 3.1** is a proposed visual focus tool. It can mark the area the farmer wants analyzed; it is not a disease classifier.
- **Muse Image** is out of scope because the app does not need generated images. **Muse Wonder** is out of scope because the current workflow does not need a larger general-purpose reasoning model.

## Demo sequence (only after each feature is built and checked)

1. Choose English or Hausa and capture a crop problem.
2. Submit a photo and field context; show Muse Spark's observations, plausible causes, uncertainty, and prioritized action plan.
3. Save the recommendations in the local casebook.
4. Return with a dated update; show a comparison and how the recommended next steps change.
5. Show the farmer's printable field plan.
6. If relevant, show the farmer choosing to share a summary with an extension worker.
7. Show SAM 3.1 only if the feature is implemented and tested during the event.

## Current implementation status

- Muse Spark initial crop assessment and dated-photo comparison: implemented in `server.py`; live API behavior still needs verification with the configured account.
- Muse Voice Transcribe English notes: implemented in `server.py` and `app.js`.
- English/Hausa interface and requested Muse Spark response language: implemented; Hausa quality review remains outstanding.
- Farmer-directed prioritized actions, urgency, and focused follow-up question: now specified in model prompts and UI; advice quality has not been field-validated.
- Optional extension-worker share action: implemented in browser with Web Share / clipboard fallback; native share-sheet code added to Android scaffold but not built or device-tested.
- SAM 3.1 segmentation: not implemented.
- Android client scaffold and local SQLite storage: added in `mobile/`; not installed, built, or tested on a device.
- Android voice transcription, complete follow-up flow, and printable field plan: not implemented. See [`ANDROID_APP_PLAN.md`](ANDROID_APP_PLAN.md).
