// 英语音标（IPA）：ARPAbet → IPA 转换 + CMUdict 查词。
//
// 纯函数部分（arpabetToIPA / normalizeWord / lookupIPA / lineIPA）不依赖浏览器，
// 可在 Node 中直接 import 用于单元测试；loadCMUDict() 仅在浏览器英语模式下懒加载。
//
// 数据来源 CMUdict（公有领域），资产 public/dict/cmudict.gz 由 scripts/build-cmudict.mjs 生成。
// 说明：词典给的是「孤立单词」的标准读音，不处理连读 / 弱读等语流音变
// （如 to → /tə/），这类唱法差异由用户用「备注」标记手动补充。

// ARPAbet 元音 → IPA（AH / ER 依重音区分）
const VOWELS = {
  AA: 'ɑ', AE: 'æ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  EH: 'ɛ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ',
  OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
};
// ARPAbet 辅音 → IPA
const CONSONANTS = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h',
  JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p',
  R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w',
  Y: 'j', Z: 'z', ZH: 'ʒ',
};

/**
 * 把一串 ARPAbet 音素（如 "F AY1 ER0"）转成 IPA（如 "faɪɚ"，不含斜杠）。
 * 重音：主重音 1 → ˈ，次重音 2 → ˌ，置于对应元音前。
 */
export function arpabetToIPA(phones) {
  const tokens = String(phones || '').trim().split(/\s+/).filter(Boolean);
  let out = '';
  for (const tok of tokens) {
    const m = tok.match(/^([A-Z]+)([0-2])?$/);
    if (!m) continue;
    const [, base, stress] = m;
    if (base === 'AH') {
      if (stress === '1') out += 'ˈ'; else if (stress === '2') out += 'ˌ';
      out += (stress === '0' || !stress) ? 'ə' : 'ʌ';
    } else if (base === 'ER') {
      if (stress === '1') out += 'ˈ'; else if (stress === '2') out += 'ˌ';
      out += (stress === '0' || !stress) ? 'ɚ' : 'ɝ';
    } else if (VOWELS[base]) {
      if (stress === '1') out += 'ˈ';
      else if (stress === '2') out += 'ˌ';
      out += VOWELS[base];
    } else if (CONSONANTS[base]) {
      out += CONSONANTS[base];
    }
  }
  return out;
}

/** 归一化词面用于查词典：小写、弯引号转直、去掉首尾标点（保留词内撇号 / 连字符）。 */
export function normalizeWord(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

/**
 * 查一个词的 IPA。dict 为 Map<word, arpabetPhones>。
 * 命中返回 IPA 字符串；未命中返回 null（调用方决定省略或显示原词）。
 * 连字符词整体未命中时按段拆分查词，用 '-' 连接。
 */
export function lookupIPA(word, dict) {
  if (!dict || !dict.size) return null;
  const w = normalizeWord(word);
  if (!w) return null;
  const direct = dict.get(w);
  if (direct) return arpabetToIPA(direct);
  if (w.includes('-')) {
    const parts = w.split('-').map(p => lookupIPA(p, dict));
    if (parts.every(Boolean)) return parts.join('-');
  }
  return null;
}

/**
 * 由英语单词数组生成整行音标，形如 "/aɪ woʊk ʌp tə ðə faɪɚ/"。
 * words 为 [{t, p?}]（p=1 为标点 / 空白，跳过）。全部未命中返回 ''。
 * 未命中的词以原词占位，保证音标行与歌词大致对齐。
 */
export function lineIPA(words, dict) {
  if (!Array.isArray(words)) return '';
  const parts = [];
  for (const w of words) {
    if (!w || w.p) continue;
    const t = String(w.t || '').trim();
    if (!t) continue;
    parts.push(lookupIPA(t, dict) || t.toLowerCase());
  }
  if (!parts.length) return '';
  return '/' + parts.join(' ') + '/';
}

// ------------------------------------------------------------ 浏览器懒加载
let dictPromise = null;
let dictCache = null;

/** 懒加载 CMUdict（仅英语模式调用）。返回 Map<word, arpabetPhones>。 */
export function loadCMUDict() {
  if (dictCache) return Promise.resolve(dictCache);
  if (dictPromise) return dictPromise;
  dictPromise = (async () => {
    const res = await fetch('/dict/cmudict.gz');
    if (!res.ok) throw new Error('发音词典加载失败：HTTP ' + res.status);
    let text;
    if (typeof DecompressionStream === 'function') {
      const ds = new DecompressionStream('gzip');
      const stream = res.body.pipeThrough(ds);
      text = await new Response(stream).text();
    } else {
      // 极少数旧浏览器无 DecompressionStream：退回 pako（若存在）否则报错
      const buf = new Uint8Array(await res.arrayBuffer());
      if (window.pako) text = window.pako.inflate(buf, { to: 'string' });
      else throw new Error('当前浏览器不支持解压发音词典');
    }
    const map = new Map();
    for (const line of text.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      map.set(line.slice(0, tab), line.slice(tab + 1));
    }
    dictCache = map;
    return map;
  })().catch(e => { dictPromise = null; throw e; });
  return dictPromise;
}

/** 词典是否已就绪（渲染 IPA 前判断，避免空行闪烁）。 */
export function cmuDictReady() { return !!dictCache; }
export function getCMUDict() { return dictCache; }