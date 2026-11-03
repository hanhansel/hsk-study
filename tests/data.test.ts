// Checks on the generated data files (run `npm run data` first if you rebuilt them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CharLists, Word } from '../src/types.ts';
import { tonesOf } from '../src/pinyin.ts';

const words: Word[] = JSON.parse(readFileSync('public/data/words.json', 'utf8'));
const chars: CharLists = JSON.parse(readFileSync('public/data/chars.json', 'utf8'));

test('levels 1–6 are all there', () => {
  const perLevel = [1, 2, 3, 4, 5, 6].map((l) => words.filter((w) => w.level === l).length);
  assert.equal(perLevel[0], 300);
  // Official entries per level are 300/200/500/1000/1600/1800; a few same-word senses are merged.
  const official = [300, 200, 500, 1000, 1600, 1800];
  perLevel.forEach((n, i) => {
    const merged = words.filter((w) => w.level === i + 1).length;
    assert.ok(n <= official[i] && n >= official[i] - 10, `level ${i + 1}: ${merged}`);
  });
  // Counting merged entries brings every level back to the official total.
  const withMerged = words.reduce((n, w) => n + 1 + (w.extraIds?.length ?? 0), 0);
  assert.equal(withMerged, 5400);
});

test('every word has a meaning and tone numbers that fit its characters', () => {
  for (const w of words) {
    assert.ok(w.meanings.length > 0, `${w.hanzi} has no meaning`);
    assert.ok(w.numeric, `${w.hanzi} has no tone numbers`);
    const hanCount = [...w.hanzi].filter((c) => /\p{Script=Han}/u.test(c)).length;
    const erhua = w.numeric.endsWith(' r') ? 1 : 0;
    assert.equal(tonesOf(w.numeric).length, hanCount - erhua, `${w.hanzi} ${w.numeric}`);
  }
});

test('ids are unique', () => {
  const ids = words.flatMap((w) => [w.id, ...(w.extraIds ?? [])]);
  assert.equal(new Set(ids).size, ids.length);
});

test('character lists match the syllabus totals', () => {
  let read = 0, write = 0;
  const cumRead: number[] = [], cumWrite: number[] = [];
  for (let l = 1; l <= 6; l++) {
    read += chars[l].read.length; write += chars[l].write.length;
    cumRead.push(read); cumWrite.push(write);
  }
  assert.deepEqual(cumRead, [246, 371, 655, 1096, 1527, 1940]);
  assert.deepEqual(cumWrite, [0, 100, 250, 400, 550, 700]);
});
