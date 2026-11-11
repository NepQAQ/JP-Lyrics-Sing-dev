const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'public');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const css = readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = readFileSync(path.join(root, 'app.js'), 'utf8');

test('keeps one accessible search form beside the JP mode selector', () => {
  assert.equal((html.match(/<form\b[^>]*id="search-form"/g) || []).length, 1);
  assert.match(html, /class="header-search" id="search-form"/);
  assert.match(html, /id="btn-app-mode"[\s\S]*?<span class="brand-mode-text">JP<\/span>/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(app, /function setBrandModeMenuOpen\(open\)/);
});

test('retains every header utility through the compact mobile menu', () => {
  for (const id of ['btn-search-history', 'btn-export', 'btn-theme', 'btn-toggle-panel']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="btn-header-utilities"/);
  assert.match(css, /body\.header-utilities-open \.header-utilities/);
  assert.match(app, /function setHeaderUtilitiesOpen\(open\)/);
});

test('uses close-sized default romaji and accessible local-audio nudges', () => {
  assert.match(css, /font-size: calc\(22px \* var\(--font-romaji, 1\)\)/);
  assert.match(css, /font-size: calc\(27px \* var\(--font-romaji, 1\)\)/);
  assert.match(html, /id="btn-player-back"[^>]*disabled[^>]*aria-label="后退 0\.5 秒"/);
  assert.match(html, /id="btn-player-fwd"[^>]*disabled[^>]*aria-label="前进 0\.5 秒"/);
  assert.match(html, /<audio id="audio"[^>]*controls/);
  assert.match(app, /nudgeAudio\(delta\)/);
  assert.match(app, /player\.nudgeAudio\(-0\.5\)/);
  assert.match(app, /player\.nudgeAudio\(\+0\.5\)/);
});
