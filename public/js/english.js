// 英语歌词：分词 + 标记存取 + 语言判定。
//
// 设计：日语数据（line.words / romaji / ruby）始终原样保留；英语模式不改动它们，
// 而是由 line.text 确定性地分出英语单词，标记单独持久化在 line.enMarks（按词序号）。
// 这样切换语言不会破坏任一语言的编辑成果，渲染 / 跟唱 / 标记共用 getWords(line)。
//
// 纯函数（segmentEnglish / marksFromWords）不依赖浏览器，可在 Node 中测试。
import { state } from './state.js';

export function isEnglish() {
  return state.settings.songLang === 'en';
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
 * 英语模式下的单词数组（含标记）。由 text 分词 + enMarks 还原，带签名缓存。
 * 日语模式不会调用此函数。
 */
export function englishWords(line) {
  const marks = line.enMarks || {};
  const sig = line.text + '|' + JSON.stringify(marks);
  if (line._enWords && line._enSig === sig) return line._enWords;
  const words = segmentEnglish(line.text);
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

/** 当前语言下用于渲染 / 跟唱 / 标记的单词数组。 */
export function getWords(line) {
  return isEnglish() ? englishWords(line) : line.words;
}

/** 英语标记类型（工具条用）。slash 为词内被划掉字母的字符偏移数组。 */
export const EN_MARKS = {
  slash: '划掉',
  link: '连音',
  note: '备注',
  brk: '停顿',
};