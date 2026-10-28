import base64
import io
import json
import os
import tempfile
import struct
import unittest
import wave
from pathlib import Path
from unittest.mock import patch, Mock

from server import (
    InputError,
    Handler,
    VoiceTranscriptionError,
    inspect_wav_audio,
    transcribe_audio,
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
            wav_file.writeframes(struct.pack("<hh", 1000, -1000) * 3000)
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


class RefineEndpointTest(unittest.TestCase):
    def setUp(self):
        self.assessment = {
            "visual_observations": "Yellow patches.", "possible_causes": [],
            "next_steps": ["Check nearby leaves."], "urgency": "Check today.",
            "follow_up_question": "Are younger leaves affected?",
        }
        self.payload = {
            "crop": "Soybean", "symptoms": "Yellow patches after rain", "stage": "Flowering", "location": "Benue",
            "image_data_url": "data:image/jpeg;base64," + base64.b64encode(b"synthetic-image").decode(),
            "previous_assessment": self.assessment, "question": self.assessment["follow_up_question"],
            "answer": "Only the oldest leaves.", "language": "en",
            "history": [{"question": "When did it start?", "answer": "Yesterday."}],
        }

    @staticmethod
    def post(payload, path="/api/refine"):
        handler = object.__new__(Handler)
        raw = json.dumps(payload).encode()
        handler.path = path
        handler.headers = {"Content-Length": str(len(raw))}
        handler.rfile = io.BytesIO(raw)
        handler.send_json = Mock()
        handler.log_error = Mock()
        handler.do_POST()
        return handler.send_json.call_args.args

    def test_refine_forwards_original_context_and_one_image(self):
        revised = {**self.assessment, "follow_up_question": "", "urgency": "Monitor tomorrow."}
        with patch("server.request_model", return_value=revised) as model, patch("server.request_followup_assessment") as visits:
            status, body = self.post(self.payload)
        self.assertEqual((status, body), (200, {"assessment": revised, "refinement": True}))
        visits.assert_not_called()
        instructions, messages = model.call_args.args
        self.assertIn("SAME saved observation", instructions)
        self.assertIn("not a comparison between photos", instructions)
        self.assertIn("Do not invent chemical", instructions)
        content = messages[0]["content"]
        self.assertEqual([item["type"] for item in content], ["input_text", "input_image"])
        context = json.loads(content[0]["text"])
        for key in ("crop", "stage", "location", "previous_assessment", "question", "answer"):
            self.assertEqual(context[key], self.payload[key])
        self.assertEqual(context["original_notes"], self.payload["symptoms"])
        self.assertEqual(context["earlier_answers"], self.payload["history"])
        self.assertEqual(content[1]["image_url"], self.payload["image_data_url"])

    def test_hausa_text_refinement_and_next_question(self):
        with patch("server.request_model", return_value=self.assessment) as model:
            status, body = self.post({**self.payload, "language": "ha"})
        self.assertEqual(status, 200)
        self.assertEqual(body["assessment"]["follow_up_question"], self.assessment["follow_up_question"])
        self.assertIn("simple Hausa", model.call_args.args[0])

    def test_rejects_invalid_inputs_before_model_call(self):
        invalid = [
            {"answer": " "}, {"answer": "x" * 1201}, {"crop": ""}, {"symptoms": 1},
            {"stage": []}, {"location": "x" * 101}, {"language": "fr"},
            {"image_data_url": "data:audio/wav;base64,AAAA"},
            {"previous_assessment": {}}, {"question": "A different question"},
            {"history": [{"question": "Q", "answer": "A"}] * 21},
            {"history": [{"question": "Q", "answer": 1}]},
            {"previous_assessment": {**self.assessment, "possible_causes": ["invalid"]}},
        ]
        for change in invalid:
            with self.subTest(change=list(change)), patch("server.request_model") as model:
                status, body = self.post({**self.payload, **change})
                self.assertEqual(status, 400)
                self.assertIn("detail", body)
                model.assert_not_called()

    def test_model_failure_does_not_claim_success(self):
        with patch("server.request_model", side_effect=RuntimeError("Could not reach Meta.")):
            status, body = self.post(self.payload)
        self.assertEqual(status, 502)
        self.assertNotIn("assessment", body)

    def test_malformed_revised_assessment_is_upstream_failure(self):
        with patch("server.request_model", return_value={"follow_up_question": "Only this field"}):
            status, body = self.post(self.payload)
        self.assertEqual(status, 502)
        self.assertIn("invalid structure", body["detail"])

    def test_followup_still_uses_separate_visit_comparison(self):
        payload = {**self.payload, "previous_image_data_url": self.payload["image_data_url"], "previous_note": "Earlier spots"}
        with patch("server.request_followup_assessment", return_value=self.assessment) as visits, patch("server.request_refinement") as refine:
            status, body = self.post(payload, "/api/followup")
        self.assertEqual(status, 200)
        self.assertTrue(body["comparison"])
        visits.assert_called_once()
        refine.assert_not_called()


class VoiceValidationTest(unittest.TestCase):
    @staticmethod
    def wav(rate=24000, channels=1, width=2, seconds=1, silent=False):
        output = io.BytesIO()
        with wave.open(output, "wb") as file:
            file.setnchannels(channels)
            file.setsampwidth(width)
            file.setframerate(rate)
            count = int(rate * seconds) * channels
            samples = b"\x00" * (count * width) if silent or width != 2 else b"".join(struct.pack("<h", 1000 if i % 2 else -1000) for i in range(count))
            file.writeframes(samples)
        return output.getvalue()

    def test_byte_metadata_for_supported_rates(self):
        for rate in (16000, 24000):
            with self.subTest(rate=rate):
                info = inspect_wav_audio(self.wav(rate=rate))
                self.assertEqual(info["sample_rate"], rate)
                self.assertEqual(info["duration_seconds"], 1)
                self.assertEqual(info["channels"], 1)
                self.assertEqual(info["sample_width_bits"], 16)
                self.assertTrue(info["non_silent"])
                self.assertGreater(info["rms"], 0)

    def test_rejects_empty_silent_short_long_and_unsupported_audio(self):
        fixtures = [self.wav(seconds=0), self.wav(silent=True), self.wav(seconds=0.1),
                    self.wav(seconds=31), self.wav(rate=44100), self.wav(channels=2), self.wav(width=1)]
        for index, raw in enumerate(fixtures):
            with self.subTest(index=index), self.assertRaises(InputError):
                inspect_wav_audio(raw)

    def test_rejects_truncated_audio_and_invalid_frame_layout(self):
        raw = self.wav()
        broken = bytearray(raw)
        struct.pack_into("<H", broken, 32, 4)
        for value in (raw[:-2], bytes(broken)):
            with self.assertRaises(InputError):
                inspect_wav_audio(value)

    def test_silence_is_rejected_before_meta(self):
        with patch("server.urlopen") as upstream, self.assertRaises(InputError):
            transcribe_audio(self.wav(silent=True))
        upstream.assert_not_called()

    def test_empty_transcript_distinct_from_missing_field(self):
        for result, code in (({"transcript": " "}, "transcript_empty"), ({"text": "different contract"}, "transcript_response_invalid")):
            response = Mock()
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            response.read.return_value = json.dumps(result).encode()
            with patch.dict(os.environ, {"MODEL_API_KEY": "synthetic-test-key"}), patch("server.urlopen", return_value=response):
                with self.assertRaises(VoiceTranscriptionError) as raised:
                    transcribe_audio(self.wav())
            self.assertEqual(raised.exception.code, code)
            self.assertTrue(raised.exception.audio_info["non_silent"])
            self.assertNotIn("quieter", str(raised.exception))

    def test_file_endpoint_receives_multipart_wav_not_base64(self):
        from email.parser import BytesParser
        from email.policy import default
        raw = self.wav()
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"transcript":"Yellow leaves"}'
        with patch.dict(os.environ, {"MODEL_API_KEY": "synthetic-test-key"}), patch("server.urlopen", return_value=response) as upstream:
            self.assertEqual(transcribe_audio(raw), "Yellow leaves")
        request = upstream.call_args.args[0]
        message = BytesParser(policy=default).parsebytes(("Content-Type: " + request.get_header("Content-type") + "\r\n\r\n").encode() + request.data)
        parts = list(message.iter_parts())
        self.assertEqual(len(parts), 2)
        self.assertEqual(json.loads(parts[0].get_payload(decode=True))["audioEncoding"], "WAV")
        self.assertEqual(parts[1].get_content_type(), "audio/wav")
        self.assertEqual(parts[1].get_payload(decode=True), raw)

    def test_hausa_voice_is_rejected(self):
        with patch("server.transcribe_audio") as transcribe:
            status, body = RefineEndpointTest.post({"language": "ha"}, "/api/transcribe")
        self.assertEqual(status, 400)
        self.assertIn("Hausa", body["detail"])
        transcribe.assert_not_called()


if __name__ == "__main__":
    unittest.main()
