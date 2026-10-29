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
  language: 'en', navigator: platform, Blob, File,
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

assert.equal(await context.shareWebSummary(text, null, {}), 'unavailable');
let payload;
assert.equal(await context.shareWebSummary(text, null, {share: async value => {payload=value;}}), 'opened');
assert.equal(payload.text, text);
assert.equal(payload.files, undefined);
const photo = new File(['fixture'], 'photo.jpg', {type:'image/jpeg'});
assert.equal(await context.shareWebSummary(text, photo, {share:async value=>{payload=value;},canShare:()=>true}), 'opened');
assert.equal(payload.files[0], photo);
assert.equal(payload.text, text);
assert.equal(await context.shareWebSummary(text, photo, {share:async()=>assert.fail(),canShare:()=>false}), 'unsupported-photo');
assert.equal(await context.shareWebSummary(text, photo, {share:async()=>assert.fail(),canShare:()=>{throw new Error();}}), 'unsupported-photo');
assert.equal(await context.shareWebSummary(text, null, {share:async()=>{throw {name:'AbortError'};}}), 'cancelled');
assert.equal(await context.shareWebSummary(text, null, {share:async()=>{throw new Error();}}), 'failed');
assert.equal(await context.copyCaseSummary(text, {}), false);
assert.equal(await context.copyCaseSummary(text, {clipboard:{writeText:async()=>{throw new Error();}}}), false);
let copied;
assert.equal(await context.copyCaseSummary(text, {clipboard:{writeText:async value=>{copied=value;}}}), true);
assert.equal(copied,text);
context.downloadCaseSummary(text);
assert.equal(downloads[0].download,'fieldnote-case-summary.txt');
assert.equal(downloads[0].clicked,true);
assert.equal(await urls[0].text(),text);
assert.ok(revoked.length);

// Review must precede any platform call; dynamic data uses value/textContent only.
let shares=0;
platform.share=async()=>{shares++;throw new Error('Fixture failure');};
platform.canShare=()=>true;
context.shareCaseWithWorker(record);
assert.equal(shares,0);
assert.equal(node('#share-review').open,true);
assert.equal(node('#share-summary').value,text);
assert.equal(node('#share-photo-controls').hidden,false);
await node('#share-with-photo').onclick();
assert.equal(shares,1);
assert.equal(node('#share-text').disabled,false);
assert.equal(node('#share-summary').value,text);
await node('#share-copy').onclick();
assert.equal(node('#share-summary').selected,true);
node('#share-close').onclick();
assert.equal(node('#share-review').open,false);
delete platform.share;
delete platform.canShare;
context.shareCaseWithWorker({crop:'Yam',observations:[]});
assert.equal(node('#share-photo-controls').hidden,true);
assert.equal(node('#share-text').hidden,true);

let nativePayload;
await android.exports.shareCaseSummary(text, async content => {nativePayload=content;return {action:'sharedAction'};});
assert.equal(nativePayload.message,text);
assert.equal(nativePayload.url,undefined);
await android.exports.shareCaseSummary(text, async()=>({action:'dismissedAction'}));
await assert.rejects(android.exports.shareCaseSummary(text, async()=>{throw new Error('Unavailable');}),/Unavailable/);
// Verify wiring of the native review, selectable fallback, and failure path.
assert.match(mobile, /setSharePreview\(buildCaseSummary\(record, language\)\)/);
assert.match(mobile, /<Text selectable style=\{styles.body\}>\{sharePreview\}<\/Text>/);
assert.match(mobile, /onPress=\{confirmShare\}/);
assert.match(mobile, /Could not open sharing\. Try again or select and copy/);
assert.doesNotMatch(helper, /fetch\(|photoUri/);
export const results = [
  'Web and Android summaries match, including visits, guidance and clarification answers',
  'Missing optional fields, empty cases, invalid dates, Hausa text and older guidance handled',
  'Untrusted content remains literal in review; native preview uses selectable Text',
  'Web native text/photo sharing, unsupported capability, cancellation and failure handled',
  'Web clipboard success/denial/unavailable and UTF-8 download fallback passed',
  'Web review precedes sharing, survives failure, and hides unsupported photo controls',
  'Android native-share adapter passes text only, handles dismissal, and propagates failure for retry',
];
console.log(results.map(result=>'PASS: '+result).join('\n'));
