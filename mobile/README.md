# Fieldnote Android client

This is the Android-first React Native client. It targets affordable Android phones and keeps crop records on the device so farmers can capture evidence without a live connection.

## Current slice

- English/Hausa app interface.
- Crop incident and follow-up note form.
- Camera or gallery photo selection, resized to a maximum 1600-pixel edge and compressed as JPEG, then copied into app-private storage.
- SQLite casebook that survives app restarts.
- Explicit save-on-device and get-crop-advice actions.
- Muse Spark first-assessment and follow-up API payloads. The API key is not included in this app.

## Run

Requires Node.js 22.13 or newer and an Android 7+ device/emulator. Expo SDK 58 is paired with React Native 0.88; see the [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/).

```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_BASE_URL to the HTTPS server address.
npm install
npm run android
```

The server must be reachable from the phone. Do not put `MODEL_API_KEY` in this app or in `EXPO_PUBLIC_*`; configure it only in the server environment.

## Offline and data behavior

- Saving a field note writes its crop record to SQLite and copies its photo into app-private storage.
- Requesting crop advice is a separate user action. The image is sent to the server only after that action.
- If the network request fails, the local observation remains saved. The farmer can retry from the casebook.
- Photos are resized and compressed on-device before storage or upload to limit mobile data and peak memory use.

## Current limitations

- This initial client has not yet been built or tested on a physical Android phone or emulator.
- Android voice recording/transcription, full follow-up visit UI, farmer field-plan export, and photo compression benchmarks remain to be built and tested.
- Hausa UI and model output need fluent-speaker review. Voice transcription remains English-only.
- A configured HTTPS API endpoint is required for Meta analysis. Model analysis is not available offline.

