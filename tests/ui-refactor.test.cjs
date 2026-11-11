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

test('uses the lyric-first mobile structure with collapsible sources and settings drawers', () => {
  assert.match(html, /id="btn-source-panel"/);
  assert.match(html, /id="panel" class="panel source-panel glass hidden"/);
  assert.match(html, /id="display-drawer" class="settings-drawer"/);
  assert.match(html, /id="font-drawer" class="settings-drawer"/);
  assert.match(html, /id="auto-scroll-lyrics"/);
  assert.match(html, /id="display-extra-slot"/);
  assert.match(html, /id="overrides-popover"/);
  assert.match(app, /function moveLyricsControlsIntoDrawers/);
  assert.match(app, /function keepFocusInDrawer/);
  assert.match(app, /function shouldAutoScrollLyrics/);
  assert.match(app, /setPanelCollapsed\(false\);/);
  assert.match(css, /\.source-panel\.hidden \{ display: none; \}/);
  assert.match(css, /\.settings-drawer \{/);
});

test('keeps theme in the header and moves secondary utilities into display settings', () => {
  for (const id of ['btn-search-history', 'btn-export', 'btn-theme', 'btn-toggle-panel']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /\$\(\'\.header-actions\'\)\?\.appendChild\(\$\(\'#btn-theme\'\)\)/);
  assert.match(app, /const tools = \$\('#display-tools-slot'\)/);
  assert.match(css, /#btn-header-utilities, #header-utilities \{ display: none !important; \}/);
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

test('applies the responsive Figma-derived system to every interactive surface', () => {
  for (const selector of [
    '.search-results', '.result-item', '.assist-actions', '.overrides-popover',
    '.annotation-popover', '.lrc-line.active', '.song-practice', '.study-panel',
    '.player-bar', '.timer-hud',
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(css, /Product-wide Figma-derived interface system/);
  assert.match(css, /Final mobile settings hierarchy/);
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /body\.no-player \.player-bar \{ transform: translate\(-50%, 150%\);/);
});
