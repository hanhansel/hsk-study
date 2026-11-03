import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markSyllable, numericToMarked, segmentPinyin, stripTones, toneVariants, tonesOf } from '../src/pinyin.ts';

test('tone marks go on the right vowel', () => {
  assert.equal(markSyllable('hao', 3), 'hǎo');
  assert.equal(markSyllable('xiu', 1), 'xiū'); // iu -> mark on u
  assert.equal(markSyllable('gui', 4), 'guì'); // ui -> mark on i
  assert.equal(markSyllable('lü', 4), 'lǜ');
  assert.equal(markSyllable('lv', 4), 'lǜ');
  assert.equal(markSyllable('zhou', 1), 'zhōu');
  assert.equal(markSyllable('er', 2), 'ér');
  assert.equal(markSyllable('ma', 5), 'ma');
  assert.equal(markSyllable('ng', 4), 'ǹg');
});

test('numeric to marked pinyin', () => {
  assert.equal(numericToMarked('ni3 hao3'), 'nǐhǎo');
  assert.equal(numericToMarked('xi1 an1'), 'xī’ān');
  assert.equal(numericToMarked('na3 r'), 'nǎr');
  assert.equal(numericToMarked('ba4 ba5'), 'bàba');
});

test('strip tones', () => {
  assert.equal(stripTones('Nǚ’ér'), 'nü’er');
});

test('split marked pinyin into syllables', () => {
  const valid = new Set(['ba', 'ni', 'hao', 'na', 'yi', 'hui', 'nü', 'er', 'xi', 'an', 'xian', 'hong', 'lü', 'deng', 'zhe']);
  assert.equal(segmentPinyin('bàba', 2, valid), 'ba4 ba5');
  assert.equal(segmentPinyin('nǐ hǎo', 2, valid), 'ni3 hao3');
  assert.equal(segmentPinyin('nǎr', 1, valid), 'na3 r');
  assert.equal(segmentPinyin('yíhuìr', 2, valid), 'yi2 hui4 r');
  assert.equal(segmentPinyin('nǚ’ér', 2, valid), 'nü3 er2');
  assert.equal(segmentPinyin('xī’ān', 2, valid), 'xi1 an1');
  assert.equal(segmentPinyin('xiān', 1, valid), 'xian1');
  assert.equal(segmentPinyin('hóng-lǜdēng', 3, valid), 'hong2 lü4 deng1');
  assert.equal(segmentPinyin('zzz', 1, valid), null);
});

test('tone variants are different from the answer and from each other', () => {
  for (const word of ['hao3', 'ni3 hao3', 'yi2 hui4 r', 'ba4 ba5']) {
    const v = toneVariants(word, 3);
    assert.equal(v.length, 3, word);
    assert.equal(new Set(v).size, 3);
    assert.ok(!v.includes(word));
    for (const x of v) assert.equal(tonesOf(x).length, tonesOf(word).length); // same syllables, only tones differ
  }
});
