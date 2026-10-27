import base64
import io
import json
import os
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from server import (
    InputError,
    build_multipart_audio,
    build_prompt,
    build_followup_prompt,
    decode_image_data_url,
    decode_wav_data_url,
    extract_output_text,
    localized_output_instruction,
    load_env_file,
    parse_assessment,
    request_assessment,
    request_followup_assessment,
)


class ServerHelpersTest(unittest.TestCase):
    def test_loads_env_file_without_overriding_existing_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                'FIELDNOTE_TEST_KEY="local value"\n'
                "FIELDNOTE_TEST_MODE=demo # comment\n"
                "FIELDNOTE_EXISTING=from-file\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"FIELDNOTE_EXISTING": "from-process"}, clear=False):
                self.assertTrue(load_env_file(env_path))
                self.assertEqual(os.environ["FIELDNOTE_TEST_KEY"], "local value")
                self.assertEqual(os.environ["FIELDNOTE_TEST_MODE"], "demo")
                self.assertEqual(os.environ["FIELDNOTE_EXISTING"], "from-process")

    def test_decodes_supported_image_data_url(self):
        raw = b"small-image-fixture"
        data_url = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
        mime, decoded = decode_image_data_url(data_url)
        self.assertEqual((mime, decoded), ("image/jpeg", raw))

    def test_rejects_unsupported_image_type(self):
        with self.assertRaises(InputError):
            decode_image_data_url("data:image/svg+xml;base64,PHN2Zy8+")

    def test_prompt_uses_crop_and_supplied_context(self):
        prompt = build_prompt("Cocoa", "yellow spots", "Flowering", "Ondo")
        self.assertIn("Farmer-selected crop: Cocoa", prompt)
        self.assertIn("Observed symptoms: yellow spots", prompt)
        self.assertIn("Growth stage: Flowering", prompt)
        self.assertIn("Farmer-provided area: Ondo", prompt)

    def test_followup_prompt_separates_previous_and_current_notes(self):
        prompt = build_followup_prompt("Yam", "Small yellow patches", "Patches now on three leaves", "Vegetative", "Benue")
        self.assertLess(prompt.index("Earlier field note"), prompt.index("Current field note"))
        self.assertIn("Farmer-selected crop: Yam", prompt)
        self.assertIn("Current growth stage: Vegetative", prompt)
        self.assertIn("Farmer-provided area: Benue", prompt)

    def test_model_output_language_instruction_supports_english_and_hausa(self):
        self.assertIn("simple Hausa", localized_output_instruction("ha"))
        self.assertIn("simple English", localized_output_instruction("en"))

    def test_initial_assessment_prompt_gives_farmer_direct_actions(self):
        captured = {}

        def fake_request(instructions, model_input):
            captured["instructions"] = instructions
            return {"ok": True}

        image = "data:image/jpeg;base64," + base64.b64encode(b"crop photo").decode()
        with patch("server.request_model", side_effect=fake_request):
            request_assessment(image, "Soybean", "yellow spots", "Flowering", "Benue")
        instructions = captured["instructions"]
        self.assertIn("Give the farmer useful guidance directly", instructions)
        self.assertIn("3 to 5 prioritized, specific, feasible actions", instructions)
        self.assertIn("urgency", instructions)
        self.assertNotIn("recommend a qualified local agronomist", instructions)

    def test_followup_prompt_updates_farmer_action_plan(self):
        captured = {}

        def fake_request(instructions, model_input):
            captured["instructions"] = instructions
            return {"ok": True}

        image = "data:image/jpeg;base64," + base64.b64encode(b"crop photo").decode()
        with patch("server.request_model", side_effect=fake_request):
            request_followup_assessment(image, image, "Soybean", "earlier spots", "more affected leaves", "Flowering", "Benue")
        instructions = captured["instructions"]
        self.assertIn("Give the farmer useful guidance directly", instructions)
        self.assertIn("based on the crop, notes, and visible change", instructions)
        self.assertIn("safe useful steps the farmer can take now", instructions)

    def test_extracts_responses_api_output_text(self):
        result = {"output": [{"content": [{"type": "output_text", "text": '{"ok": true}'}]}]}
        self.assertEqual(extract_output_text(result), '{"ok": true}')

    def test_validates_assessment_shape(self):
        assessment = {
            "visual_observations": "Spots are visible.", "possible_causes": [],
            "next_steps": ["Check nearby plants."], "urgency": "Act soon and watch for new affected leaves.",
            "follow_up_question": "Are more leaves affected?",
        }
        self.assertEqual(parse_assessment(__import__("json").dumps(assessment)), assessment)

    def test_decodes_wav_voice_note(self):
        audio = io.BytesIO()
        with wave.open(audio, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(b"\x00\x00" * 100)
        wav = audio.getvalue()
        data_url = "data:audio/wav;base64," + base64.b64encode(wav).decode()
        self.assertEqual(decode_wav_data_url(data_url), wav)

    def test_rejects_non_wav_voice_note(self):
        data_url = "data:audio/webm;base64," + base64.b64encode(b"RIFFxxxxWAVE").decode()
        with self.assertRaises(InputError):
            decode_wav_data_url(data_url)

    def test_builds_meta_voice_multipart_request(self):
        audio = b"RIFFxxxxWAVE"
        body = build_multipart_audio(audio, "test-boundary")
        self.assertIn(b'name="request"', body)
        self.assertIn(b'"model": "muse-voice-transcribe-1.0"', body)
        self.assertIn(b'name="audio"; filename="field-note.wav"', body)
        self.assertIn(audio, body)


if __name__ == "__main__":
    unittest.main()
