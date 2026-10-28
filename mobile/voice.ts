// Expo AudioStream writes PCM WAV; MediaRecorder's AAC/M4A is not accepted by /api/transcribe.
// Validate the actual file, downmix/resample hardware fallback rates, and cap at 30 seconds.
export type RecordingMetadata = {
  size: number; duration: number; sampleRate: number; channels: number; encoding: string;
};

export function prepareTranscriptionWav(buffer: ArrayBuffer, recording: RecordingMetadata): {
  dataUrl: string;
  info: { duration: number; sampleRate: number; channels: number; sampleWidth: number; peak: number; rms: number; sourceRate: number; sourceChannels: number };
} {
  const input = new DataView(buffer);
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (buffer.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('The recording is not valid WAV audio. Please record again.');
  }
  if (input.getUint32(4, true) + 8 !== buffer.byteLength || recording.size !== buffer.byteLength) {
    throw new Error('The recording size does not match its finalized WAV header. Please record again or type your note.');
  }
  let blockAlign = 0;
  let byteRate = 0;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  let format = 0;
  let dataOffset = 0;
  let dataLength = 0;
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const size = input.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > buffer.byteLength) throw new Error('The voice recording was interrupted. Please record again.');
    if (tag(offset) === 'fmt ' && size >= 16) {
      format = input.getUint16(start, true);
      channels = input.getUint16(start + 2, true);
      rate = input.getUint32(start + 4, true);
      bits = input.getUint16(start + 14, true);
      byteRate = input.getUint32(start + 8, true);
      blockAlign = input.getUint16(start + 12, true);
    } else if (tag(offset) === 'data') {
      dataOffset = start;
      dataLength = size;
    }
    offset = start + size + (size % 2);
  }
  if (format !== 1 || bits !== 16 || channels < 1 || channels > 2 || rate < 8000 || rate > 192000 || !dataOffset) {
    throw new Error('This recording format is unsupported. Use 16-bit PCM audio or type your observations.');
  }
  if (blockAlign !== channels * 2 || byteRate !== rate * blockAlign || dataLength % blockAlign !== 0) {
    throw new Error('The WAV frame layout is invalid. Record again or type your note.');
  }
  const frames = dataLength / blockAlign;
  if (recording.encoding !== 'int16' || recording.sampleRate !== rate || recording.channels !== channels
      || Math.abs(recording.duration - frames / rate) > 1 / rate) {
    throw new Error('The finalized recording metadata does not match the WAV bytes. Record again or type your note.');
  }
  if (frames < rate / 4) throw new Error('The recording is too short. Speak for at least a moment and try again.');
  const targetRate = 24000;
  const count = Math.min(targetRate * 30, Math.floor(frames * targetRate / rate));
  const output = new Uint8Array(44 + count * 2);
  const view = new DataView(output.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, 'RIFF'); view.setUint32(4, output.length - 8, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, count * 2, true);
  const sample = (frame: number) => {
    let value = 0;
    const index = Math.max(0, Math.min(frames - 1, frame));
    for (let channel = 0; channel < channels; channel++) value += input.getInt16(dataOffset + (index * channels + channel) * 2, true);
    return value / channels;
  };
  const ratio = rate / targetRate;
  let peak = 0;
  let squareSum = 0;
  let minimum = 32767;
  let maximum = -32768;
  for (let i = 0; i < count; i++) {
    const start = i * ratio;
    let value = 0;
    if (ratio > 1) {
      // Average the source interval when downsampling instead of dropping samples.
      const end = (i + 1) * ratio;
      for (let frame = Math.floor(start); frame < Math.ceil(end); frame++) {
        value += sample(frame) * (Math.min(end, frame + 1) - Math.max(start, frame));
      }
      value /= ratio;
    } else {
      const left = Math.floor(start);
      value = sample(left) + (sample(left + 1) - sample(left)) * (start - left);
    }
    const pcm = Math.max(-32768, Math.min(32767, Math.round(value)));
    view.setInt16(44 + i * 2, pcm, true);
    peak = Math.max(peak, Math.abs(pcm));
    squareSum += pcm * pcm;
    minimum = Math.min(minimum, pcm);
    maximum = Math.max(maximum, pcm);
  }
  if (peak === 0 || minimum === maximum) {
    throw new Error('The finalized WAV (' + (frames / rate).toFixed(2) + ' s, ' + rate + ' Hz, ' + channels + ' channel(s), 16-bit PCM) contains silence or a constant signal. Check microphone permission and, on an emulator, the host microphone input. Record again or type your note.');
  }
  const info = { duration: count / targetRate, sampleRate: targetRate, channels: 1, sampleWidth: 16,
    peak: peak / 32768, rms: Math.sqrt(squareSum / count) / 32768, sourceRate: rate, sourceChannels: channels };
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  let chunk = '';
  for (let i = 0; i < output.length; i += 3) {
    const a = output[i]; const b = output[i + 1] || 0; const c = output[i + 2] || 0;
    chunk += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)]
      + (i + 1 < output.length ? alphabet[((b & 15) << 2) | (c >> 6)] : '=')
      + (i + 2 < output.length ? alphabet[c & 63] : '=');
    if (chunk.length >= 8192) { chunks.push(chunk); chunk = ''; }
  }
  chunks.push(chunk);
  return { dataUrl: 'data:audio/wav;base64,' + chunks.join(''), info };
}
