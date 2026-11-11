const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'public');
const source = readFileSync(path.join(root, 'app.js'), 'utf8');
const code = source.slice(source.indexOf('/* ---------------- Lyric font sizes'),
  source.indexOf('/* ---------------- Romaji annotations'));

function fixture(saved = null, failWrite = false) {
  const props = {};
  const elements = [];
  const notices = [];
  class Control extends EventTarget {
    constructor(key) {
      super();
      this.dataset = { fontSize: key };
      this.nextElementSibling = {};
      this.attributes = {};
    }
    setAttribute(name, value) { this.attributes[name] = value; }
  }
  class Container extends EventTarget {
    constructor() {
      super();
      this.reset = new EventTarget();
    }
    set innerHTML(value) {
      this.markup = value;
      this.inputs = [...value.matchAll(/data-font-size="([^"]+)"/g)].map(match => new Control(match[1]));
      elements.push(...this.inputs);
    }
    querySelector() { return this.reset; }
  }
  const containers = [new Container(), new Container()];
  const document = {
    documentElement: { style: { setProperty(key, value) { props[key] = value; } } },
    querySelectorAll(selector) {
      if (selector === '[data-font-settings]') return containers;
      const key = selector.match(/data-font-size="([^"]+)"/)?.[1];
      return elements.filter(el => el.dataset.fontSize === key);
    },
  };
  const storage = {
    getItem() { return saved; },
    setItem(key, value) {
      if (failWrite) throw new Error('storage disabled');
      saved = value;
    },
  };
  const studyStatus = {};
  vm.runInNewContext(code, {
    document, localStorage: storage, studyStatus, console: { warn() {} },
    setStatus(message) { notices.push(message); },
  });
  return { props, containers, elements, storage, notices, studyStatus };
}

function change(container, key, value) {
  const input = container.inputs.find(item => item.dataset.fontSize === key);
  input.value = String(value);
  const event = new Event('input');
  Object.defineProperty(event, 'target', { value: input });
  container.dispatchEvent(event);
}

test('defaults, independent sizes, cross-panel synchronization and persistence', () => {
  const f = fixture();
  assert.deepEqual(f.props, { '--font-furigana': 1, '--font-jp': 1, '--font-romaji': 1, '--font-zh': 1 });
  change(f.containers[0], 'jp', 150);
  change(f.containers[1], 'furigana', 70);
  assert.equal(f.props['--font-jp'], 1.5);
  assert.equal(f.props['--font-furigana'], 0.7);
  assert.equal(f.props['--font-romaji'], 1);
  assert.equal(f.containers[1].inputs.find(input => input.dataset.fontSize === 'jp').value, '150');
  assert.equal(f.containers[0].inputs[0].nextElementSibling.value, '70%');
  assert.deepEqual(JSON.parse(f.storage.getItem()), { furigana: 70, jp: 150, romaji: 100, zh: 100 });
  const reloaded = fixture(f.storage.getItem());
  assert.equal(reloaded.props['--font-jp'], 1.5);
  f.containers[1].reset.dispatchEvent(new Event('click'));
  assert.ok(Object.values(f.props).every(value => value === 1));
  assert.ok(f.elements.every(input => input.value === '100'));
});

test('bad saved values fall back independently and write failures are visible', () => {
  const f = fixture('{"furigana":200,"jp":1000,"romaji":"150","zh":90}', true);
  assert.deepEqual(f.props, { '--font-furigana': 1, '--font-jp': 1, '--font-romaji': 1, '--font-zh': 0.9 });
  change(f.containers[0], 'romaji', 130);
  assert.equal(f.props['--font-romaji'], 1.3);
  assert.match(f.notices[0], /无法保存/);
  assert.match(f.studyStatus.textContent, /无法保存/);
  assert.equal(fixture('null').props['--font-jp'], 1);
});

test('font settings are present in both modes and preserve existing visibility selectors', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.equal((html.match(/data-font-settings/g) || []).length, 2);
  assert.match(source, /min="70" max="150" step="10"/);
  assert.match(source, /saved\[key\] >= 70 && saved\[key\] <= 150/);
  assert.match(css, /\.lrc-line\.hide-furigana ruby rt/);
  assert.match(css, /\.lrc-line\.hide-romaji \.romaji/);
  assert.match(css, /\.lrc-line\.hide-zh \.zh/);
  assert.match(css, /var\(--jp-base-size\) \* 0\.5 \* var\(--font-furigana, 1\)/);
});
