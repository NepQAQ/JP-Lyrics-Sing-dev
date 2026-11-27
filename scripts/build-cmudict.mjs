// 构建英语发音词典资产：CMUdict → public/dict/cmudict.gz
//
// CMUdict（CMU Pronouncing Dictionary）为公有领域（public domain）数据，
// 版权与许可见 https://github.com/cmusphinx/cmudict —— 本仓库仅做格式压缩，未改动读音内容。
//
// 用法：node scripts/build-cmudict.mjs [本地 cmudict.dict 路径]
//   不带参数时从官方仓库下载；带参数时读取本地文件（离线复现）。
//
// 输出格式（gzip 压缩的纯文本，每行一词）：
//   word\tARPABET_PHONES
//   - 词面统一小写；仅保留字母 / 撇号（缩写如 don't）/ 连字符构成的词。
//   - 多读音词取第一条（CMUdict 以 (1)/(2) 标注变体，主词条无后缀）。
//   - 保留重音数字（0/1/2），运行时映射为 IPA 的 ˈ/ˌ。
// 运行时由 public/js/ipa.js 懒加载（仅英语模式），fetch + DecompressionStream('gzip')。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict';
const OUT = join(ROOT, 'public', 'dict', 'cmudict.gz');

async function loadSource() {
  const local = process.argv[2];
  if (local) return readFileSync(local, 'utf8');
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`下载 CMUdict 失败：HTTP ${res.status}`);
  return res.text();
}

// 仅保留「字母 + 撇号 + 连字符」的词面，过滤数字 / 括号变体 / 非 ASCII 符号
const WORD_RE = /^[A-Za-z][A-Za-z'.-]*$/;

function build(text) {
  const seen = new Set();
  const rows = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(';;;')) continue;
    const sp = line.indexOf(' ');
    if (sp < 0) continue;
    let word = line.slice(0, sp);
    const phones = line.slice(sp + 1).trim();
    if (!phones) continue;
    // 变体词条形如 WORD(1)：跳过，主词条已先出现
    if (word.includes('(')) continue;
    if (!WORD_RE.test(word)) continue;
    word = word.toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    rows.push(`${word}\t${phones}`);
  }
  rows.sort();
  return rows.join('\n') + '\n';
}

const src = await loadSource();
const compact = build(src);
mkdirSync(dirname(OUT), { recursive: true });
const gz = gzipSync(Buffer.from(compact, 'utf8'), { level: 9 });
writeFileSync(OUT, gz);
const words = compact.split('\n').length - 1;
console.log(`CMUdict: ${words} 词，原始 ${(compact.length / 1048576).toFixed(2)} MB → gzip ${(gz.length / 1048576).toFixed(2)} MB`);
console.log(`已写入 ${OUT}`);