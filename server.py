"""Tiny standard-library server for the Fieldnote hackathon prototype."""
from __future__ import annotations

import base64
import binascii
import io
import json
import os
import re
import secrets
import wave
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent


def load_env_file(path: Path | None = None) -> bool:
    """Load simple KEY=VALUE settings without overriding process environment."""
    env_path = path or ROOT / ".env"
    if not env_path.is_file():
        return False
    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, separator, raw_value = line.partition("=")
        name = name.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            continue
        if name in os.environ:
            continue
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].rstrip()
        os.environ[name] = value
    return True


load_env_file()

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_BODY_BYTES = 24 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MODEL_API_URL = os.getenv("MODEL_API_URL", "https://api.meta.ai/v1/responses")
MODEL_NAME = os.getenv("MODEL_NAME", "muse-spark-1.3")
VOICE_API_URL = os.getenv("VOICE_API_URL", "https://api.meta.ai/v1/asr/transcribe")
VOICE_MODEL_NAME = os.getenv("VOICE_MODEL_NAME", "muse-voice-transcribe-1.0")


class InputError(ValueError):
    pass


def decode_image_data_url(value: object) -> tuple[str, bytes]:
    if not isinstance(value, str) or "," not in value:
        raise InputError("Upload a supported image to continue.")
    header, encoded = value.split(",", 1)
    mime_type = header.removeprefix("data:").removesuffix(";base64")
    if not header.endswith(";base64") or mime_type not in ALLOWED_MIME_TYPES:
        raise InputError("Use a JPG, PNG, or WebP image.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InputError("The image could not be read. Please upload it again.") from exc
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise InputError("Choose an image smaller than 8 MB.")
    return mime_type, raw


def decode_wav_data_url(value: object) -> bytes:
    if not isinstance(value, str) or "," not in value:
        raise InputError("Record a short voice note before transcribing.")
    header, encoded = value.split(",", 1)
    if header != "data:audio/wav;base64":
        raise InputError("Voice notes must be recorded as WAV audio.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InputError("The voice note could not be read. Please record it again.") from exc
    if len(raw) < 44 or len(raw) > MAX_AUDIO_BYTES:
        raise InputError("Record a voice note shorter than 30 seconds.")
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise InputError("The recording is not a valid WAV file.")
    try:
        with wave.open(io.BytesIO(raw), "rb") as wav_file:
            if wav_file.getnchannels() != 1 or wav_file.getsampwidth() != 2 or wav_file.getframerate() not in (16000, 24000):
                raise InputError("The voice note must be mono, 16-bit WAV audio at 16 or 24 kHz.")
    except (wave.Error, EOFError) as exc:
        raise InputError("The recording is not a valid WAV file.") from exc
    return raw


def build_multipart_audio(audio: bytes, boundary: str) -> bytes:
    request_part = json.dumps({
        "model": VOICE_MODEL_NAME,
        "audioEncoding": "WAV",
        "mode": "PUSH_TO_TALK",
    }).encode("utf-8")
    return b"".join([
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"request\"\r\nContent-Type: application/json\r\n\r\n".encode(),
        request_part,
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"field-note.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode(),
        audio,
        f"\r\n--{boundary}--\r\n".encode(),
    ])


def transcribe_audio(audio: bytes) -> str:
    api_key = os.getenv("MODEL_API_KEY")
    if not api_key:
        raise RuntimeError("The server is ready, but MODEL_API_KEY is not set. Add your Meta Model API key in the server environment.")
    boundary = f"Fieldnote{secrets.token_hex(16)}"
    request = Request(
        VOICE_API_URL,
        data=build_multipart_audio(audio, boundary),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise RuntimeError("Meta Voice Transcribe rejected the key. Check MODEL_API_KEY and account access.") from exc
        raise RuntimeError(f"Meta Voice Transcribe returned HTTP {exc.code}. Try again shortly.") from exc
    except (TimeoutError, URLError) as exc:
        raise RuntimeError("Could not reach Meta Voice Transcribe. Check the connection and retry.") from exc
    transcript = result.get("transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise RuntimeError("Meta Voice Transcribe returned no speech. Try recording again in a quieter place.")
    return transcript.strip()


def build_prompt(crop: str, symptoms: str, stage: str, location: str) -> str:
    context = [f"Farmer-selected crop: {crop}", f"Observed symptoms: {symptoms}"]
    if stage:
        context.append(f"Growth stage: {stage}")
    if location:
        context.append(f"Farmer-provided area: {location}")
    return "\n".join(context)


def build_followup_prompt(crop: str, previous_note: str, current_note: str, stage: str, location: str) -> str:
    context = [
        f"Farmer-selected crop: {crop}",
        f"Earlier field note: {previous_note}",
        f"Current field note: {current_note}",
    ]
    if stage:
        context.append(f"Current growth stage: {stage}")
    if location:
        context.append(f"Farmer-provided area: {location}")
    return "\n".join(context)


def extract_output_text(response: dict) -> str:
    chunks: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    if not chunks:
        raise RuntimeError("The model returned no analysis text.")
    return "\n".join(chunks)


def parse_assessment(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    data = json.loads(cleaned)
    required = {"visual_observations", "possible_causes", "next_steps", "urgency", "follow_up_question"}
    if not isinstance(data, dict) or not required.issubset(data):
        raise RuntimeError("The model response did not match the expected assessment format.")
    if not isinstance(data["possible_causes"], list) or not isinstance(data["next_steps"], list):
        raise RuntimeError("The model response had an invalid assessment structure.")
    return data


def localized_output_instruction(language: str) -> str:
    if language == "ha":
        return "Write every user-facing JSON value in simple Hausa (Latin script) that a Nigerian farmer can understand. Avoid mixing English unless a crop name has no common Hausa equivalent."
    return "Write every user-facing JSON value in clear, simple English suitable for a farmer."


def request_assessment(image_data_url: str, crop: str, symptoms: str, stage: str, location: str, language: str = "en") -> dict:
    instructions = (
        "You are Fieldnote, a practical AI crop adviser for Nigerian smallholder farmers who may have no access to extension workers. Give the farmer useful guidance directly; never make contacting an extension worker the required next step. Do not claim a confirmed diagnosis. "
        "The farmer identifies the crop; analyze only in relation to that crop and the submitted evidence. If the crop is unfamiliar or cannot be assessed reliably, say so and ask a clarifying question. "
        "Analyze visible evidence together with farmer notes. Separate observations from possible causes, provide no more than three plausible causes, "
        "and state likelihood as low, moderate, or high without inventing numeric confidence. Give 3 to 5 prioritized, specific, feasible actions the farmer can take, including practical prevention or treatment options when supported by the evidence. "
        "If evidence is ambiguous, explain what is uncertain, give safe useful steps the farmer can take now, and ask one focused question that would improve the advice. Do not invent local product names, chemical mixtures, or doses; if a pesticide is relevant, tell the farmer to use only a locally registered product and follow its label and protective precautions. "
        "Return only valid JSON with these keys: visual_observations (string), possible_causes (array of objects with name, likelihood, evidence, what_to_check), "
        "next_steps (array of prioritized strings), urgency (string describing how quickly the farmer should act and what warning signs to watch for), follow_up_question (string). Keep it concise and easy to understand. "
        + localized_output_instruction(language)
    )
    return request_model(instructions, [{"role": "user", "content": [
        {"type": "input_text", "text": build_prompt(crop, symptoms, stage, location)},
        {"type": "input_image", "image_url": image_data_url},
    ]}])


def request_followup_assessment(
    previous_image_data_url: str,
    current_image_data_url: str,
    crop: str,
    previous_note: str,
    current_note: str,
    stage: str,
    location: str,
    language: str = "en",
) -> dict:
    instructions = (
        "You are Fieldnote, a practical AI crop adviser for Nigerian smallholder farmers who may have no access to extension workers. Give the farmer useful guidance directly; never make contacting an extension worker the required next step. "
        "The user submits two photos of the same crop case: the first image is the earlier observation; the second is the current observation. "
        "Compare only visible differences that the images support. Different angles, lighting, distance, or plant parts can make comparison unreliable; state that limitation instead of claiming spread or improvement. "
        "Use the farmer's dated notes as context, but do not claim a confirmed diagnosis or causal treatment effect. "
        "Offer at most three plausible causes, each with low, moderate, or high likelihood and concrete evidence/checks. "
        "Give 3 to 5 prioritized actions based on the crop, notes, and visible change, including practical prevention or treatment options when supported by evidence. If uncertain, explain that clearly and still give safe useful steps the farmer can take now. Do not invent local product names, chemical mixtures, or doses; if a pesticide is relevant, tell the farmer to use only a locally registered product and follow its label and protective precautions. "
        "Return only valid JSON with the keys visual_observations (string describing change between visits), possible_causes (array of objects with name, likelihood, evidence, what_to_check), "
        "next_steps (array of prioritized strings), urgency (string describing how quickly the farmer should act and what warning signs to watch for), follow_up_question (string). Keep it concise and easy to understand. "
        + localized_output_instruction(language)
    )
    prompt = build_followup_prompt(crop, previous_note, current_note, stage, location)
    content = [
        {"type": "input_text", "text": prompt},
        {"type": "input_image", "image_url": previous_image_data_url},
        {"type": "input_image", "image_url": current_image_data_url},
    ]
    return request_model(instructions, [{"role": "user", "content": content}])


def request_model(instructions: str, model_input: list[dict]) -> dict:
    api_key = os.getenv("MODEL_API_KEY")
    if not api_key:
        raise RuntimeError("The server is ready, but MODEL_API_KEY is not set. Add your Meta Model API key in the server environment.")
    payload = {"model": MODEL_NAME, "instructions": instructions, "input": model_input}
    request = Request(
        MODEL_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise RuntimeError("Meta Model API rejected the key. Check MODEL_API_KEY and account access.") from exc
        raise RuntimeError(f"Meta Model API returned HTTP {exc.code}. Try again shortly.") from exc
    except (TimeoutError, URLError) as exc:
        raise RuntimeError("Could not reach Meta Model API. Check the connection and retry.") from exc
    return parse_assessment(extract_output_text(result))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'")
        super().end_headers()

    def do_POST(self) -> None:
        if self.path not in {"/api/diagnose", "/api/transcribe", "/api/followup"}:
            self.send_json(404, {"detail": "Route not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise InputError("Request is empty or too large. Choose an image under 8 MB.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise InputError("Request body must be a JSON object.")
            if self.path == "/api/transcribe":
                audio = decode_wav_data_url(payload.get("audio_data_url"))
                self.send_json(200, {"transcript": transcribe_audio(audio)})
                return
            if self.path == "/api/followup":
                previous_mime, previous_bytes = decode_image_data_url(payload.get("previous_image_data_url"))
                current_mime, current_bytes = decode_image_data_url(payload.get("image_data_url"))
                crop = payload.get("crop")
                previous_note = payload.get("previous_note")
                symptoms = payload.get("symptoms")
                language = payload.get("language", "en")
                if language not in ("en", "ha"):
                    raise InputError("Choose English or Hausa.")
                if not isinstance(crop, str) or not crop.strip() or len(crop) > 80:
                    raise InputError("Choose a crop or enter its name.")
                for note in (previous_note, symptoms):
                    if not isinstance(note, str) or not note.strip() or len(note) > 1200:
                        raise InputError("Add a short note for both observations before comparing them.")
                assessment = request_followup_assessment(
                    f"data:{previous_mime};base64,{base64.b64encode(previous_bytes).decode('ascii')}",
                    f"data:{current_mime};base64,{base64.b64encode(current_bytes).decode('ascii')}",
                    crop.strip(), previous_note.strip(), symptoms.strip(),
                    str(payload.get("stage", ""))[:60], str(payload.get("location", ""))[:100],
                    language,
                )
                self.send_json(200, {"assessment": assessment, "comparison": True})
                return
            mime_type, image_bytes = decode_image_data_url(payload.get("image_data_url"))
            symptoms = payload.get("symptoms")
            if not isinstance(symptoms, str) or not symptoms.strip() or len(symptoms) > 1200:
                raise InputError("Describe the change in 1–1,200 characters.")
            crop = payload.get("crop")
            if not isinstance(crop, str) or not crop.strip() or len(crop) > 80:
                raise InputError("Choose a crop or enter its name.")
            language = payload.get("language", "en")
            if language not in ("en", "ha"):
                raise InputError("Choose English or Hausa.")
            image_data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
            assessment = request_assessment(
                image_data_url,
                crop.strip(),
                symptoms.strip(),
                str(payload.get("stage", ""))[:60],
                str(payload.get("location", ""))[:100],
                language,
            )
            self.send_json(200, {"assessment": assessment})
        except InputError as exc:
            self.send_json(400, {"detail": str(exc)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"detail": "Request body must be valid JSON."})
        except RuntimeError as exc:
            self.send_json(502, {"detail": str(exc)})
        except Exception:
            self.log_error("Unexpected error while processing diagnosis request")
            self.send_json(500, {"detail": "The analysis failed unexpectedly. Please retry."})

    def send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"Fieldnote running at http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
