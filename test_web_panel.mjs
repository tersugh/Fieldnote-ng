// Dependency-free workflow regression tests with simulated DOM, storage and HTTP.
// Run: node test_web_panel.mjs. No server, browser, real photos or API keys needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';

export async function testPanel(root = new URL('.', import.meta.url)) {
  const read = (name) => readFile(new URL(name, root), 'utf8');
  const [source, html, css] = await Promise.all(['app.js', 'index.html', 'styles.css'].map(read));
  assert.match(css, /\.result-card \[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.equal((html.match(/id="analysis-result"/g) || []).length, 1);
  assert.match(html, /id="result-card"[^>]*tabindex="-1"/);
  const nodes = new Map();
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const element = {
      value: '', hidden: ['#loading-state', '#analysis-result', '#clarification-panel', '#error-state'].includes(id),
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
  let stored = new Map(), response, fail = false;
  const requests = [];
  const context = createContext({
    document: { querySelector: node, getElementById: id => node('#' + id), querySelectorAll: () => [], documentElement: {} },
    localStorage: { getItem() {}, setItem() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: true }) },
    URL: { createObjectURL: () => 'blob:test' }, Event: class { constructor(type) { this.type = type; } },
    crypto: { randomUUID }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url !== '/api/refine') assert.equal(node('#loading-state').hidden, false);
      if (fail) throw new Error('Simulated connection failure');
      return { ok: true, json: async () => ({ assessment: response }) };
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
  const assessment = text => ({ visual_observations: text, possible_causes: [], next_steps: ['Inspect leaves'], urgency: 'Monitor', follow_up_question: 'Has it spread?' });
  const event = { preventDefault() {} };
  const selectPhoto = async () => {
    node('#photo').files = [{ name: 'fixture.jpg', type: 'image/jpeg', size: 100 }];
    await node('#photo').handlers.change();
    node('#crop').value = 'Maize';
    node('#symptoms').value = 'Yellow leaves';
  };
  const checkResult = text => {
    assert.equal(node('#loading-state').hidden, true);
    assert.equal(node('#empty-state').hidden, true);
    assert.equal(node('#analysis-result').hidden, false);
    assert.ok(node('#analysis-result').innerHTML.includes(text));
    assert.equal(node('#submit-button').disabled, false);
  };
  const reports = [];
  await selectPhoto();
  fail = true;
  await node('#case-form').handlers.submit(event);
  assert.equal(node('#loading-state').hidden, true);
  assert.equal(node('#submit-button').disabled, false);
  assert.equal(node('#error-state').hidden, false);
  assert.equal(stored.size, 0);
  reports.push('Initial diagnosis failure stops loading and retains inputs');
  fail = false; response = assessment('Initial advice');
  await node('#case-form').handlers.submit(event);
  checkResult('Initial advice');
  assert.equal(requests.at(-1).url, '/api/diagnose');
  assert.equal(node('#result-card').scrolls, 1);
  assert.equal(node('#result-card').focused, true);
  reports.push('Initial diagnosis renders and focuses the existing panel');

  node('#clarification-answer').value = 'Only on lower leaves';
  await node('#clarification-answer').handlers.input();
  await runInContext('draftWrites', context);
  await selectPhoto();
  checkResult('Initial advice');
  fail = true;
  await node('#case-form').handlers.submit(event);
  checkResult('Initial advice');
  assert.equal(node('#clarification-answer').value, 'Only on lower leaves');
  assert.equal(requests.at(-1).url, '/api/followup');
  assert.equal([...stored.values()][0].observations.length, 1);
  reports.push('Comparison failure preserves prior assessment and clarification draft');
  fail = false; response = assessment('Comparison advice');
  await node('#case-form').handlers.submit(event);
  checkResult('Comparison advice');
  assert.equal(node('#result-card').scrolls, 2);
  assert.equal([...stored.values()][0].observations.length, 2);
  reports.push('Comparison success replaces panel advice and adds one dated visit');

  node('#clarification-answer').value = 'It has not spread';
  fail = true;
  await node('#clarification-form').handlers.submit(event);
  checkResult('Comparison advice');
  assert.equal(node('#clarification-answer').value, 'It has not spread');
  assert.equal(node('#update-advice').disabled, false);
  assert.equal(requests.at(-1).url, '/api/refine');
  reports.push('Clarification failure keeps advice and editable answer for retry');
  fail = false; response = assessment('Revised advice');
  await node('#clarification-form').handlers.submit(event);
  checkResult('Revised advice');
  assert.equal(node('#result-card').scrolls, 3);
  const record = [...stored.values()][0];
  assert.equal(record.observations.length, 2);
  assert.equal(record.observations[1].clarifications.length, 1);
  assert.equal(record.observations[1].clarifications[0].answer, 'It has not spread');
  assert.ok(node('#clarification-panel').innerHTML.includes('It has not spread'));
  assert.equal(node('#clarification-answer').value, '');
  reports.push('Clarification retry replaces advice, retains history, and adds no photo visit');
  return reports;
}

// Importing also runs the suite, allowing execution without a shell command.
export const results = await testPanel();
console.log(results.map(result => 'PASS: ' + result).join('\n'));
