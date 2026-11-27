// 语种自动识别（纯函数，无 DOM / 无存储依赖）。
// 思路：统计歌词主文本（line.text，不含翻译行）里三个字符区的数量——
//   ja：假名 + 汉字（本应用无中文模式，汉字计入日语区）
//   ko：谚文音节 / 字母
//   en：拉丁字母
// 单一语种占比 > 50% 时返回该语种，否则返回 null（视为无法断言，保持现状）。
const RE_JA = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const RE_KO = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g;
const RE_EN = /[A-Za-z]/g;

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

/** 逐行累计三个字符区的字符数量；空行不计数。 */
export function langCharCounts(lines) {
  const counts = { ja: 0, ko: 0, en: 0 };
  for (const line of lines || []) {
    const text = String(line?.text || '');
    if (!text.trim()) continue;
    counts.ja += countMatches(text, RE_JA);
    counts.ko += countMatches(text, RE_KO);
    counts.en += countMatches(text, RE_EN);
  }
  return counts;
}

/**
 * 识别歌词语种：返回 'ja' | 'ko' | 'en' 或 null。
 * 单一语种字符占比超过 50%（严格大于）才判定；混合 / 空文本返回 null。
 */
export function detectLyricLang(lines) {
  const counts = langCharCounts(lines);
  const total = counts.ja + counts.ko + counts.en;
  if (!total) return null;
  for (const lang of ['ja', 'en', 'ko']) {
    if (counts[lang] / total > 0.5) return lang;
  }
  return null;
}
