// 英语歌词：分词 + 标记存取 + 语言判定。
//
// 设计：日语数据（line.words / romaji / ruby）始终原样保留；英语模式不改动它们，
// 而是由 line.text 确定性地分出英语单词，标记单独持久化在 line.enMarks（按词序号）。
// 这样切换语言不会破坏任一语言的编辑成果，渲染 / 跟唱 / 标记共用 getWords(line)。
//
// 纯函数（segmentEnglish / marksFromWords）不依赖浏览器，可在 Node 中测试。
import { state } from './state.js';
import { koreanWords, isKorean, segmentKorean } from './korean.js';

export { isKorean };

export function isEnglish() {
  return state.settings.songLang === 'en';
}

/** 英语 / 韩语共用「按词标记」机制（区别于日语的读音标记）。 */
export function isWordMarks() {
  const l = state.settings.songLang;
  return l === 'en' || l === 'ko';
}

/** 当前语言的标记持久化字段（各语言互不干扰）。 */
export function marksField() {
  return state.settings.songLang === 'ko' ? 'koMarks' : 'enMarks';
}

/** 当前语言的按词注音持久化字段（en: enWords / ko: koWords；存 [{t, p?, r?}]）。 */
export function wordsField() {
  return state.settings.songLang === 'ko' ? 'koWords' : 'enWords';
}

/** 当前语言的整行注音覆盖字段（en: enIpa / ko: koRomaji）。 */
export function readingLineField() {
  return state.settings.songLang === 'ko' ? 'koRomaji' : 'enIpa';
}

// 词 = 字母 / 数字 / 撇号 / 连字符的连续串；其余（空白、标点）为 p:1 占位词。
// 保证 words.map(w => w.t).join('') === text（编辑器按字符切分依赖此不变量）。
const TOKEN_RE = /[A-Za-z0-9'’-]+|\s+|[^\sA-Za-z0-9'’-]+/g;

/** 把一行英语原文确定性分词，返回 [{t, p?}]。 */
export function segmentEnglish(text) {
  const s = String(text ?? '');
  const words = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    const t = m[0];
    if (/^[A-Za-z0-9'’-]+$/.test(t)) words.push({ t });
    else words.push({ t, p: 1 });
  }
  return words;
}

/** 从单词数组提取非空标记 → { 词序号: mark }，用于持久化 enMarks。 */
export function marksFromWords(words) {
  const out = {};
  if (!Array.isArray(words)) return out;
  words.forEach((w, i) => {
    if (w && !w.p && w.m && Object.keys(w.m).length) out[i] = w.m;
  });
  return out;
}

/**
 * 英语模式下的单词数组（含标记与手动读音）。带签名缓存。
 * 基础词表优先取持久化的 line.enWords（保存过手动分词 / 读音时），
 * 与原文对不上（陈旧）时回退自动分词；标记由 enMarks 按词序号覆盖。
 * 日语模式不会调用此函数。
 */
export function englishWords(line) {
  const marks = line.enMarks || {};
  const stored = Array.isArray(line.enWords) && line.enWords.map((w) => w?.t ?? '').join('') === String(line.text ?? '')
    ? line.enWords : null;
  const sig = line.text + '|' + JSON.stringify(marks) + '|' + (stored ? JSON.stringify(stored) : '');
  if (line._enWords && line._enSig === sig) return line._enWords;
  const words = (stored || segmentEnglish(line.text)).map((w) => ({ ...w }));
  for (const [i, m] of Object.entries(marks)) {
    const idx = Number(i);
    if (words[idx] && !words[idx].p && m && Object.keys(m).length) {
      words[idx].m = { ...m };
    }
  }
  line._enWords = words;
  line._enSig = sig;
  return words;
}

/** 持久化用的纯词表：只保留 t / p / r（丢掉 m 标记与运行时缓存字段）。 */
export function stripWmWords(words) {
  if (!Array.isArray(words)) return null;
  const out = [];
  for (const w of words) {
    if (!w || typeof w.t !== 'string') continue;
    const nw = { t: w.t };
    if (w.p) nw.p = 1;
    if (typeof w.r === 'string' && w.r.trim()) nw.r = w.r.trim();
    out.push(nw);
  }
  return out;
}

/** 词表结构与当前语言的自动分词是否不同（t / p / 手动读音 任一不同）。 */
export function wmStructureChanged(words, text) {
  const auto = isKorean() ? segmentKorean(text) : segmentEnglish(text);
  return JSON.stringify(stripWmWords(auto)) !== JSON.stringify(stripWmWords(words));
}

/**
 * 按字符切点把词表里的第 wi 个词拆开（cuts 为词内字符偏移）。
 * 拆出的部分不保留原词的标记 / 读音（偏移会错位，自动读音会重算，可在行编辑器里改）。
 */
export function wmSplitWord(words, wi, cuts) {
  const out = words.map((w) => ({ ...w }));
  const w = out[wi];
  if (!w || w.p || !Array.isArray(cuts) || !cuts.length) return out;
  const chars = [...w.t];
  const points = [...new Set([0, ...cuts.filter((c) => Number.isInteger(c) && c > 0 && c < chars.length), chars.length])].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i + 1 < points.length; i++) parts.push(chars.slice(points[i], points[i + 1]).join(''));
  if (parts.length < 2) return out;
  out.splice(wi, 1, ...parts.map((t) => ({ t })));
  return out;
}

/** 当前语言下用于渲染 / 跟唱 / 标记的单词数组。 */
export function getWords(line) {
  const l = state.settings.songLang;
  if (l === 'en') return englishWords(line);
  if (l === 'ko') return koreanWords(line);
  return line.words;
}

/** 英语标记类型（工具条用）。slash 为词内被划掉字母的字符偏移数组。 */
export const EN_MARKS = {
  slash: '划掉',
  link: '连音',
  note: '备注',
  brk: '停顿',
};