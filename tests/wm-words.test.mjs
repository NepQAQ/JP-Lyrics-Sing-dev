// 英语 IPA / 韩语罗马字 行：可编辑分词（词级 t/p/r + 整行存储）单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentEnglish, englishWords, getWords,
  wordsField, readingLineField, stripWmWords, wmStructureChanged, wmSplitWord,
} from '../public/js/english.js';
import { koreanWords, segmentKorean, romanizeWord } from '../public/js/korean.js';
import { state } from '../public/js/state.js';

test('wordsField / readingLineField 按语种映射字段', () => {
  state.settings.songLang = 'en';
  assert.equal(wordsField(), 'enWords');
  assert.equal(readingLineField(), 'enIpa');
  state.settings.songLang = 'ko';
  assert.equal(wordsField(), 'koWords');
  assert.equal(readingLineField(), 'koRomaji');
  state.settings.songLang = 'ja';
  assert.equal(wordsField(), 'enWords'); // ja 时沿用英语字段（不使用）
  assert.equal(readingLineField(), 'enIpa');
  state.settings.songLang = 'ja';
});

test('stripWmWords 去掉词级标记 m，保留 t / p / r', () => {
  const words = [
    { t: 'I' },
    { t: ' ', p: 1 },
    { t: 'fire', r: '/faɪər/', m: { slash: [1], link: true } },
    { t: ',', p: 1 },
  ];
  assert.deepEqual(stripWmWords(words), [
    { t: 'I' },
    { t: ' ', p: 1 },
    { t: 'fire', r: '/faɪər/' },
    { t: ',', p: 1 },
  ]);
});

test('wmSplitWord 按字符切点拆词，拆分后丢弃 r 与 m', () => {
  const words = segmentEnglish('fire up');
  const next = wmSplitWord(words, 0, [2]); // fire → fi + re
  assert.deepEqual(next.map((w) => w.t), ['fi', 're', ' ', 'up']);
  assert.equal(next[0].r, undefined);
  assert.equal(next[1].r, undefined);
  // 重新拼接仍等于原文
  assert.equal(next.map((w) => w.t).join(''), 'fire up');
});

test('wmStructureChanged(words, text)：结构 / 手动读音变化为 true，标记变化不算', () => {
  const base = segmentEnglish('fire up');
  assert.equal(wmStructureChanged(base, 'fire up'), false);
  assert.equal(wmStructureChanged(wmSplitWord(base, 0, [2]), 'fire up'), true);
  const withR = base.map((w) => (w.t === 'fire' ? { ...w, r: 'override' } : w));
  assert.equal(wmStructureChanged(withR, 'fire up'), true);
  const withM = base.map((w) => (w.t === 'fire' ? { ...w, m: { link: true } } : w));
  assert.equal(wmStructureChanged(withM, 'fire up'), false);
});

// ---------------------------------------------------------------- 英语：存储分词为基准

test('englishWords 使用已存储 enWords 为基准（含 r 覆盖），拼接等于原文', () => {
  state.settings.songLang = 'en';
  const stored = segmentEnglish('I fire up');
  stored[2].r = '/faɪə/'; // fire 的手动修改
  const line = { text: 'I fire up', enWords: stored };
  const words = englishWords(line);
  assert.equal(words[2].r, '/faɪə/');
  assert.equal(words.map((w) => w.t).join(''), 'I fire up');
  state.settings.songLang = 'ja';
});

test('englishWords 存储分词与文本不符（陈旧）→ 回退自动分词', () => {
  state.settings.songLang = 'en';
  const stored = segmentEnglish('I fired up');
  const line = { text: 'I fire up', enWords: stored };
  const words = englishWords(line);
  assert.equal(words.map((w) => w.t).join(''), 'I fire up');
  assert.equal(words[2].t, 'fire');
  state.settings.songLang = 'ja';
});

test('englishWords 结构变化后覆盖存储仍保留手动 r；标记按词索引覆盖', () => {
  state.settings.songLang = 'en';
  const stored = segmentEnglish('I fire up');
  stored[2].r = '/faɪə/';
  const line = {
    text: 'I fire up',
    enWords: stored,
    enMarks: { 4: { note: '/ʌp/' } },
  };
  const words = englishWords(line);
  assert.equal(words[2].r, '/faɪə/');
  assert.deepEqual(words[4].m, { note: '/ʌp/' });
  state.settings.songLang = 'ja';
});

test('englishWords 缓存：enWords / enMarks / 文本变更后失效', () => {
  state.settings.songLang = 'en';
  const stored = segmentEnglish('I fire up');
  const line = { text: 'I fire up', enWords: stored };
  const first = englishWords(line);
  assert.equal(englishWords(line), first);
  line.enMarks = { 2: { link: true } };
  assert.notEqual(englishWords(line), first);
  line.text = 'I fired up';
  delete line.enMarks;
  assert.notEqual(englishWords(line), first);
  state.settings.songLang = 'ja';
});

// ---------------------------------------------------------------- 韩语：存储分词为基准

test('koreanWords 使用已存储 koWords 为基准，拼接等于原文', () => {
  state.settings.songLang = 'ko';
  const stored = segmentKorean('사랑해요 그대여');
  stored[0].r = 'sa-rang'; // 手动修改的罗马字
  const line = { text: '사랑해요 그대여', koWords: stored };
  const words = koreanWords(line);
  assert.equal(words[0].r, 'sa-rang');
  assert.equal(words.map((w) => w.t).join(''), '사랑해요 그대여');
  state.settings.songLang = 'ja';
});

test('koreanWords 陈旧存储回退自动分词；r 覆盖参与渲染基准', () => {
  state.settings.songLang = 'ko';
  const stored = segmentKorean('사랑해');
  const line = { text: '사랑해요', koWords: stored };
  const words = koreanWords(line);
  assert.equal(words.map((w) => w.t).join(''), '사랑해요');
  state.settings.songLang = 'ja';
});

test('romanizeWord 基准转换（词级，用于自动注音占位）', () => {
  assert.equal(romanizeWord('사랑'), 'sarang');
  assert.equal(romanizeWord('안녕'), 'annyeong');
});

// ---------------------------------------------------------------- getWords 路由

test('getWords 按当前语种路由：en→englishWords，ko→koreanWords，ja→line.words', () => {
  const words = segmentEnglish('fire');
  const line = {
    text: 'fire',
    words: [{ t: 'fire', h: '', r: 'fai' }],
    enWords: words,
  };
  state.settings.songLang = 'ja';
  assert.equal(getWords(line), line.words);
  state.settings.songLang = 'en';
  assert.deepEqual(getWords(line).map((w) => w.t), ['fire']);
  state.settings.songLang = 'ko';
  // ko 语种下没有 koWords → 自动谚文分词
  assert.ok(getWords(line).length > 0);
  state.settings.songLang = 'ja';
});
