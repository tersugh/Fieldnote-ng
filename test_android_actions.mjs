import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from './mobile/node_modules/typescript/lib/typescript.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function module(source, imports = {}) {
  const context = { exports: {}, Date, Error, require: name => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } };
  runInNewContext(compile(source), context);
  return context.exports;
}
const actions = module(await read('mobile/caseActions.ts'));
const navigation = module(await read('mobile/sectionNavigation.ts'));
const panelSource = await read('mobile/CaseActionPanel.tsx');
const app = await read('mobile/App.tsx');
const results = [];

// Execute the actual component and its callbacks with deterministic hooks/native
// adapters. This checks state transitions, not Android rendering or native dialogs.
function panel(initial) {
  const slots = [], effects = [];
  let cursor = 0, dirty = false, tree, picker, calls = 0;
  let props = initial;
  const state = init => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof init === 'function' ? init() : init;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; dirty = true; }];
  };
  const effect = (fn, deps) => {
    const index = cursor++;
    if (!(index in slots) || deps.some((dep, i) => !Object.is(dep, slots[index][i]))) {
      slots[index] = deps;
      effects.push(fn);
    }
  };
  const react = { useState: state, useRef: value => state(() => ({ current: value }))[0], useEffect: effect, useLayoutEffect: effect };
  const jsx = (type, props) => ({ type, props });
  const { CaseActions } = module(panelSource, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    './caseActions': actions,
    '@react-native-community/datetimepicker': { DateTimePickerAndroid: { open: options => { picker = options; calls++; } } },
  });
  const render = () => {
    let iterations = 0;
    do {
      assert.ok(iterations++ < 20, 'Render loop');
      dirty = false; cursor = 0; tree = CaseActions(props);
      effects.splice(0).forEach(fn => fn());
    } while (dirty);
    return tree;
  };
  const nodes = (node = tree) => Array.isArray(node) ? node.flatMap(child => nodes(child ?? null)) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children ?? null)] : [];
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node);
  const button = name => {
    render();
    const node = nodes().find(node => node.type === 'Pressable' && text(node) === name);
    assert.ok(node, `Missing button: ${name}`);
    return node;
  };
  render();
  return {
    render, nodes, button, text: () => text(render()),
    press(name) { const node = button(name); assert.equal(node.props.disabled, false); node.props.onPress(); render(); },
    update(next) { props = { ...props, ...next }; render(); },
    get picker() { return picker; }, get pickerCalls() { return calls; },
    async settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); render(); },
  };
}

const fixture = { id: 'case-1', crop: 'Maize', location: 'Test area', observations: [{ id: 'visit-1',
  assessment: { next_steps: ['Inspect the lower leaves.'], follow_up_question: 'Any spread?' },
  refinements: [{ question: 'Which leaves?', answer: 'Lower', assessment: { next_steps: ['Inspect the lower leaves.'] } }],
  checklist: actions.makeChecklist(['Inspect the lower leaves.']),
}] };
let saved = JSON.stringify(fixture), pendingWrite, failWrite = false, writes = 0;
const ctx = { ...actions, Error, Date, locked: false, actionSaving: { current: false }, activeCase: JSON.parse(saved), resultObservation: JSON.parse(saved).observations[0],
  setActionBusy() {}, setReminderClock() {}, setCases(update) { update([JSON.parse(saved)]); },
  loadSavedCase: async () => JSON.parse(saved),
  persistCase: async value => { writes++; if (pendingWrite) await pendingWrite; if (failWrite) throw new Error('Storage unavailable'); saved = JSON.stringify(value); },
  setActiveCase(value) { ctx.activeCase = value; ctx.resultObservation = value.observations[0]; ui?.update({ checklist: value.observations[0].checklist, recheckAt: value.recheckAt }); },
};
runInNewContext(compile(app.slice(app.indexOf('  async function saveCaseAction'), app.indexOf('  function shareCaseWithWorker'))), ctx);
let ui = panel({ checklist: fixture.observations[0].checklist, hasSteps: true, disabled: false, language: 'en', onSave: ctx.saveCaseAction });
ui.press('Edit checklist');
ui.press('Done');
ui.nodes().find(node => node.type === 'TextInput').props.onChangeText('Checked this morning');
ui.render();
let release;
pendingWrite = new Promise(resolve => { release = resolve; });
const saveButton = ui.button('Save progress');
saveButton.props.onPress(); saveButton.props.onPress();
await ui.settle();
assert.equal(writes, 1);
assert.equal(ui.button('Save progress').props.disabled, true);
assert.match(ui.text(), /Saving on this device/);
await assert.rejects(ctx.saveCaseAction({ kind: 'reminder', value: null }), /operation is in progress/);
release(); pendingWrite = null;
await ui.settle();
assert.match(ui.text(), /Saved on this device/);
assert.equal(ui.nodes().some(node => node.type === 'TextInput'), false);
assert.match(ui.text(), /Done · Checked this morning/);
assert.equal(JSON.parse(saved).observations.length, 1);
assert.equal(JSON.parse(saved).observations[0].refinements[0].answer, 'Lower');
results.push('Checklist save blocks duplicate taps, shows feedback, collapses and preserves visit/Q&A');

ui = panel({ checklist: JSON.parse(saved).observations[0].checklist, hasSteps: true, disabled: false, language: 'en', onSave: ctx.saveCaseAction });
ui.press('Edit checklist');
assert.equal(ui.nodes().find(node => node.type === 'TextInput').props.value, 'Checked this morning');
ui.press('Skipped');
ui.nodes().find(node => node.type === 'TextInput').props.onChangeText('Try tomorrow');
const before = saved;
failWrite = true;
ui.press('Save progress'); await ui.settle();
assert.equal(saved, before);
assert.equal(ui.button('Save progress').props.disabled, false);
assert.equal(ui.nodes().find(node => node.type === 'TextInput').props.value, 'Try tomorrow');
assert.match(ui.text(), /tap save to retry.*Storage unavailable/);
failWrite = false;
ui.press('Save progress'); await ui.settle();
assert.match(ui.text(), /Skipped · Try tomorrow/);
results.push('Reopened checklist retains saved progress; failed saves retain drafts and can retry');

const now = new Date(2030, 11, 31, 18, 45);
const tomorrow = actions.reminderDraft(undefined, now);
assert.equal(actions.localRecheck(tomorrow.toISOString()), '2031-01-01T09:00');
ui.press('Set reminder');
const writesBeforePicker = writes;
const dateButton = ui.nodes().find(node => node.type === 'Pressable' && node.props.children.props.children.startsWith('Date:'));
dateButton.props.onPress();
assert.equal(ui.picker.mode, 'date');
assert.equal(ui.picker.value.getHours(), 9);
ui.picker.onDismiss(); ui.render();
assert.equal(writes, writesBeforePicker);
const picked = new Date(2035, 5, 12, 15, 45);
ui.picker.onValueChange({}, picked); ui.render();
const timeButton = ui.nodes().find(node => node.type === 'Pressable' && node.props.children.props.children.startsWith('Time:'));
timeButton.props.onPress();
assert.equal(ui.picker.mode, 'time');
assert.equal(ui.picker.value.getDate(), 12);
assert.equal(ui.picker.value.getHours(), 9);
ui.picker.onValueChange({}, picked); ui.render();
assert.equal(writes, writesBeforePicker);
assert.equal(actions.applyReminderPick(picked, 'date', 'dismissed', now), picked);
failWrite = true;
ui.press('Save reminder'); await ui.settle();
assert.equal(ui.button('Save reminder').props.disabled, false);
assert.match(ui.text(), /tap save to retry/);
assert.equal(JSON.parse(saved).recheckAt, undefined);
failWrite = false;
pendingWrite = new Promise(resolve => { release = resolve; });
const reminderSave = ui.button('Save reminder');
reminderSave.props.onPress(); reminderSave.props.onPress(); await ui.settle();
assert.equal(writes, writesBeforePicker + 2); // One failed write, one pending write.
release(); pendingWrite = null; await ui.settle();
assert.equal(JSON.parse(saved).recheckAt, picked.toISOString());
assert.match(ui.text(), /Saved reminder:/);
assert.ok(ui.button('Change reminder'));
ui = panel({ checklist: JSON.parse(saved).observations[0].checklist, recheckAt: JSON.parse(saved).recheckAt, hasSteps: true, disabled: false, language: 'en', onSave: ctx.saveCaseAction });
ui.press('Change reminder');
ui.nodes().find(node => node.type === 'Pressable' && node.props.children.props.children.startsWith('Date:')).props.onPress();
assert.equal(ui.picker.value.toISOString(), picked.toISOString());
ui.picker.onDismiss(); ui.render();
assert.equal(JSON.parse(saved).recheckAt, picked.toISOString());
ui.nodes().find(node => node.type === 'Pressable' && node.props.children.props.children.startsWith('Time:')).props.onPress();
ui.picker.onDismiss(); ui.render();
assert.equal(JSON.parse(saved).recheckAt, picked.toISOString());
const changed = new Date(2035, 5, 12, 16, 15);
ui.picker.onValueChange({}, changed); ui.render();
ui.press('Save reminder'); await ui.settle();
assert.equal(JSON.parse(saved).recheckAt, changed.toISOString());
ui.press('Dismiss reminder'); await ui.settle();
assert.equal(JSON.parse(saved).recheckAt, null);
assert.ok(ui.button('Set reminder'));
results.push('Native date/time drafts default to tomorrow 09:00; cancel never saves; failures, changes and dismissal persist correctly');

let selected, request;
const openCtx = { locked: false, actionSaving: { current: false }, activeCase: fixture, resultObservation: fixture.observations[0],
  setActiveCase(value) { selected = value; }, setSelectedObservationId(value) { assert.equal(value, 'visit-1'); },
  setSectionRequest(update) { request = update(request); },
  setRefineAnswer() { throw new Error('Must not reset the current answer draft'); },
};
runInNewContext(compile(app.slice(app.indexOf('  function openCaseSection'), app.indexOf('  async function saveCaseAction'))), openCtx);
const frames = [], scrolls = [], measured = [], callbacks = [];
const nav = navigation.createSectionNavigation(fn => frames.push(fn), (section, callback) => { measured.push(section); callbacks.push(callback); }, y => scrolls.push(y));
const flush = () => { while (frames.length) frames.shift()(); };
for (const [index, section] of ['checklist', 'reminder', 'advice', 'question'].entries()) {
  openCtx.openCaseSection(fixture, 'visit-1', section);
  assert.equal(selected.id, 'case-1');
  assert.equal(selected.observations.length, 1);
  assert.equal(request.section, section);
  ui.update({ openSection: request });
  if (section === 'checklist') assert.ok(ui.button('Save progress'));
  if (section === 'reminder') assert.ok(ui.button('Save reminder'));
  nav.request(section); nav.layout(); flush();
  assert.equal(measured.at(-1), section);
  callbacks.pop()(1000 + index * 300);
  assert.equal(scrolls.at(-1), 988 + index * 300);
}
nav.request('advice'); flush(); const stale = callbacks.pop();
nav.request('question'); flush(); stale(0); callbacks.pop()(2500);
assert.equal(scrolls.at(-1), 2488);
assert.ok(scrolls.every(y => y > 0));
nav.request('reminder'); nav.cancel(); flush();
assert.equal(measured.at(-1), 'question');
assert.match(app, /ref=\{contentRef\} style=\{styles.content\}/);
assert.match(app, /target\.measureLayout\(contentRef\.current/);
for (const section of ['checklist', 'reminder', 'advice', 'question']) assert.ok(app.includes(`openCaseSection(record, visit.id, '${section}')`));
results.push('All four casebook actions select the same visit, open editors, and scroll after layout; stale navigation is ignored');

console.log(results.map(result => 'PASS: ' + result).join('\n'));
