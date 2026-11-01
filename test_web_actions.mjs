import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInContext } from 'node:vm';
import { webHarness } from './test_web_panel.mjs';

const makeCase = id => ({ id, crop: 'Maize', location: 'Fixture area', updatedAt: '2030-01-01', observations: [0, 1].map(index => ({
  id: `${id}-${index}`, date: '2030-01-01', symptoms: `Notes ${id}/${index}`, photo: {},
  assessment: { visual_observations: `Advice ${id}/${index}`, possible_causes: [], next_steps: [`Inspect ${id}/${index} <leaf>`], follow_up_question: `Question ${id}/${index}?` },
  checklist: { savedAt: '2030-01-01', items: [{ text: `Inspect ${id}/${index} <leaf>`, state: 'todo', note: '' }] },
  clarifications: [{ question: 'Earlier?', answer: 'Yes', date: '2030-01-01' }],
})) });
const store = new Map(['a', 'b'].map(id => [id, makeCase(id)]));
const h = await webHarness(store);
h.context.showSavedAdvice(structuredClone(store.get('a')), 1, false);
h.node('#checklist-editor').open = true;
h.node('#step-state-0').value = 'done'; h.node('#step-note-0').value = 'Checked <today>';
h.node('#reminder-editor').open = true; h.node('#recheck-time').value = '2035-06-12T09:30';
let release;
h.storage.wait = new Promise(resolve => { release = resolve; });
const saving = h.context.saveWebCaseAction('progress');
assert.match(h.node('#action-status').textContent, /Saving/);
assert.equal(h.node('#save-progress').textContent, 'Saving…');
assert.equal(h.node('#save-progress').disabled, true);
await h.context.saveWebCaseAction('progress');
for (let i = 0; i < 6; i++) await Promise.resolve();
assert.equal(h.storage.writes, 1);
release(); h.storage.wait = null; await saving;
assert.equal(h.node('#checklist-editor').open, false);
assert.equal(h.node('#save-progress').disabled, false);
assert.match(h.node('#checklist-saved').innerHTML, /Done · Checked &lt;today&gt;/);
assert.equal(h.node('#recheck-time').value, '2035-06-12T09:30');
assert.equal(h.node('#reminder-editor').open, true);
assert.equal(store.get('a').observations[0].checklist.items[0].state, 'todo');
assert.equal(store.get('a').observations[1].checklist.items[0].state, 'done');
assert.equal(store.get('a').observations.length, 2);
assert.equal(store.get('a').observations[1].clarifications[0].answer, 'Yes');
console.log('PASS: Checklist save feedback, duplicate guard, collapse, safe saved summary and unrelated reminder draft preservation');

const reopened = await webHarness(store);
reopened.context.showSavedAdvice(structuredClone(store.get('a')), 1, false);
assert.equal(reopened.node('#step-state-0').value, 'done');
// Fixture DOM retains escaped markup; actual browsers decode it in textarea values.
assert.match(reopened.node('#step-note-0').value, /Checked/);
h.node('#checklist-editor').open = true;
h.node('#step-state-0').value = 'skipped'; h.node('#step-note-0').value = 'Try tomorrow';
h.storage.fail = true;
await h.context.saveWebCaseAction('progress');
assert.equal(h.node('#checklist-editor').open, true);
assert.equal(h.node('#step-note-0').value, 'Try tomorrow');
assert.equal(store.get('a').observations[1].checklist.items[0].state, 'done');
assert.match(h.node('#action-status').textContent, /retry.*Storage unavailable/);
assert.equal(h.node('#save-progress').disabled, false);
h.storage.fail = false; await h.context.saveWebCaseAction('progress');
assert.equal(store.get('a').observations[1].checklist.items[0].state, 'skipped');
console.log('PASS: Reopening restores persisted checklist; failure keeps entries and retry updates only the selected incident');

h.storage.fail = true;
await h.context.saveWebCaseAction('reminder');
assert.equal(h.node('#reminder-editor').open, true);
assert.equal(h.node('#recheck-time').value, '2035-06-12T09:30');
assert.equal(store.get('a').recheckAt, undefined);
h.storage.fail = false;
h.storage.wait = new Promise(resolve => { release = resolve; });
const count = h.storage.writes;
const reminder = h.context.saveWebCaseAction('reminder');
assert.equal(h.node('#save-recheck').textContent, 'Saving…');
await h.context.saveWebCaseAction('reminder');
for (let i = 0; i < 6; i++) await Promise.resolve();
assert.equal(h.storage.writes, count + 1);
release(); h.storage.wait = null; await reminder;
assert.equal(h.node('#reminder-editor').open, false);
assert.equal(h.node('#reminder-toggle').textContent, 'Change reminder');
assert.ok(h.node('#reminder-saved').textContent);
const afterReload = await webHarness(store);
afterReload.context.showSavedAdvice(structuredClone(store.get('a')), 1, false);
assert.equal(afterReload.node('#recheck-time').value, '2035-06-12T09:30');
h.node('#reminder-editor').open = true; h.node('#recheck-time').value = '2035-06-13T11:45';
await h.context.saveWebCaseAction('reminder');
assert.equal(h.context.localRecheck(store.get('a').recheckAt), '2035-06-13T11:45');
assert.equal(h.node('#reminder-editor').open, false);
h.node('#recheck-time').value = 'invalid'; await h.context.saveWebCaseAction('reminder');
assert.equal(h.node('#reminder-editor').open, true);
assert.equal(h.node('#recheck-time').value, 'invalid');
await h.context.saveWebCaseAction('dismiss');
assert.equal(store.get('a').recheckAt, null);
assert.equal(h.requests.length, 0);
console.log('PASS: Reminder set/change/failure/validation/dismissal, duplicate taps and reload persistence remain local');

const source = await readFile(new URL('app.js', import.meta.url), 'utf8');
runInContext(source.slice(source.indexOf('async function renderCasebook'), source.indexOf('function formatDate')) + '\nasync function caseStoreRequest() { return fixtureRecords(); }', h.context);
h.context.fixtureRecords = () => [...store.values()].map(value => structuredClone(value));
await h.context.renderCasebook();
for (const id of ['a', 'b']) for (const index of [0, 1]) for (const section of ['advice', 'question', 'checklist', 'reminder']) {
  assert.ok(h.node('#casebook-list').innerHTML.includes(`data-action="${section}" data-case-id="${id}" data-visit-index="${index}"`));
}
const frames = []; h.context.window.requestAnimationFrame = callback => frames.push(callback);
const flush = () => { while (frames.length) frames.shift()(); };
const click = (id, index, section) => h.node('#casebook-list').handlers.click({ target: { closest: () => ({ dataset: { action: section, caseId: id, visitIndex: String(index) } }) } });
const selectors = { advice: '#analysis-result', question: '#clarification-form', checklist: '#checklist-section', reminder: '#reminder-section' };
const headerScrolls = h.node('#result-card').scrolls || 0;
for (const id of ['a', 'b']) for (const index of [0, 1]) for (const section of Object.keys(selectors)) {
  const target = h.node(selectors[section]), before = target.scrolls || 0;
  await click(id, index, section);
  assert.equal(target.scrolls || 0, before, 'Wait for layout before scrolling');
  flush();
  assert.equal(target.scrolls, before + 1);
  assert.equal(runInContext('displayedCase.id', h.context), id);
  assert.equal(runInContext('displayedVisit', h.context), index);
  assert.match(h.node('#analysis-result').innerHTML, new RegExp(`Advice ${id}/${index}`));
  if (section === 'checklist' || section === 'reminder') assert.equal(h.node(`#${section}-editor`).open, true);
}
assert.equal(h.node('#result-card').scrolls || 0, headerScrolls);
const staleScrolls = h.node('#checklist-section').scrolls;
await click('a', 0, 'checklist');
await click('b', 1, 'reminder');
flush();
assert.equal(h.node('#checklist-section').scrolls, staleScrolls, 'Ignore a superseded layout callback');
let unblock;
h.storage.readWait = id => id === 'a' ? new Promise(resolve => { unblock = resolve; }) : Promise.resolve();
const old = click('a', 0, 'checklist');
for (let i = 0; i < 6; i++) await Promise.resolve();
await click('b', 1, 'reminder');
unblock(); await old; flush();
assert.equal(runInContext('displayedCase.id', h.context), 'b');
assert.equal(runInContext('displayedVisit', h.context), 1);
assert.equal(h.node('#reminder-section').focused, true);
assert.equal(h.requests.length, 0);
console.log('PASS: All four shortcuts target each incident across multiple cases after layout; stale loads cannot replace the selected case');
