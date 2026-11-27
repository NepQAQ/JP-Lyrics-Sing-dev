// 英语模式：分词 + 标记存取（纯函数）单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentEnglish, marksFromWords, englishWords, getWords, EN_MARKS,
} from '../public/js/english.js';
import { state } from '../public/js/state.js';

test('segmentEnglish 拼接还原原文（含标点 / 缩写 / 连字符）', () => {
  const samples = [
    "I woke up to the fire",
    "Don't stop me now, it's a beautiful night!",
    "well-known (hello) world…",
    "   ",
    "",
  ];
  for (const text of samples) {
    const words = segmentEnglish(text);
    assert.equal(words.map((w) => w.t).join(''), text, text);
  }
});

test('segmentEnglish 标点块带 p:1，词块不带', () => {
  const words = segmentEnglish("Hi, don't");
  assert.deepEqual(words.map((w) => w.t), ['Hi', ',', ' ', "don't"]);
  assert.equal(words[0].p, undefined);
  assert.equal(words[1].p, 1);
  assert.equal(words[2].p, 1);
  assert.equal(words[3].p, undefined);
});

test('marksFromWords 提取词级标记（按词索引）', () => {
  const words = [
    { t: 'I' },
    { t: ' ', p: 1 },
    { t: 'fire', m: { slash: [1, 2], link: true } },
    { t: ' ', p: 1 },
    { t: 'up', m: { note: '/ʌp/' } },
  ];
  assert.deepEqual(marksFromWords(words), { 2: { slash: [1, 2], link: true }, 4: { note: '/ʌp/' } });
  assert.deepEqual(marksFromWords([{ t: 'x' }, { t: ' ', p: 1 }]), {});
  assert.deepEqual(marksFromWords(null), {});
});

test('englishWords 还原 enMarks（划掉 / 连音 / 备注）', () => {
  const line = { text: 'I fire up', enMarks: { 2: { slash: [2], link: true }, 4: { note: '/ʌp/' } } };
  const words = englishWords(line);
  assert.deepEqual(words.map((w) => w.t), ['I', ' ', 'fire', ' ', 'up']);
  assert.deepEqual(words[2].m, { slash: [2], link: true });
  assert.deepEqual(words[4].m, { note: '/ʌp/' });
  assert.equal(words[0].m, undefined);
});

test('englishWords 缓存：标记 / 文本变更后失效', () => {
  const line = { text: 'I fire up', enMarks: { 2: { note: 'a' } } };
  const first = englishWords(line);
  assert.equal(englishWords(line), first); // 未变 → 同一引用（缓存命中）
  line.enMarks = { 2: { note: 'b' } };
  const second = englishWords(line);
  assert.notEqual(second, first);
  assert.equal(second[2].m.note, 'b');
  line.text = 'I fire up now';
  const third = englishWords(line);
  assert.notEqual(third, second);
  assert.equal(third.map((w) => w.t).join(''), 'I fire up now');
});

test('getWords 英语用派生词、日语用原 words', () => {
  const jpWords = [{ t: '火', k: 'ひ', r: 'hi' }];
  const line = { text: 'fire', words: jpWords, enMarks: {} };
  state.settings = state.settings || {};
  state.settings.songLang = 'ja';
  assert.equal(getWords(line), jpWords);
  state.settings.songLang = 'en';
  const en = getWords(line);
  assert.deepEqual(en.map((w) => w.t), ['fire']);
  assert.notEqual(en, jpWords);
  state.settings.songLang = 'ja';
});

test('EN_MARKS 英语标记标签映射', () => {
  assert.deepEqual(EN_MARKS, { slash: '划掉', link: '连音', note: '备注', brk: '停顿' });
});