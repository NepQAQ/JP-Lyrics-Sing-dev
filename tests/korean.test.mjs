// 韩语模式：谚文罗马字表记（RR）+ 分词 + koMarks 存取（纯函数）单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  romanizeWord, segmentKorean, koreanWords, lineRomanization, isKorean,
} from '../public/js/korean.js';
import { getWords, marksFromWords } from '../public/js/english.js';
import { state } from '../public/js/state.js';

test('romanizeWord 基础音节（无终声 / 简单终声）', () => {
  assert.equal(romanizeWord('한국'), 'hanguk');
  assert.equal(romanizeWord('사랑'), 'sarang');
  assert.equal(romanizeWord('노래'), 'norae');
  assert.equal(romanizeWord('하늘'), 'haneul');
  assert.equal(romanizeWord(''), '');
});

test('romanizeWord 音节间标准字母变化（连音 / 鼻音化 / 流音化 / 腭化 / ㅎ 脱落）', () => {
  const cases = [
    ['종로', 'jongno'],   // ㄱ + ㄹ → ng n
    ['합니', 'hamni'],    // ㅂ + ㄴ → m n
    ['합니다', 'hamnida'],
    ['신라', 'silla'],    // ㄴ + ㄹ → l l
    ['설날', 'seollal'],  // ㄹ + ㄴ → l l
    ['국물', 'gungmul'],  // ㄱ + ㅁ → ng m
    ['좋아', 'joa'],      // ㅎ 终声 + 元音 → 脱落
    ['먹어', 'meogeo'],   // 连音
    ['있어', 'isseo'],    // ㅆ 连音
    ['같이', 'gachi'],    // ㅌ + 이 → chi
    ['굳이', 'guji'],     // ㄷ + 이 → ji
    ['많아', 'mana'],     // ㄶ + 元音 → ㅎ 脱落、ㄴ 连音
    ['싫어', 'sireo'],    // ㅀ + 元音 → ㄹ 连音
    ['값이', 'gapsi'],    // ㅄ 拆分连音
    ['앉아', 'anja'],     // ㄵ 拆分连音
    ['밟아', 'balba'],    // ㄼ 拆分连音
    ['밖에', 'bakke'],    // ㄲ 连音
    ['놓고', 'noko'],     // ㅎ + ㄱ → k
    ['놓다', 'nota'],     // ㅎ + ㄷ → t
    ['좋고', 'joko'],
    ['안녕', 'annyeong'],
    ['먹고', 'meokgo'],   // 无同化：k + g
  ];
  for (const [word, expected] of cases) {
    assert.equal(romanizeWord(word), expected, word);
  }
});

test('romanizeWord 非谚文字符原样保留', () => {
  assert.equal(romanizeWord('Hello'), 'Hello');
  assert.equal(romanizeWord('사랑 Yo!'), 'sarang Yo!');
  assert.equal(romanizeWord('123'), '123');
});

test('segmentKorean 拼接还原原文（含标点 / 拉丁混排）', () => {
  const samples = [
    '너무 보고 싶어',
    '사랑해 (Hello) world!',
    '안녕, 우리 다시 만나자…',
    '   ',
    '',
  ];
  for (const text of samples) {
    const words = segmentKorean(text);
    assert.equal(words.map((w) => w.t).join(''), text, text);
  }
});

test('segmentKorean 谚文 / 拉丁词块不带 p，空白标点带 p:1', () => {
  const words = segmentKorean('사랑해, Yo');
  assert.deepEqual(words.map((w) => w.t), ['사랑해', ',', ' ', 'Yo']);
  assert.equal(words[0].p, undefined);
  assert.equal(words[1].p, 1);
  assert.equal(words[2].p, 1);
  assert.equal(words[3].p, undefined);
});

test('koreanWords 还原 koMarks（连音 / 备注），不读 enMarks', () => {
  const line = {
    text: '너무 보고 싶어',
    koMarks: { 2: { link: true }, 4: { note: '시퍼' } },
    enMarks: { 0: { slash: [0] } },
  };
  const words = koreanWords(line);
  assert.deepEqual(words.map((w) => w.t), ['너무', ' ', '보고', ' ', '싶어']);
  assert.deepEqual(words[2].m, { link: true });
  assert.deepEqual(words[4].m, { note: '시퍼' });
  assert.equal(words[0].m, undefined); // enMarks 不影响韩语
});

test('koreanWords 缓存：标记 / 文本变更后失效', () => {
  const line = { text: '보고 싶어', koMarks: { 0: { note: 'a' } } };
  const first = koreanWords(line);
  assert.equal(koreanWords(line), first);
  line.koMarks = { 0: { note: 'b' } };
  const second = koreanWords(line);
  assert.notEqual(second, first);
  assert.deepEqual(second[0].m, { note: 'b' });
  line.text = '다른 가사';
  assert.notEqual(koreanWords(line), second);
});

test('marksFromWords 对韩语词同样按词索引提取（与 enMarks 格式兼容）', () => {
  const line = { text: '너무 보고 싶어', koMarks: { 2: { link: true, note: 'n' } } };
  const words = koreanWords(line);
  assert.deepEqual(marksFromWords(words), { 2: { link: true, note: 'n' } });
});

test('getWords 按 songLang 分流：ja→words，en→enMarks，ko→koMarks', () => {
  const jaLine = {
    text: '보고 싶어',
    words: [{ t: '보고', k: '보고', r: 'bogo' }, { t: ' ', p: 1 }, { t: '싶어', k: '싶어', r: 'sipeo' }],
  };
  const enLine = { text: 'I fire up', enMarks: { 2: { note: 'en' } } };
  const koLine = { text: '보고 싶어', koMarks: { 0: { note: 'ko' } }, enMarks: { 0: { note: 'en' } } };
  const prev = state.settings.songLang;
  try {
    state.settings.songLang = 'ja';
    assert.equal(getWords(jaLine), jaLine.words);
    state.settings.songLang = 'en';
    assert.deepEqual(getWords(enLine)[2].m, { note: 'en' });
    state.settings.songLang = 'ko';
    assert.deepEqual(getWords(koLine)[0].m, { note: 'ko' }); // koMarks 优先，enMarks 不干扰
    assert.equal(isKorean(), true);
  } finally {
    state.settings.songLang = prev;
  }
});

test('lineRomanization 跳过标点 / 空白，整行拼接', () => {
  const words = segmentKorean('종로에서 합니, Yo!');
  assert.equal(lineRomanization(words), 'jongnoeseo hamni Yo');
  assert.equal(lineRomanization([]), '');
  assert.equal(lineRomanization(null), '');
});