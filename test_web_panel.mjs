// Dependency-free workflow regression tests with simulated DOM, storage and HTTP.
// Run: node test_web_panel.mjs. No server, browser, real photos or API keys needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';

export async function webHarness(stored = new Map()) {
  const root = new URL('.', import.meta.url);
  const read = (name) => readFile(new URL(name, root), 'utf8');
  const [source, html, css] = await Promise.all(['app.js', 'index.html', 'styles.css'].map(read));
  assert.match(css, /\.result-card \[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.equal((html.match(/id="analysis-result"/g) || []).length, 1);
  assert.match(html, /id="result-card"[^>]*tabindex="-1"/);
  const nodes = new Map();
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const element = {
      value: '', disabled: false, hidden: ['#loading-state', '#analysis-result', '#clarification-panel', '#error-state'].includes(id),
      options: [{ value: '' }, { value: 'Maize' }, { value: 'Other' }], files: [], dataset: {},
      handlers: {}, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, callback) { this.handlers[type] = callback; },
      dispatchEvent(event) { return this.handlers[event.type]?.(event); },
      setAttribute() {}, removeAttribute() {}, reset() {},
      focus() { this.focused = true; }, scrollIntoView() { this.scrolls = (this.scrolls || 0) + 1; },
      querySelector: node,
      set innerHTML(value) {
        this.markup = value;
        if (id === '#clarification-panel') {
          node('#clarification-answer').value = value.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1] || '';
        }
      },
      get innerHTML() { return this.markup || ''; },
    };
    nodes.set(id, element);
    return element;
  }
  const network = { response: null, fail: false, status: 200, wait: null, bodyError: null };
  const requests = [];
  const context = createContext({
    document: { querySelector: node, getElementById: id => node('#' + id), querySelectorAll: () => [], documentElement: {} },
    localStorage: { getItem() {}, setItem() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: true }) },
    navigator: { onLine: false }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, Event: class { constructor(type) { this.type = type; } },
    crypto: { randomUUID }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url !== '/api/refine') assert.equal(node('#loading-state').hidden, false);
      if (network.wait) await network.wait;
      if (network.fail) throw new Error('Simulated connection failure');
      return { ok: network.status === 200, status: network.status, json: async () => { if (network.bodyError) throw network.bodyError; return { assessment: network.response, detail: 'Fixture service rejection' }; } };
    },
    testGet: async id => structuredClone(stored.get(id)),
    testPut: async record => stored.set(record.id, structuredClone(record)),
  });
  // Only external I/O is substituted; app event handlers and renderers execute unchanged.
  const isolatedSource = source
    .replace(/const getCase =[^\n]+/, 'const getCase = testGet;')
    .replace(/const putCase =[^\n]+/, 'const putCase = testPut;');
  runInContext(isolatedSource + `
    async function renderCasebook() {}
    async function readAsDataUrl() { return 'data:image/jpeg;base64,TEST_FIXTURE'; }
  `, context);

  return { node, stored, requests, context, network };
}

const assessment = text => ({ visual_observations: text, possible_causes: [], next_steps: ['Inspect leaves'], urgency: 'Monitor', follow_up_question: 'Has it spread?' });
const event = { preventDefault() {} };
async function selectPhoto(h) {
  h.node('#photo').files = [{ name: 'fixture.jpg', type: 'image/jpeg', size: 100 }];
  await h.node('#photo').handlers.change();
  h.node('#crop').value = 'Maize';
  h.node('#symptoms').value = 'Yellow leaves';
  h.node('#stage').value = 'Flowering';
  h.node('#location').value = 'Fixture area';
}
function checkResult(h, text) {
  assert.equal(h.node('#loading-state').hidden, true);
  assert.equal(h.node('#empty-state').hidden, true);
  assert.equal(h.node('#analysis-result').hidden, false);
  assert.ok(h.node('#analysis-result').innerHTML.includes(text));
  assert.equal(h.node('#submit-button').disabled, false);
}

export async function testPanel() {
  const reports = [];
  const first = await webHarness();
  await selectPhoto(first);
  await first.node('#save-local').handlers.click();
  assert.equal(first.requests.length, 0);
  assert.equal(first.stored.size, 1);
  const saved = [...first.stored.values()][0], id = saved.id;
  assert.equal(saved.observations[0].analysis.state, 'pending');
  assert.equal(saved.observations[0].stage, 'Flowering');
  assert.equal(saved.observations[0].location, 'Fixture area');
  assert.equal(saved.observations[0].photo.name, 'fixture.jpg');
  checkResult(first, 'Pending analysis');
  reports.push('Offline save retains photo and all details without a request');

  // A fresh app context shares only persisted records, not form/session state.
  const h = await webHarness(first.stored);
  assert.equal(h.requests.length, 0);
  h.context.showSavedAdvice(structuredClone(saved), 0);
  checkResult(h, 'Pending analysis');
  assert.equal(h.node('#symptoms').value, '');
  assert.equal(h.node('#photo').files.length, 0);
  reports.push('Reopening after reload reads the saved visit without uploading');

  h.network.fail = true;
  await h.context.retryWebAnalysis(id, 0);
  checkResult(h, 'Pending analysis');
  assert.equal(h.stored.get(id).observations.length, 1);
  assert.equal(h.stored.get(id).observations[0].photo.name, 'fixture.jpg');
  reports.push('Connection failure stops loading and retains the saved visit');

  h.network.fail = false;
  for (const status of [400, 502]) {
    h.network.status = status;
    await h.context.retryWebAnalysis(id, 0);
    assert.equal(h.stored.get(id).observations[0].analysis.state, 'error');
    assert.equal(h.stored.get(id).observations[0].analysis.kind, status === 400 ? 'input' : 'model');
    assert.equal(h.node('#loading-state').hidden, true);
  }
  h.network.status = 200;
  h.network.response = {};
  await h.context.retryWebAnalysis(id, 0);
  assert.equal(h.stored.get(id).observations[0].analysis.kind, 'model');
  reports.push('Input, model and malformed-response errors are not pending connection retries');
  h.network.bodyError = new TypeError('Interrupted body');
  await h.context.retryWebAnalysis(id, 0);
  assert.equal(h.stored.get(id).observations[0].analysis.state, 'pending');
  h.network.bodyError = new SyntaxError('Malformed JSON');
  await h.context.retryWebAnalysis(id, 0);
  assert.equal(h.stored.get(id).observations[0].analysis.kind, 'model');
  h.network.bodyError = null;
  reports.push('Interrupted response remains pending; malformed JSON is a service error');

  let release;
  h.network.wait = new Promise(resolve => { release = resolve; });
  h.network.response = assessment('Initial advice');
  const before = h.requests.length;
  const pending = h.context.retryWebAnalysis(id, 0);
  await h.context.retryWebAnalysis(id, 0);
  release();
  await pending;
  h.network.wait = null;
  checkResult(h, 'Initial advice');
  assert.equal(h.requests.length, before + 1);
  assert.equal(h.requests.at(-1).url, '/api/diagnose');
  assert.equal(h.requests.at(-1).body.stage, 'Flowering');
  assert.equal(h.stored.size, 1);
  assert.equal(h.stored.get(id).observations.length, 1);
  assert.equal(h.stored.get(id).observations[0].id, saved.observations[0].id);
  assert.equal(h.stored.get(id).observations[0].analysis.state, 'complete');
  assert.equal(h.node('#result-card').focused, true);
  reports.push('Duplicate retry taps send once; success updates the same saved visit despite offline hint');

  // Prepare a separate photo visit, keeping the original clarification draft.
  h.context.activateCase(structuredClone(h.stored.get(id)));
  h.node('#clarification-answer').value = 'Only on lower leaves';
  await h.node('#clarification-answer').handlers.input();
  await runInContext('draftWrites', h.context);
  await selectPhoto(h);
  h.network.fail = true;
  await h.node('#case-form').handlers.submit(event);
  checkResult(h, 'Pending analysis');
  assert.equal(h.requests.at(-1).url, '/api/followup');
  assert.equal(h.stored.get(id).observations.length, 2);
  assert.equal(h.stored.get(id).observations[0].clarificationDraft.answer, 'Only on lower leaves');
  assert.equal(h.stored.get(id).observations[0].assessment.visual_observations, 'Initial advice');
  h.network.fail = false;
  h.network.response = assessment('Comparison advice');
  await h.context.retryWebAnalysis(id, 1);
  checkResult(h, 'Comparison advice');
  assert.equal(h.stored.get(id).observations.length, 2);
  reports.push('Photo-comparison retry updates the second visit and preserves earlier advice/draft');

  h.node('#clarification-answer').value = 'It has not spread';
  h.network.fail = true;
  await h.node('#clarification-form').handlers.submit(event);
  checkResult(h, 'Comparison advice');
  assert.equal(h.node('#clarification-answer').value, 'It has not spread');
  assert.equal(h.node('#update-advice').disabled, false);
  h.network.fail = false;
  h.network.response = assessment('Revised advice');
  await h.node('#clarification-form').handlers.submit(event);
  checkResult(h, 'Revised advice');
  assert.equal(h.stored.get(id).observations.length, 2);
  assert.equal(h.stored.get(id).observations[1].clarifications.length, 1);
  assert.ok(h.node('#clarification-panel').innerHTML.includes('It has not spread'));
  reports.push('Clarification failure/retry preserves the answer and adds no photo visit');

  const initial = await webHarness();
  await selectPhoto(initial);
  initial.network.fail = true;
  await initial.node('#case-form').handlers.submit(event);
  assert.equal(initial.stored.size, 1);
  checkResult(initial, 'Pending analysis');
  reports.push('Initial analysis connection failure saves locally before attempting the request');

  const duplicate = await webHarness();
  await selectPhoto(duplicate);
  await Promise.all([duplicate.node('#save-local').handlers.click(), duplicate.node('#save-local').handlers.click()]);
  assert.equal(duplicate.stored.size, 1);
  assert.equal([...duplicate.stored.values()][0].observations.length, 1);
  reports.push('Duplicate local-save taps create only one visit');
  return reports;
}

export const results = await testPanel();
console.log(results.map(result => 'PASS: ' + result).join('\n'));
