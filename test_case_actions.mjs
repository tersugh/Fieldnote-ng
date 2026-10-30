import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInContext, runInNewContext } from 'node:vm';
import { webHarness } from './test_web_panel.mjs';
const root = new URL('.', import.meta.url);
const compiler = {};
runInNewContext(await readFile(new URL('mobile/node_modules/typescript/lib/typescript.js', root), 'utf8'), compiler);
const ts = compiler.ts;
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const native = { exports: {} };
runInNewContext(compile(await readFile(new URL('mobile/caseActions.ts', root), 'utf8')), native);
const helpers = native.exports;
const steps = ['Inspect the lower leaves.', '<script>literal advice</script>'];
const record = { id:'case-1', crop:'Maize', location:'Test area', createdAt:'2026-10-30T10:00:00Z', updatedAt:'2026-10-30T10:00:00Z', observations:[
  { id:'visit-1',date:'2026-10-30T10:00:00Z',stage:'Flowering',symptoms:'Yellow leaves',photo:{name:'fixture.jpg'},photoUri:'private:fixture',assessment:{visual_observations:'Fixture',possible_causes:[],next_steps:steps,urgency:'Monitor',follow_up_question:'Any spread?'},clarifications:[{date:'2026-10-30T10:00:00Z',question:'Which leaves?',answer:'Lower'}] },
] };
const store = new Map([[record.id, structuredClone(record)]]);
const h = await webHarness(store);
h.context.showSavedAdvice(structuredClone(record),0);
await h.context.saveWebCaseAction('create');
assert.equal(JSON.stringify(store.get(record.id).observations[0].checklist.items.map(item=>item.text)),JSON.stringify(steps));
assert.ok(h.node('#case-action-panel').innerHTML.includes('&lt;script&gt;literal advice&lt;/script&gt;'));
assert.equal(h.requests.length,0);
const reopened = await webHarness(store);
reopened.context.showSavedAdvice(structuredClone(store.get(record.id)),0);
assert.ok(reopened.node('#case-action-panel').innerHTML.includes('Inspect the lower leaves.'));
reopened.node('#step-state-0').value='done';reopened.node('#step-note-0').value='Checked this morning';
reopened.node('#step-state-1').value='skipped';reopened.node('#step-note-1').value='Will ask for advice';
await reopened.context.saveWebCaseAction('progress');
assert.equal(store.get(record.id).observations[0].checklist.items[0].state,'done');
assert.equal(store.get(record.id).observations[0].checklist.items[1].state,'skipped');
assert.equal(store.get(record.id).observations[0].checklist.items[0].note,'Checked this morning');
// New model guidance must not rewrite the saved checklist or lose progress.
store.get(record.id).observations[0].assessment.next_steps=['Revised guidance'];
reopened.context.showSavedAdvice(structuredClone(store.get(record.id)),0);
await reopened.context.saveWebCaseAction('create');
assert.equal(store.get(record.id).observations[0].checklist.items[0].text,steps[0]);
assert.equal(store.get(record.id).observations[0].checklist.items[0].state,'done');

reopened.node('#recheck-time').value='2035-06-12T09:30';
await reopened.context.saveWebCaseAction('reminder');
assert.equal(reopened.context.recheckDue(store.get(record.id).recheckAt),false);
reopened.node('#recheck-time').value='2020-06-12T09:30';
await reopened.context.saveWebCaseAction('reminder');
assert.equal(reopened.context.recheckDue(store.get(record.id).recheckAt),true);
assert.equal(store.get(record.id).observations[0].checklist.items[0].note,'Checked this morning');
const dueTime=store.get(record.id).recheckAt;
reopened.node('#recheck-time').value='2030-02-31T09:30';
await reopened.context.saveWebCaseAction('reminder');
assert.equal(store.get(record.id).recheckAt,dueTime);
assert.ok(reopened.node('#action-status').textContent.includes('valid'));
const web = await readFile(new URL('app.js',root),'utf8');
runInContext(web.slice(web.indexOf('async function renderCasebook'),web.indexOf('function formatDate')) + '\nasync function caseStoreRequest() { return testRecords(); }',reopened.context);
reopened.context.testRecords=()=>Array.from(store.values()).map(value=>structuredClone(value));
await reopened.context.renderCasebook();
assert.ok(reopened.node('#casebook-list').innerHTML.includes('Recheck due'));
assert.ok(reopened.node('#casebook-list').innerHTML.includes('Start photo follow-up on this case'));
const continueButton={dataset:{action:'continue',caseId:record.id}};
await reopened.node('#casebook-list').handlers.click({target:{closest:()=>continueButton}});
assert.equal(runInContext('activeCaseId',reopened.context),record.id);
assert.equal(store.size,1);
assert.equal(store.get(record.id).observations.length,1);
await reopened.context.saveWebCaseAction('dismiss');
assert.equal(store.get(record.id).recheckAt,null);
assert.equal(reopened.context.recheckDue(store.get(record.id).recheckAt),false);
assert.equal(reopened.requests.length,0);

// Execute the actual Android local-save handler against serialized SQLite fixtures.
const app=await readFile(new URL('mobile/App.tsx',root),'utf8');
let saved=JSON.stringify(record);
const ctx={
  ...helpers,locked:false,actionSaving:{current:false},activeCase:structuredClone(record),resultObservation:structuredClone(record.observations[0]),
  loadSavedCase:async()=>JSON.parse(saved),persistCase:async value=>{saved=JSON.stringify(value);},
  setActionBusy:()=>{},setReminderClock:()=>{},setCases:update=>update([JSON.parse(saved)]),
  setActiveCase:value=>{ctx.activeCase=value;ctx.resultObservation=value.observations[0];},
};
runInNewContext(compile(app.slice(app.indexOf('  async function saveCaseAction'),app.indexOf('  function shareCaseWithWorker'))),ctx);
await ctx.saveCaseAction({kind:'create'});
await ctx.saveCaseAction({kind:'progress',progress:[{state:'done',note:'Checked'},{state:'skipped',note:'Waiting'}]});
let nativeRecord=JSON.parse(saved);
assert.deepEqual(nativeRecord.observations[0].checklist.items.map(item=>item.text),steps);
assert.equal(nativeRecord.observations[0].checklist.items[1].state,'skipped');
ctx.activeCase=JSON.parse(saved);ctx.resultObservation=ctx.activeCase.observations[0];
await ctx.saveCaseAction({kind:'reminder',value:'2035-06-12 09:30'});
assert.equal(helpers.recheckDue(JSON.parse(saved).recheckAt),false);
await ctx.saveCaseAction({kind:'reminder',value:'2020-06-12 09:30'});
assert.equal(helpers.recheckDue(JSON.parse(saved).recheckAt),true);
await ctx.saveCaseAction({kind:'reminder',value:null});
assert.equal(JSON.parse(saved).recheckAt,null);
assert.equal(JSON.parse(saved).observations[0].checklist.items[0].note,'Checked');
const before=saved;
await assert.rejects(ctx.saveCaseAction({kind:'reminder',value:'invalid'}));
assert.equal(saved,before);
const followupContext={locked:false,actionSaving:{current:false},CROPS:['Maize'],scroll:{current:{scrollTo(){}}},...Object.fromEntries(['setVoiceDiagnostics','setCropChoice','setVoiceState','setVoiceMessage','setStatus','setSelectedObservationId','setRefineAnswer','setCrop','setLocation','setStage','setSymptoms','setPhoto'].map(name=>[name,()=>{}])),setActiveCase:value=>{followupContext.activeCase=value;}};
runInNewContext(compile(app.slice(app.indexOf('  function continueCase'),app.indexOf('  async function choosePhoto'))),followupContext);
followupContext.continueCase(JSON.parse(saved));
assert.equal(followupContext.activeCase.id,record.id);
assert.equal(followupContext.activeCase.observations.length,1);
for(const api of [helpers,reopened.context]){
  assert.equal(api.recheckDue(undefined),false);
  assert.equal(api.recheckDue('not a date'),false);
  assert.throws(()=>api.parseRecheck('2030-02-31T12:00'));
  assert.throws(()=>api.updateChecklist(api.makeChecklist(steps),[{state:'done',note:'x'.repeat(301)},{state:'todo',note:''}]));
}
// No installed native notification module: no permission/network dependency.
assert.doesNotMatch(app,/expo-notifications|requestNotificationPermissions/);
const panel=await readFile(new URL('mobile/CaseActionPanel.tsx',root),'utf8');
assert.ok(panel.includes('No notification permission is needed.'));
assert.match(panel, /\{item.text\}/);
assert.doesNotMatch(panel,/fetch\(/);
export const results=[
  'Web saves exact advice, reopens locally, completes/skips steps and preserves notes',
  'Saved checklist wording and progress survive revised guidance',
  'Web reminder set/change/due/dismiss and invalid-date preservation pass',
  'Due web reminder opens a follow-up on the same case without adding a visit or uploading',
  'Android save handler preserves exact steps/progress and reminders through serialized reloads',
  'Android follow-up selects the same saved case; invalid dates/oversized notes are rejected',
  'Model text is escaped on web and rendered as Text on Android',
  'In-app reminders require no notification permission; unavailable/denied notifications cannot block local actions',
];
console.log(results.map(result=>'PASS: '+result).join('\n'));
