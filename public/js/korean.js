// 韩语歌词：谚文分解 + 韩国语罗马字表记法（Revised Romanization，국립국어원）+ 分词 / 标记存取。
//
// 设计与 english.js 一致：日语数据原样保留，韩语模式由 line.text 确定性分词，
// 标记单独持久化在 line.koMarks（按词序号），与英语 enMarks 互不干扰。
// 罗马字为纯算法（无需词典资产）；含音节间标准字母变化规则（종로→jongno、합니→hamni）。
// 演唱中的实际音变细节由用户用「备注」手动标注。
import { state } from './state.js';

export function isKorean() {
  return state.settings.songLang === 'ko';
}

// 初声（19）/ 中声（21）/ 终声（28，含空）——按 Unicode 谚文音节组合顺序
const LEAD_ROM = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const LEAD_JAMO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWEL_ROM = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const TAIL_JAMO = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// 终声单独出现（词末 / 后接辅音且无同化规则）时的表记
const TAIL_ROM = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
// 复合终声在后接元音（初声 ㅇ）时的拆分：前字母留作终声、后字母连音作初声
const TAIL_SPLIT = { 'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'] };

const K_GROUP = new Set(['ㄱ', 'ㄲ', 'ㅋ', 'ㄳ', 'ㄺ']);
const T_GROUP = new Set(['ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ']);
const P_GROUP = new Set(['ㅂ', 'ㅄ', 'ㄼ', 'ㄿ']);
const N_GROUP = new Set(['ㄴ', 'ㄵ', 'ㄶ']);
const M_GROUP = new Set(['ㅁ', 'ㄻ']);

/** 终声 + 后接辅音初声 → [终声表记, 初声表记]（RR 标准字母变化） */
function assimilate(t, n, nextLeadRom) {
  if (t === 'ㅎ') {
    if (n === 'ㄱ') return ['', 'k'];
    if (n === 'ㄷ') return ['', 't'];
    if (n === 'ㅂ') return ['', 'p'];
    if (n === 'ㅈ') return ['', 'ch'];
    if (n === 'ㄴ' || n === 'ㄹ') return ['n', 'n'];
    if (n === 'ㅁ') return ['m', 'm'];
    return ['', nextLeadRom];
  }
  if (K_GROUP.has(t)) {
    if (n === 'ㄴ' || n === 'ㄹ') return ['ng', 'n'];
    if (n === 'ㅁ') return ['ng', 'm'];
  }
  if (P_GROUP.has(t)) {
    if (n === 'ㄴ' || n === 'ㄹ') return ['m', 'n'];
    if (n === 'ㅁ') return ['m', 'm'];
  }
  if (T_GROUP.has(t)) {
    if (n === 'ㄴ' || n === 'ㄹ') return ['n', 'n'];
    if (n === 'ㅁ') return ['n', 'm'];
    if (n === 'ㅎ' && (t === 'ㄷ' || t === 'ㅌ' || t === 'ㅈ')) return ['', 'ch'];
  }
  if (N_GROUP.has(t) && n === 'ㄹ') return ['l', 'l'];
  if (M_GROUP.has(t) && n === 'ㄹ') return ['m', 'n'];
  if (t === 'ㅇ' && n === 'ㄹ') return ['ng', 'n']; // 종로 → jongno
  if (t === 'ㄹ' && n === 'ㄴ') return ['l', 'l'];
  return [TAIL_ROM[TAIL_JAMO.indexOf(t)], nextLeadRom];
}

/** 一段连续谚文音节 → 罗马字（含音节间连音 / 同化规则）。 */
function romanizeSyllables(syls) {
  let out = '';
  let pendingLead = null; // 上一音节决定的本音节初声表记
  for (let i = 0; i < syls.length; i++) {
    const { l, v, t } = syls[i];
    out += (pendingLead !== null ? pendingLead : LEAD_ROM[l]) + VOWEL_ROM[v];
    pendingLead = null;
    const tj = TAIL_JAMO[t];
    if (!tj) continue;
    const next = syls[i + 1];
    if (!next) { out += TAIL_ROM[t]; continue; }
    const nj = LEAD_JAMO[next.l];
    if (nj === 'ㅇ') {
      // 后接元音：终声连音到下一音节初声
      if (tj === 'ㅇ') out += 'ng';
      else if (tj === 'ㅎ') { /* ㅎ 脱落：좋아 → joa */ }
      else if (TAIL_SPLIT[tj]) {
        const [a, b] = TAIL_SPLIT[tj];
        if (b === 'ㅎ') pendingLead = LEAD_ROM[LEAD_JAMO.indexOf(a)]; // 많아 → mana、싫어 → sireo
        else { out += TAIL_ROM[TAIL_JAMO.indexOf(a)]; pendingLead = LEAD_ROM[LEAD_JAMO.indexOf(b)]; }
      } else {
        pendingLead = LEAD_ROM[LEAD_JAMO.indexOf(tj)];
        // 腭化：ㄷ/ㅌ + 이 → ji / chi（굳이 → guji、같이 → gachi）
        if (tj === 'ㄷ' && next.v === 20) pendingLead = 'j';
        if (tj === 'ㅌ' && next.v === 20) pendingLead = 'ch';
      }
    } else {
      const [tr, lr] = assimilate(tj, nj, LEAD_ROM[next.l]);
      out += tr;
      pendingLead = lr;
    }
  }
  return out;
}

const SYL_RE = /[\uAC00-\uD7A3]/;

/** 把一个词转写为罗马字：谚文音节按规则转写，其余字符原样保留。 */
export function romanizeWord(word) {
  const s = String(word ?? '');
  let out = '';
  let run = [];
  const flush = () => { if (run.length) { out += romanizeSyllables(run); run = []; } };
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off = code - 0xAC00;
      run.push({ l: Math.floor(off / 588), v: Math.floor((off % 588) / 28), t: off % 28 });
    } else {
      flush();
      out += ch;
    }
  }
  flush();
  return out;
}

// 词 = 谚文（音节 / 字母）串或拉丁字母数字串；其余（空白、标点）为 p:1 占位词。
// 保证 words.map(w => w.t).join('') === text。
const TOKEN_RE = /[\uAC00-\uD7A3\u3130-\u318F\u1100-\u11FF]+|[A-Za-z0-9'’-]+|\s+|[^\s\uAC00-\uD7A3\u3130-\u318F\u1100-\u11FFA-Za-z0-9'’-]+/g;
const WORD_RE = /^[\uAC00-\uD7A3\u3130-\u318F\u1100-\u11FFA-Za-z0-9'’-]+$/;

/** 把一行韩语原文确定性分词，返回 [{t, p?}]。 */
export function segmentKorean(text) {
  const s = String(text ?? '');
  const words = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    const t = m[0];
    if (WORD_RE.test(t)) words.push({ t });
    else words.push({ t, p: 1 });
  }
  return words;
}

/** 韩语模式下的单词数组（含标记）。由 text 分词 + koMarks 还原，带签名缓存。 */
export function koreanWords(line) {
  const marks = line.koMarks || {};
  const sig = line.text + '|' + JSON.stringify(marks);
  if (line._koWords && line._koSig === sig) return line._koWords;
  const words = segmentKorean(line.text);
  for (const [i, m] of Object.entries(marks)) {
    const idx = Number(i);
    if (words[idx] && !words[idx].p && m && Object.keys(m).length) {
      words[idx].m = { ...m };
    }
  }
  line._koWords = words;
  line._koSig = sig;
  return words;
}

/** 整行罗马字（跳过标点 / 空白；拉丁词原样）。 */
export function lineRomanization(words) {
  if (!Array.isArray(words)) return '';
  const parts = words.filter(w => w && !w.p && w.t).map(w => romanizeWord(w.t));
  return parts.join(' ');
}