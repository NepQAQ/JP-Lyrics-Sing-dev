// 歌曲语言设置（songLang）持久化 + 英语翻译语言对 单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Node 无 localStorage：用 Map 模拟（api.js 仅在函数内访问）
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { api } = await import('../public/js/api.js');

test('songLang 默认日语', async () => {
  store.clear();
  const s = await api.settings();
  assert.equal(s.songLang, 'ja');
});

test('saveSettings 持久化 songLang=en 并可读回', async () => {
  store.clear();
  await api.saveSettings({ songLang: 'en' });
  const s = await api.settings();
  assert.equal(s.songLang, 'en');
  // 切回日语
  await api.saveSettings({ songLang: 'ja' });
  assert.equal((await api.settings()).songLang, 'ja');
});

test('saveSettings 丢弃未知设置项（只存 DEFAULT_SETTINGS 键）', async () => {
  store.clear();
  await api.saveSettings({ songLang: 'en', bogusKey: 123 });
  const s = await api.settings();
  assert.equal(s.songLang, 'en');
  assert.equal(s.bogusKey, undefined);
});

test('saveSettings 持久化 songLang=ko 并可读回', async () => {
  store.clear();
  await api.saveSettings({ songLang: 'ko' });
  assert.equal((await api.settings()).songLang, 'ko');
  await api.saveSettings({ songLang: 'ja' });
  assert.equal((await api.settings()).songLang, 'ja');
});

test('translate 韩语 → zh-CN', async () => {
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ responseData: { translatedText: '你好' } }) };
  };
  try {
    const ko = await api.online.translate(['안녕하세요'], { from: 'ko' });
    assert.deepEqual(ko.results, ['你好']);
    assert.ok(urls[0].includes('langpair=ko|zh-CN'), urls[0]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('translate 英语 → zh-CN，默认日语 → zh-CN', async () => {
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ responseData: { translatedText: '你好' } }) };
  };
  try {
    const en = await api.online.translate(['hello'], { from: 'en' });
    assert.deepEqual(en.results, ['你好']);
    assert.ok(urls[0].includes('langpair=en|zh-CN'), urls[0]);

    const ja = await api.online.translate(['こんにちは']);
    assert.ok(urls[1].includes('langpair=ja|zh-CN'), urls[1]);
  } finally {
    globalThis.fetch = realFetch;
  }
});