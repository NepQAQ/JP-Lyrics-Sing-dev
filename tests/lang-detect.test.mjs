// 语种自动识别 + 分行字号设置 持久化单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langCharCounts, detectLyricLang } from '../public/js/langdetect.js';

// Node 无 localStorage：用 Map 模拟（api.js 仅在函数内访问）
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { api } = await import('../public/js/api.js');

const L = (text) => ({ text });

test('langCharCounts 分区统计（假名+汉字 / 拉丁 / 谚文），跳过空行', () => {
  const c = langCharCounts([
    L('夜に駆ける'),
    L(''),
    L('hello world'),
    L('  '),
    L('안녕하세요'),
  ]);
  assert.equal(c.ja, 5);   // 夜に駆ける → 汉字2 + 假名3
  assert.equal(c.en, 10);  // hello world
  assert.equal(c.ko, 5);
});

test('detectLyricLang：日语 / 英语 / 韩语', () => {
  assert.equal(detectLyricLang([L('夜に駆ける'), L('二人の'), L('時間')]), 'ja');
  assert.equal(detectLyricLang([L('I woke up to the fire')]), 'en');
  assert.equal(detectLyricLang([L('사랑해요'), L('그대여')]), 'ko');
});

test('detectLyricLang：占比不过半 / 混合 → null', () => {
  // 假名2 + 拉丁2：平局 50%（严格大于才判定）→ null
  assert.equal(detectLyricLang([L('風花 ab')]), null);
  assert.equal(detectLyricLang([L('♪…!!')]), null);
  assert.equal(detectLyricLang([]), null);
});

test('detectLyricLang：恰好 50%（不含）→ null，刚过 50% → 识别', () => {
  // 2 ja + 2 en：恰好一半 → null
  assert.equal(detectLyricLang([L('風花ab')]), null);
  // 3 ja + 1 en：> 50% → ja
  assert.equal(detectLyricLang([L('風花雪a')]), 'ja');
});

test('分行字号：8 个独立系数随设置持久化并可读回', async () => {
  store.clear();
  const keys = ['fontKa', 'fontJp', 'fontRo', 'fontZh', 'fontEnJp', 'fontEnIpa', 'fontKoJp', 'fontKoRo'];
  const patch = {};
  keys.forEach((k, i) => { patch[k] = 0.6 + i * 0.05; });
  await api.saveSettings(patch);
  const s = await api.settings();
  for (const [k, v] of Object.entries(patch)) assert.equal(s[k], v, k);
  // 默认值
  store.clear();
  const d = await api.settings();
  keys.forEach((k) => assert.equal(d[k], 1, k));
});

test('分行字号：未知键被丢弃（白名单 = DEFAULT_SETTINGS）', async () => {
  store.clear();
  await api.saveSettings({ fontJp: 1.3, fontBogus: 2 });
  const s = await api.settings();
  assert.equal(s.fontJp, 1.3);
  assert.equal(s.fontBogus, undefined);
});
