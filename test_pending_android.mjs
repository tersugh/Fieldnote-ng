// Executes the actual Android save/retry handlers with simulated SQLite/photo/network I/O.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const root = new URL('.', import.meta.url);
const compiler = {};
runInNewContext(await readFile(new URL('mobile/node_modules/typescript/lib/typescript.js', root), 'utf8'), compiler);
const ts = compiler.ts;
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const service = { exports: {}, AbortController, setTimeout, clearTimeout };
runInNewContext(compile(await readFile(new URL('mobile/analysis.ts', root), 'utf8')), service);
const { analyzeSavedVisit, createOperationGate, analysisStatus } = service.exports;
const app = await readFile(new URL('mobile/App.tsx', root), 'utf8');
const handlers = compile(app.slice(app.indexOf('  async function saveFieldNote'), app.indexOf('  async function updateAdvice')));
const advice = { visual_observations:'Fixture guidance', possible_causes:[], next_steps:['Inspect leaves'], urgency:'Monitor', follow_up_question:'Has it spread?' };
function harness(store = new Map(), files = new Map()) {
  const network = { fail:false, status:200, result:advice, wait:null, bodyError:null };
  const calls = [], events = [];
  let sequence = 0;
  const context = {
    locked:false, actionSaving:{current:false}, crop:'Maize', symptoms:'Yellow leaves', stage:'Flowering', location:'Test area',
    photo:{uri:'cache:fixture',mimeType:'image/jpeg'}, activeCase:null, language:'en', API_BASE_URL:'https://fixture.invalid',
    t:{cropRequired:'Crop required',photoRequired:'Photo required',error:'Error'},
    Alert:{alert:()=>assert.fail('Unexpected alert')}, analysisGate:createOperationGate(), analyzeSavedVisit, analysisStatus,
    newId:()=> 'fixture-' + (++sequence),
    savePhotoPermanently:async(photo,id)=>{ events.push('copy'); const uri='private:'+id;files.set(uri,photo.uri);return uri; },
    persistCase:async record=>{events.push('save');store.set(record.id,JSON.stringify(record));},
    loadSavedCase:async id=>{const json=store.get(id);if(!json)throw Error('Missing saved case');return JSON.parse(json);},
    imageAsDataUrl:async visit=>{assert.ok(files.has(visit.photoUri));return 'data:image/jpeg;base64,FIXTURE';},
    fetch:async(url,options)=>{
      events.push('request');calls.push({url,payload:JSON.parse(options.body)});
      assert.ok(store.size);
      if(network.wait)await network.wait;
      if(network.fail)throw Error('Network unavailable');
      return {ok:network.status===200,status:network.status,json:async()=>{if(network.bodyError)throw network.bodyError;return {assessment:network.result,detail:'Fixture rejection'};}};
    },
    setBusy:value=>{context.busy=value;}, setStatus:value=>{context.status=value;},
    setActiveCase:value=>{context.activeCase=value;}, setSelectedObservationId:value=>{context.selected=value;},
    setRefineAnswer:value=>{context.answer=value;}, setCases:update=>{context.cases=update(context.cases||[]);},
    setSymptoms:value=>{context.symptoms=value;}, setPhoto:value=>{context.photo=value;},
  };
  runInNewContext(handlers,context);
  return {context,store,files,network,calls,events};
}
const reports = [];
const first=harness();
await Promise.all([first.context.saveFieldNote(false),first.context.saveFieldNote(false)]);
assert.equal(first.calls.length,0);
assert.equal(first.store.size,1);
assert.deepEqual(first.events,['copy','save']);
const initial=JSON.parse([...first.store.values()][0]), id=initial.id, visitId=initial.observations[0].id;
assert.equal(initial.observations.length,1);
assert.equal(initial.observations[0].analysis.state,'pending');
assert.equal(initial.observations[0].stage,'Flowering');
assert.equal(initial.observations[0].location,'Test area');
assert.equal(initial.observations[0].symptoms,'Yellow leaves');
assert.ok(first.files.has(initial.observations[0].photoUri));
reports.push('Offline save copies photo before persisting; duplicate save taps create one visit and send nothing');

const h=harness(first.store,first.files);
h.context.photo=null;h.context.crop='';h.context.symptoms='';
assert.equal(h.calls.length,0);
h.network.fail=true;
await h.context.requestReview(initial,visitId);
assert.equal(h.context.busy,false);
let record=JSON.parse(h.store.get(id));
assert.equal(record.observations[0].analysis.state,'pending', JSON.stringify(record.observations[0].analysis));
assert.equal(record.observations[0].photoUri,initial.observations[0].photoUri);
reports.push('Reloaded retry uses stored photo/details; connection failure remains pending and stops loading');

h.network.fail=false;
for(const status of [400,502]){
  h.network.status=status;
  await h.context.requestReview(initial,visitId);
  record=JSON.parse(h.store.get(id));
  assert.equal(record.observations[0].analysis.state,'error');
  assert.equal(record.observations[0].analysis.kind,status===400?'input':'model');
}
h.network.status=200;h.network.result={};
await h.context.requestReview(initial,visitId);
assert.equal(JSON.parse(h.store.get(id)).observations[0].analysis.kind,'model');
h.context.API_BASE_URL='';
const count=h.calls.length;
await h.context.requestReview(initial,visitId);
assert.equal(JSON.parse(h.store.get(id)).observations[0].analysis.kind,'configuration');
assert.equal(h.calls.length,count);
h.context.API_BASE_URL='https://fixture.invalid';
reports.push('Input/model/malformed response/configuration errors are saved as needs-attention, not pending');
h.network.bodyError=new TypeError('Interrupted body');
await h.context.requestReview(initial,visitId);
assert.equal(JSON.parse(h.store.get(id)).observations[0].analysis.state,'pending');
h.network.bodyError=new SyntaxError('Malformed JSON');
await h.context.requestReview(initial,visitId);
assert.equal(JSON.parse(h.store.get(id)).observations[0].analysis.kind,'model');
h.network.bodyError=null;
reports.push('Interrupted response is pending; malformed JSON is a service error');

let release;
h.network.wait=new Promise(resolve=>{release=resolve;});
h.network.result=advice;
const before=h.calls.length;
const pending=h.context.requestReview(initial,visitId);
await h.context.requestReview(initial,visitId);
release();await pending;h.network.wait=null;
record=JSON.parse(h.store.get(id));
assert.equal(h.calls.length,before+1);
assert.equal(record.observations.length,1);
assert.equal(record.observations[0].id,visitId);
assert.equal(record.observations[0].analysis.state,'complete');
assert.equal(record.observations[0].assessment.visual_observations,'Fixture guidance');
assert.equal(h.context.busy,false);
assert.equal(h.calls.at(-1).payload.stage,'Flowering');
reports.push('Duplicate retry taps send once; success updates the existing case/visit');

record.observations[0].refinements=[{id:'turn',question:'Which leaves?',answer:'Lower leaves',assessment:advice}];
h.store.set(id,JSON.stringify(record));
h.context.activeCase=record;h.context.photo={uri:'cache:second',mimeType:'image/jpeg'};h.context.crop='Maize';h.context.symptoms='New signs';
// Give a reloaded test process globally unique IDs, as the production generator does.
h.context.newId=()=> 'second-visit';
h.network.fail=true;
await h.context.saveFieldNote(true);
record=JSON.parse(h.store.get(id));
assert.equal(record.observations.length,2);
assert.equal(h.calls.at(-1).url,'https://fixture.invalid/api/followup');
assert.equal(record.observations[0].refinements[0].answer,'Lower leaves');
assert.equal(record.observations[1].analysis.state,'pending');
h.network.fail=false;
await h.context.requestReview(record,'second-visit');
record=JSON.parse(h.store.get(id));
assert.equal(record.observations.length,2);
assert.equal(record.observations[0].refinements[0].answer,'Lower leaves');
assert.equal(record.observations[1].analysis.state,'complete');
reports.push('Comparison failure/retry retains both visits and clarification history without duplicating');

const direct=harness();direct.network.fail=true;
await direct.context.saveFieldNote(true);
assert.deepEqual(direct.events.slice(0,3),['copy','save','request']);
assert.equal(JSON.parse([...direct.store.values()][0]).observations[0].analysis.state,'pending');
assert.equal(direct.context.busy,false);
reports.push('Initial analysis failure leaves its saved photo and pending visit intact');
export const results=reports;
console.log(results.map(result=>'PASS: '+result).join('\n'));
