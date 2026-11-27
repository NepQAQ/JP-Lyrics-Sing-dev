// 英语音标：ARPAbet → IPA 转换 + CMUdict 查词（纯函数）单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arpabetToIPA, normalizeWord, lookupIPA, lineIPA } from '../public/js/ipa.js';

test('arpabetToIPA 元音 + 重音', () => {
  assert.equal(arpabetToIPA('F AY1 ER0'), 'fˈaɪɚ');   // fire
  assert.equal(arpabetToIPA('W OW1 K'), 'wˈoʊk');      // woke
  assert.equal(arpabetToIPA('DH AH0'), 'ðə');          // the（弱读 AH0 → ə）
  assert.equal(arpabetToIPA('K AH1 P'), 'kˈʌp');       // cup（重读 AH1 → ˈʌ）
  assert.equal(arpabetToIPA('B ER1 D'), 'bˈɝd');       // bird（重读 ER1 → ˈɝ）
  assert.equal(arpabetToIPA('T UW1'), 'tˈu');          // to（词典读音，不自动弱读）
});

test('arpabetToIPA 次重音与辅音映射', () => {
  assert.equal(arpabetToIPA('AE2'), 'ˌæ');             // 次重音 2 → ˌ
  assert.equal(arpabetToIPA('R IY1 D'), 'ɹˈid');       // R → ɹ, IY → i
  assert.equal(arpabetToIPA('G OW1'), 'ɡˈoʊ');         // G → ɡ（非 g）
  assert.equal(arpabetToIPA('TH IH1 NG'), 'θˈɪŋ');     // TH → θ, NG → ŋ
  assert.equal(arpabetToIPA('SH IY1'), 'ʃˈi');         // SH → ʃ
  assert.equal(arpabetToIPA('CH EY1 S'), 'tʃˈeɪs');    // CH → tʃ, EY → eɪ
  assert.equal(arpabetToIPA('JH AH1 JH'), 'dʒˈʌdʒ');   // JH → dʒ
});

test('arpabetToIPA 空串 / 非法音素', () => {
  assert.equal(arpabetToIPA(''), '');
  assert.equal(arpabetToIPA(null), '');
  assert.equal(arpabetToIPA('???'), '');
});

test('normalizeWord 大小写 / 弯引号 / 首尾标点', () => {
  assert.equal(normalizeWord("Don't"), "don't");
  assert.equal(normalizeWord('Don’t'), "don't");        // 弯引号 → 直
  assert.equal(normalizeWord('"Hello,"'), 'hello');
  assert.equal(normalizeWord('Fire!'), 'fire');
  assert.equal(normalizeWord('well-known'), 'well-known'); // 词内连字符保留
});

test('lookupIPA 命中 / 未命中 / 连字符拆分', () => {
  const dict = new Map([
    ['fire', 'F AY1 ER0'],
    ['the', 'DH AH0'],
    ['well', 'W EH1 L'],
    ['known', 'N OW1 N'],
  ]);
  assert.equal(lookupIPA('Fire', dict), 'fˈaɪɚ');
  assert.equal(lookupIPA('THE', dict), 'ðə');
  assert.equal(lookupIPA('zzz', dict), null);
  assert.equal(lookupIPA('well-known', dict), 'wˈɛl-nˈoʊn');
  assert.equal(lookupIPA('fire', null), null);
  assert.equal(lookupIPA('fire', new Map()), null);
});

test('lineIPA 整行音标 / 跳过标点 / 未命中回退原词', () => {
  const dict = new Map([['i', 'AY1'], ['woke', 'W OW1 K']]);
  const words = [{ t: 'I' }, { t: ' ', p: 1 }, { t: 'woke' }, { t: ',', p: 1 }, { t: 'zzz' }];
  assert.equal(lineIPA(words, dict), '/ˈaɪ wˈoʊk zzz/');
  assert.equal(lineIPA([], dict), '');
  assert.equal(lineIPA([{ t: ' ', p: 1 }], dict), '');
  assert.equal(lineIPA(null, dict), '');
});