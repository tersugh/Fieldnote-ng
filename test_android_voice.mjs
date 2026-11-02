import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from './mobile/node_modules/typescript/lib/typescript.js';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const native = { exports: {} };
runInNewContext(compile(await readFile('mobile/voice.ts', 'utf8')), native);
const prepare = native.exports.prepareTranscriptionWav;
function wav(rate = 24000, seconds = 1, amplitude = 8000, channels = 1) {
  const frames = Math.floor(rate * seconds), bytes = Buffer.alloc(44 + frames * channels * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * channels * 2, 28); bytes.writeUInt16LE(channels * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) bytes.writeInt16LE(Math.round(amplitude * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + (i * channels + c) * 2);
  return { buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), metadata: { size: bytes.length, duration: frames / rate, sampleRate: rate, channels, encoding: 'int16' } };
}
for (const [rate, channels] of [[24000, 1], [48000, 1], [44100, 2], [16000, 1]]) {
  const fixture = wav(rate, 1, 8000, channels), result = prepare(fixture.buffer, fixture.metadata);
  const out = Buffer.from(result.dataUrl.split(',')[1], 'base64');
  assert.equal(out.readUInt32LE(24), 24000); assert.equal(out.readUInt16LE(22), 1); assert.equal(out.readUInt16LE(34), 16);
  assert.equal(out.readUInt32LE(40), 48000); assert.equal(result.info.duration, 1); assert.equal(result.info.tooQuiet, false);
  assert.ok(Math.abs(result.info.sourceRms - result.info.rms) < 0.001, 'No significant level loss from conversion');
  if (rate === 24000 && channels === 1) assert.deepEqual(out, Buffer.from(fixture.buffer), '24 kHz mono conversion is byte-identical');
}
const quiet = wav(24000, 30, 7), quietResult = prepare(quiet.buffer, quiet.metadata);
assert.equal(quietResult.info.tooQuiet, true); assert.equal(quietResult.info.trimmed, false);
assert.ok(quietResult.info.sourcePeak < 0.0003); assert.equal(quietResult.info.sourcePeak, quietResult.info.peak);
const long = wav(24000, 30.1); assert.equal(prepare(long.buffer, long.metadata).info.trimmed, true);
const silent = wav(24000, 1, 0); assert.throws(() => prepare(silent.buffer, silent.metadata), /silence/);
const valid = wav(); assert.throws(() => prepare(valid.buffer.slice(0, -2), valid.metadata), /size/);
assert.throws(() => prepare(valid.buffer, { ...valid.metadata, duration: 2 }), /metadata/);
const bad = valid.buffer.slice(0); new DataView(bad).setUint16(32, 4, true); assert.throws(() => prepare(bad, valid.metadata), /frame layout/);
console.log('PASS: WAV headers, levels, near-silence, same-rate PCM identity, hardware-rate conversion, truncation and final metadata');
const app = await readFile('mobile/App.tsx', 'utf8');
const handler = app.slice(app.indexOf('  async function finishVoice()'), app.indexOf('  async function startVoice()'));
let stopped = false, uploaded = 0, removed = 0, diagnostics = '', message = '', text = 'typed note';
let capture = quiet;
const context = {
  ...native.exports, voicePhase: { current: 'recording' }, voiceSession: { current: 1 }, voiceRequest: { current: null },
  clearVoiceTimers() {}, setVoiceState() {}, setVoiceMessage(value) { message = value; }, setVoiceDiagnostics(value) { diagnostics = value; },
  stream: { async stopFileRecordingAsync() { await Promise.resolve(); stopped = true; return { ...capture.metadata, uri: 'file:///cache/voice.wav' }; }, stop() {} },
  File: class { async arrayBuffer() { assert.equal(stopped, true); return capture.buffer; } },
  async fetch() { uploaded++; return { ok: true, json: async () => ({ transcript: 'synthetic test' }) }; },
  symptomsRef: { current: text }, setSymptoms(value) { text = value; }, API_BASE_URL: 'http://test.invalid',
  Error, AbortController, setTimeout, clearTimeout, async removeVoiceFile() { removed++; }, async setAudioModeAsync() {},
};
runInNewContext(compile(handler), context);
await context.finishVoice();
assert.equal(uploaded, 0); assert.equal(text, 'typed note'); assert.match(message, /not sent/); assert.match(diagnostics, /input too quiet/); assert.equal(removed, 1);
capture = wav(); stopped = false; context.voicePhase.current = 'recording';
await context.finishVoice();
assert.equal(uploaded, 1); assert.equal(text, 'typed note synthetic test'); assert.equal(removed, 2);
console.log('PASS: Actual stop handler awaits finalization, rejects quiet upload, retains typed notes and cleans up temporary recording');

context.voicePhase.current = 'recording';
context.stream.stopFileRecordingAsync = async () => { throw new Error('finalization failed'); };
await context.finishVoice();
assert.equal(uploaded, 1); assert.equal(removed, 3); assert.equal(context.voicePhase.current, 'idle');
assert.equal(text, 'typed note synthetic test'); assert.match(message, /finalization failed/);
console.log('PASS: Finalization failure prevents read/upload and preserves editable text');
