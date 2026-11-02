// Generates real PDF bytes with synthetic images; native adapters remain mocked.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { deflateSync, inflateSync } from 'node:zlib';
import ts from './mobile/node_modules/typescript/lib/typescript.js';
const require = createRequire(import.meta.url);
globalThis.pdfMake = require('./vendor/pdfmake/pdfmake.min.js');
globalThis.pdfMake.addVirtualFileSystem(require('./vendor/pdfmake/vfs_fonts.js'));
const pdf = require('./case-pdf.js');
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const native = { exports: {} };
runInNewContext(compile(await read('mobile/casePdf.ts')), native);
const summaryModule = { exports: {} };
runInNewContext(compile(await read('mobile/caseSharing.ts')), summaryModule);

// A rights-free synthetic leaf pattern, encoded as RGB PNG using only Node APIs.
function png(yellow = false) {
  const width = 480, height = 300, raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const leaf = ((x - 240) / 160) ** 2 + ((y - 150) / 110) ** 2 < 1;
    const color = leaf ? (Math.abs(y - 150) < 3 ? [90, 120, 50] : yellow ? [180, 170, 55] : [60, 120, 65]) : [245, 243, 230];
    const offset = y * (1 + width * 3) + 1 + x * 3;
    color.forEach((value, i) => { raw[offset + i] = value; });
  }
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const head = Buffer.alloc(4), tail = Buffer.alloc(4);
    head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const images = [png(), png(true)].map(bytes => 'data:image/png;base64,' + bytes.toString('base64'));
const unsafe = '<script>alert("farmer & model")</script>';
const record = { id: 'fixture/../case', crop: 'Maize', location: 'Synthetic fixture area', observations: [
  { date: '2026-10-28T12:00:00Z', stage: 'Flowering', symptoms: 'Lower leaves look pale. ' + unsafe, photo: 0, photoUri: 'file:///private/photos/first.jpg', refinements: [{ question: 'Which leaves?', answer: 'Lower leaves', assessment: {} }], assessment: { visual_observations: 'Colour change visible', next_steps: ['Inspect leaves and soil.'], follow_up_question: 'Has it spread?' } },
  { date: '2026-10-29T12:00:00Z', symptoms: 'Missing local photo', photo: null, photoUri: 'https://external.invalid/photo.jpg' },
  { date: '2026-10-30T12:00:00Z', symptoms: 'New observation', photo: 1, photoUri: 'file:///private/photos/last.jpg', assessment: { visual_observations: 'Latest fixture guidance', next_steps: ['Compare the new leaves.'], urgency: 'Monitor', follow_up_question: 'Any further change?' } },
] };
const before = JSON.stringify(record);
const summary = summaryModule.exports.buildCaseSummary(record) + '\nHausa characters: ƙ ɗ ɓ Ƙ Ɗ Ɓ.\n' + Array.from({ length: 35 }, (_, i) => `Additional fixture note ${i + 1}: This paragraph tests readable wrapping and page breaks without truncating the report.`).join('\n');
const readPhoto = async key => { if (key === null) throw new Error('Missing'); return images[key]; };
const { definition, missing } = await pdf.documentDefinition(record, summary, 'en', readPhoto);
assert.equal(missing, 1);
assert.equal(definition.content[1].text, summary);
assert.deepEqual(definition.content.filter(item => item.pageBreak).map(item => item.text), ['Visit 1 · 2026-10-28', 'Visit 2 · 2026-10-29', 'Visit 3 · 2026-10-30']);
assert.equal(definition.content.filter(item => item.image).length, 2);
assert.ok(definition.content.filter(item => item.image).every(item => item.image.startsWith('data:image/png;base64,')));
const generated = await pdf.create(record, summary, 'en', readPhoto);
const bytes = Buffer.from(await generated.file.arrayBuffer());
assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
assert.equal(generated.file.type, 'application/pdf');
assert.match(generated.file.name, /^fieldnote-Maize-[a-z-]+\.pdf$/);
assert.equal(generated.missing, 1);
assert.equal((bytes.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length, 2);
assert.doesNotMatch(bytes.toString('latin1'), /\/URI\b|\/JavaScript\b|external\.invalid/);
const unicodeMaps = [];
for (const match of bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  try {
    const data = inflateSync(Buffer.from(match[1], 'latin1')).toString();
    if (data.includes('begincmap')) unicodeMaps.push(data.toLowerCase());
  } catch { /* Not every PDF stream uses Flate compression. */ }
}
for (const char of 'ƙɗɓƘƊƁ') assert.ok(unicodeMaps.some(map => map.includes('<' + char.codePointAt(0).toString(16).padStart(4, '0') + '>')), `Missing Hausa glyph mapping: ${char}`);
const maliciousPhoto = await pdf.documentDefinition({ observations: [{ photo: 'https://remote.invalid' }] }, 'Fixture', 'en', async value => value);
assert.equal(maliciousPhoto.missing, 1);
assert.equal(JSON.stringify(record), before);
if (process.argv[2]) await writeFile(process.argv[2], bytes);
console.log('PASS: Real PDF bytes contain two embedded image objects, all summary text, ordered dated photo pages and a missing-photo placeholder');

const htmlReport = await native.exports.casePdfHtml(record, summary, 'en', async uri => {
  if (!uri.startsWith('file:')) throw new Error('Not local');
  return images[uri.includes('first') ? 0 : 1];
});
assert.equal(htmlReport.missing, 1);
assert.ok(htmlReport.html.indexOf('Visit 1') < htmlReport.html.indexOf('Visit 2'));
assert.ok(htmlReport.html.indexOf('Visit 2') < htmlReport.html.indexOf('Visit 3'));
assert.equal((htmlReport.html.match(/<img src="data:image\/png;base64,/g) || []).length, 2);
assert.match(htmlReport.html, /&lt;script&gt;alert\(&quot;farmer &amp; model&quot;\)&lt;\/script&gt;/);
assert.doesNotMatch(htmlReport.html, /<script>|src="https?:|src="file:/);
const badHtml = await native.exports.casePdfHtml({ observations: [{ photoUri: 'x' }] }, 'Text', 'ha', async () => 'https://remote.invalid');
assert.equal(badHtml.missing, 1);
assert.match(badHtml.html, /Ba a samu hoton/);
console.log('PASS: Android HTML embeds local images only, escapes farmer/model text and labels missing images');

// Exercise App's actual confirmation handler: no generation before confirmation,
// no duplicate generation, and the cached PDF is retained after share failure.
const app = await read('mobile/App.tsx');
let printCalls = 0, shareCalls = 0, failed = true, status = '', busy = false, release;
const wait = new Promise(resolve => { release = resolve; });
const copiedFiles = new Map();
const ctx = {
  Platform: { OS: "android" },
  ...native.exports, sharePreview: summary, shareRecord: { current: record }, shareLanguage: { current: 'en' }, sharePdf: { current: null }, sharePending: { current: false }, language: 'en',
  setSharing: value => { busy = value; }, setShareStatus: value => { status = value; },
  Sharing: { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { shareCalls++; assert.match(uri, /\.pdf$/); assert.equal(options.mimeType, 'application/pdf'); assert.equal(options.UTI, undefined); assert.match(uri, /fieldnote-case-/); if (failed) throw new Error('Cancelled or unavailable'); } },
  FileSystem: { documentDirectory: 'file:///private/', cacheDirectory: 'file:///cache/', getInfoAsync: async uri => ({ exists: true, size: copiedFiles.get(uri) ?? 100 }), writeAsStringAsync: async (uri, bytes, options) => { assert.match(uri, /^file:\/\/\/cache\/fieldnote-case-/); assert.equal(options.encoding, "base64"); copiedFiles.set(uri, Buffer.from(bytes, "base64").length); }, EncodingType: { Base64: "base64" }, readAsStringAsync: async () => { throw { code: "ERR_UNEXPECTED" }; }, moveAsync: async () => {}, deleteAsync: async () => {} },
  FileMode: { ReadOnly: 'r' },
  File: class { constructor(uri) { assert.equal(uri, 'file:///cache/generated.pdf'); } open(mode) { assert.equal(mode, 'r'); return { readBytes: async length => { assert.equal(length, 5); return Uint8Array.from([37, 80, 68, 70, 45]); }, close() {} }; } },
  ImageManipulator: { manipulate: uri => { assert.ok(uri.startsWith('file:///private/')); return { renderAsync: async () => ({ saveAsync: async () => ({ base64: 'AQID', uri: 'file:///cache/image.jpg' }), release() {} }), release() {} }; } }, SaveFormat: { JPEG: 'jpeg' },
  printToFileAsync: async options => { printCalls++; assert.match(options.html, /data:image\/jpeg;base64,AQID/); assert.doesNotMatch(options.html, /<script>|src="https?:/); await wait; assert.equal(options.base64, true); return { uri: 'file:///cache/generated.pdf', numberOfPages: 3, base64: Buffer.from('%PDF-1.7').toString('base64') }; },
};
runInNewContext(compile(app.slice(app.indexOf('  async function confirmShare'), app.indexOf('\n  return (', app.indexOf('  async function confirmShare')))), ctx);
assert.equal(printCalls, 0);
const operation = ctx.confirmShare(); await ctx.confirmShare();
await new Promise(resolve => setImmediate(resolve));
assert.equal(printCalls, 1); assert.equal(busy, true);
release(); await operation;
assert.equal(busy, false); assert.match(status, /Try again/);
assert.ok(ctx.sharePdf.current.uri);
failed = false; await ctx.confirmShare();
assert.equal(printCalls, 1); assert.equal(shareCalls, 2);
assert.match(status, /Delivery is not confirmed/);
ctx.FileSystem.getInfoAsync = async () => ({ exists: false });
await ctx.confirmShare();
assert.equal(printCalls, 2, 'Regenerate a PDF evicted from the OS cache');
assert.equal(JSON.stringify(record), before);
console.log('PASS: Android confirmation generates once, shares application/pdf, preserves case and cached PDF on failure/cancellation, and allows retry');

const valid = { uri: 'file:///cache/generated.pdf', numberOfPages: 3 };
const info = async () => ({ exists: true, size: 100 });
const signature = async () => '%PDF-';
assert.equal(await native.exports.validateCasePdf(valid, info, signature), valid.uri);
for (const result of [{}, { uri: valid.uri }, { ...valid, numberOfPages: 0 }, { ...valid, uri: 'https://remote.invalid/a.pdf' }]) {
  await assert.rejects(native.exports.validateCasePdf(result, info, signature), /invalid-print-result/);
}
await assert.rejects(native.exports.validateCasePdf(valid, async () => ({ exists: false }), signature), /missing-pdf-file/);
await assert.rejects(native.exports.validateCasePdf(valid, info, async () => 'broken'), /invalid-pdf-signature/);
assert.equal(await native.exports.shareCasePdf(valid.uri, async () => { throw { name: 'AbortError' }; }), 'cancelled');
assert.equal(await native.exports.shareCasePdf(valid.uri, async () => { throw { code: 'ERR_CANCELED' }; }), 'cancelled');
assert.equal(native.exports.pdfFailureDetail({ code: 'ERR_PDF_WRITE', message: 'private content' }), 'ERR_PDF_WRITE');
assert.equal(native.exports.pdfFailureDetail({ message: 'private content' }), 'native-error');
ctx.sharePdf.current = null;
ctx.printToFileAsync = async () => ({ uri: valid.uri, numberOfPages: 0 });
await ctx.confirmShare();
assert.match(status, /PDF generation did not complete.*validate/);
assert.equal(ctx.sharePdf.current, null);
assert.equal(busy, false);
console.log('PASS: Android PDF result, file and signature validation; cancellation and safe phase diagnostics');

// SDK 58 print output has uri + numberOfPages; base64 is optional.
for (const output of [valid, { ...valid, base64: '' }]) {
  const phases = [];
  assert.equal(await native.exports.validateCasePdf(output, async uri => ({ exists: true, uri, isDirectory: false, size: 1234, modificationTime: 1793560000 }), signature, phase => phases.push(phase)), valid.uri);
  assert.deepEqual(phases, ['validate-uri', 'validate-pages', 'validate-file-info', 'validate-size', 'validate-signature']);
}
for (const [output, inspect, read, expected] of [
  [null, info, signature, 'validate-uri'],
  [{ ...valid, uri: 42 }, info, signature, 'validate-uri'],
  [{ ...valid, uri: 'file://remote/a.pdf' }, info, signature, 'validate-uri'],
  [{ ...valid, numberOfPages: 1.5 }, info, signature, 'validate-pages'],
  [valid, async () => { throw { code: 'ERR_UNEXPECTED' }; }, signature, 'validate-file-info'],
  [valid, async () => ({ exists: false, isDirectory: false }), signature, 'validate-file-info'],
  [valid, async () => ({ exists: true, isDirectory: true, size: 100 }), signature, 'validate-file-info'],
  ...[undefined, NaN, Infinity, -1, 0, 4].map(size => [valid, async () => ({ exists: true, size }), signature, 'validate-size']),
  [valid, info, async () => { throw { code: 'ERR_UNEXPECTED' }; }, 'validate-signature'],
  [valid, info, async () => 'not-pdf', 'validate-signature'],
]) {
  let phase;
  await assert.rejects(native.exports.validateCasePdf(output, inspect, read, value => { phase = value; }));
  assert.equal(phase, expected);
}
console.log('PASS: SDK print/file-info shapes and distinct URI/pages/file-info/size/signature diagnostics');


// Expo Print supplies bytes of its own file; scoped File.open must never run.
const printBytes = Buffer.from('%PDF-1.7\nsynthetic fixture').toString('base64');
assert.equal(native.exports.readPdfSignature(printBytes), '%PDF-');
assert.equal(native.exports.readPdfSignature(Buffer.from('%PDF-').toString('base64')), '%PDF-');
for (const data of [undefined, null, '', 'JVBE', '!!!!!!!!', 'data:application/pdf;base64,' + printBytes]) {
  assert.throws(() => native.exports.readPdfSignature(data), /invalid-pdf-signature/);
}
ctx.File = class { constructor() { throw { code: 'ERR_INVALID_PERMISSION' }; } };
ctx.FileSystem.getInfoAsync = async uri => ({ exists: true, size: copiedFiles.get(uri) ?? 100 });
ctx.sharePdf.current = null;
ctx.printToFileAsync = async options => { assert.equal(options.base64, true); return { ...valid, base64: printBytes }; };
await ctx.confirmShare();
assert.equal(ctx.sharePdf.current.originalUri, valid.uri);
assert.notEqual(ctx.sharePdf.current.uri, valid.uri);
assert.match(status, /Delivery is not confirmed/);
for (const data of [undefined, '', Buffer.from('NOT A PDF').toString('base64')]) {
  ctx.sharePdf.current = null;
  ctx.printToFileAsync = async () => ({ ...valid, base64: data });
  const sharesBeforeFailure = shareCalls;
  await ctx.confirmShare();
  assert.match(status, /validate-signature: invalid-pdf-signature/);
  assert.equal(shareCalls, sharesBeforeFailure);
  assert.equal(ctx.sharePdf.current, null);
  assert.equal(busy, false);
  assert.equal(ctx.sharePending.current, false);
  assert.equal(ctx.sharePreview, summary);
  assert.equal(JSON.stringify(record), before);
}
console.log('PASS: Print-owned base64 validation bypasses scoped File.open, retains original URI, and rejects missing/invalid signatures without changing case/review');

let args;
await native.exports.shareCasePdf('file:///project/cache/report.pdf', async (uri, options) => { args = { uri, options }; }, 'android');
assert.equal(args.uri, 'file:///project/cache/report.pdf');
assert.deepEqual(JSON.parse(JSON.stringify(args.options)), { mimeType: 'application/pdf', dialogTitle: 'Fieldnote case PDF' });
await native.exports.shareCasePdf(args.uri, async (uri, options) => { assert.deepEqual(JSON.parse(JSON.stringify(options)), { UTI: 'com.adobe.pdf' }); }, 'ios');
for (const uri of ['https://example.invalid/a.pdf', 'content://a', '/cache/a.pdf']) await assert.rejects(native.exports.shareCasePdf(uri, async () => assert.fail('must not share')), /invalid-share-uri/);
ctx.sharePdf.current = null;
ctx.printToFileAsync = async () => ({ ...valid, base64: printBytes });
const write = ctx.FileSystem.writeAsStringAsync;
ctx.FileSystem.writeAsStringAsync = async () => { throw { code: 'ERR_UNEXPECTED' }; };
await ctx.confirmShare();
assert.match(status, /share-copy: ERR_UNEXPECTED/);
assert.equal(ctx.sharePdf.current.originalUri, valid.uri);
assert.equal(ctx.sharePreview, summary);
ctx.FileSystem.writeAsStringAsync = write;
await ctx.confirmShare();
assert.match(status, /Delivery is not confirmed/);
assert.equal(JSON.stringify(record), before);
console.log('PASS: Android-only share options, iOS UTI separation, scoped cache copy, and retry retaining original PDF/review');
