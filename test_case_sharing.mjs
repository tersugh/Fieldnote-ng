// Local fixture tests; no HTTP, real farmer records, browser or emulator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Blob, File } from 'node:buffer';
const root = new URL('.', import.meta.url);
const web = await readFile(new URL('app.js', root), 'utf8');
const mobile = await readFile(new URL('mobile/App.tsx', root), 'utf8');
const helper = await readFile(new URL('mobile/caseSharing.ts', root), 'utf8');
const compiler = {};
runInNewContext(await readFile(new URL('mobile/node_modules/typescript/lib/typescript.js', root), 'utf8'), compiler);
const ts = compiler.ts;
const compiled = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, strict: true }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.length, 0);
const android = { exports: {} };
runInNewContext(compiled.outputText, android);
const nodes = new Map();
const created = [];
function node(id) {
  if (nodes.has(id)) return nodes.get(id);
  const element = {
    value: '', hidden: false, textContent: '', children: [],
    set innerHTML(_) { throw new Error('Untrusted sharing text must never be rendered as HTML'); },
    append(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    removeAttribute() {}, focus() {}, select() { this.selected = true; },
    showModal() { this.open = true; }, close() { this.open = false; this.onclose?.(); },
    click() { this.clicked = true; }, remove() {},
  };
  nodes.set(id, element);
  return element;
}
const urls = [], revoked = [], downloads = [];
const platform = {};
const context = {
  language: 'en', navigator: platform, Blob, File, structuredClone,
  FieldnotePdf: {},
  document: {
    querySelector: node, activeElement: { focus() {} },
    createElement: type => { const el = node('created-' + created.length); created.push(el); if(type === 'a') downloads.push(el); return el; },
    body: { append() {} },
  },
  URL: { createObjectURL: blob => { urls.push(blob); return 'blob:fixture-' + urls.length; }, revokeObjectURL: url => revoked.push(url) },
  setTimeout: callback => callback(),
  formatDate: value => value || 'No date',
};
runInNewContext(web.slice(web.indexOf('function buildCaseSummary('), web.indexOf('function activateCase(')), context);
const danger = '<img src=x onerror=alert(1)>';
const advice = { visual_observations: 'Yellow leaves', possible_causes: [{ name: 'Stress' }], next_steps: ['Inspect soil'], urgency: 'Monitor', follow_up_question: 'Has it spread?' };
const turn = { question: 'Which leaves?', answer: danger, assessment: advice };
const record = { crop: 'Maize', location: 'Test area', observations: [
  { date: '2026-10-28T12:00:00Z', stage: 'Flowering', symptoms: danger, assessment: advice, clarifications: [turn], photo: new Blob(['fixture'], {type:'image/jpeg'}) },
  { date: '2026-10-29T12:00:00Z', symptoms: 'New offline note' },
] };
const text = context.buildCaseSummary(record);
assert.ok(text.includes('Growth stage: Flowering'));
assert.ok(text.includes('Farmer answer: ' + danger));
assert.ok(text.indexOf('Visit 1') < text.indexOf('Visit 2'));
assert.ok(text.includes('For visit 1'));
assert.ok(text.includes('newest visit has not received AI guidance'));
assert.ok(text.includes('Inspect soil'));
const nativeRecord = structuredClone(record);
nativeRecord.observations[0].refinements = [turn];
delete nativeRecord.observations[0].clarifications;
assert.equal(android.exports.buildCaseSummary(nativeRecord), text);
for (const fixture of [{}, {crop:'Yam', observations:[{symptoms:'Wilt',date:'bad'}]}, {observations:[{assessment:{}}]}]) {
  const summary = context.buildCaseSummary(fixture);
  assert.equal(android.exports.buildCaseSummary(fixture), summary);
  assert.doesNotMatch(summary, /undefined|null|Invalid Date/);
  assert.ok(!summary.includes('Growth stage:'));
}
assert.ok(context.buildCaseSummary({}, 'ha').includes('Babu ziyara'));
assert.equal(android.exports.buildCaseSummary(nativeRecord, 'ha'), context.buildCaseSummary(record, 'ha'));


const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const pdf = require('./case-pdf.js');
const file = new File(['%PDF-fixture'], 'fieldnote-maize.pdf', {type:'application/pdf'});
let payload, downloaded = 0;
assert.equal(await pdf.share(file, {}, async value => { assert.equal(value,file); downloaded++; }), 'downloaded');
assert.equal(await pdf.share(file, {share:async()=>assert.fail(),canShare:()=>false}, async()=>{downloaded++;}), 'downloaded');
assert.equal(await pdf.share(file, {share:async()=>assert.fail(),canShare:()=>{throw new Error();}}, async()=>{downloaded++;}), 'downloaded');
assert.equal(downloaded,3);
assert.equal(await pdf.share(file, {share:async value=>{payload=value;},canShare:()=>true}), 'opened');
assert.equal(payload.files[0].type,'application/pdf');
assert.equal(payload.files[0],file);
assert.equal(payload.text,undefined);
assert.equal(await pdf.share(file, {share:async()=>{throw {name:'AbortError'};},canShare:()=>true}), 'cancelled');
assert.equal(await pdf.share(file, {share:async()=>{throw new Error();},canShare:()=>true}), 'failed');
await assert.rejects(pdf.share(file, {}, async()=>{throw new Error('download failed');}), /download failed/);

// The actual download fallback uses the PDF, its filename and an object URL.
const previousDocument=globalThis.document, previousURL=globalThis.URL;
const previousTimeout=globalThis.setTimeout;
globalThis.document=context.document; globalThis.URL=context.URL; globalThis.setTimeout=context.setTimeout;
try { pdf.download(file); assert.equal(downloads.at(-1).download,file.name); assert.equal(urls.at(-1),file); assert.equal(downloads.at(-1).clicked,true); }
finally { globalThis.document=previousDocument; globalThis.URL=previousURL; globalThis.setTimeout=previousTimeout; }
// No timer delay is needed for this fixture's object URL cleanup.
let generated=0, shares=0, downloadsRequested=0, release;
const waiting=new Promise(resolve=>{release=resolve;});
context.FieldnotePdf={
  canShareFile:()=>true,
  create:async (snapshot, summary)=>{ generated++; assert.equal(summary,text); assert.notEqual(snapshot,record); await waiting; return {file,missing:1}; },
  share:async()=>{shares++;return 'failed';},
  download:async()=>{downloadsRequested++;},
};
const before=JSON.stringify(record);
context.shareCaseWithWorker(record);
assert.equal(generated,0);
assert.equal(node('#share-review').open,true);
assert.equal(node('#share-summary').value,text);
const first=node('#share-pdf').onclick();
await node('#share-pdf').onclick();
assert.equal(generated,1);
assert.equal(node('#share-pdf').disabled,true);
release(); await first;
assert.equal(shares,0);
assert.match(node('#share-status').textContent,/PDF ready/);
await node('#share-pdf').onclick();
assert.equal(shares,1);
assert.equal(node('#share-pdf').disabled,false);
assert.match(node('#share-status').textContent,/Retry sharing/);
assert.equal(node('#share-summary').value,text);
context.FieldnotePdf.share=async()=>{shares++;return 'cancelled';};
await node('#share-pdf').onclick();
assert.equal(generated,1);
assert.match(node('#share-status').textContent,/cancelled/);
await node('#share-download').onclick();
assert.equal(downloadsRequested,1);
assert.equal(JSON.stringify(record),before);
context.FieldnotePdf.create=async()=>{throw new Error('PDF failure');};
context.shareCaseWithWorker(record);
await node('#share-pdf').onclick();
assert.match(node('#share-status').textContent,/Try again/);
assert.equal(node('#share-pdf').disabled,false);
assert.equal(node('#share-summary').value,text);

const nativePdf={exports:{}};
runInNewContext(ts.transpileModule(await readFile(new URL('mobile/casePdf.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,nativePdf);
let nativePayload;
await nativePdf.exports.shareCasePdf('file:///cache/case.pdf',async(uri,options)=>{nativePayload={uri,options};});
assert.equal(nativePayload.uri,'file:///cache/case.pdf');
assert.equal(nativePayload.options.mimeType,'application/pdf');
await assert.rejects(nativePdf.exports.shareCasePdf('file:///cache/case.pdf',async()=>{throw new Error('Unavailable');}),/Unavailable/);
assert.match(mobile,/onPress=\{confirmShare\}/);
assert.match(mobile,/printToFileAsync\(\{ html/);
assert.match(mobile,/PDF generation did not complete/);
assert.doesNotMatch(await readFile(new URL('mobile/casePdf.ts',root),'utf8'),/fetch\(/);
export const results=[
 'Web and Android retain the complete reviewed summary, visit order, Q&A, guidance and language handling',
 'Missing fields and untrusted farmer/model text remain safe and readable in review',
 'PDF file sharing checks capability and falls back to a named PDF download',
 'Web share cancellation, failure and download failure remain retryable',
 'Confirmation precedes generation; duplicate taps generate once and retries retain review/case',
 'Android shares the local file as application/pdf and propagates failures without mutating the case',
];
console.log(results.map(result=>'PASS: '+result).join('\n'));
