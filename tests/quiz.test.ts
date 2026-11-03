import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeQuestion, pickRound, gloss, type QuizType } from '../src/quiz.ts';
import { stripTones } from '../src/pinyin.ts';
import type { Word } from '../src/types.ts';

const words: Word[] = JSON.parse(readFileSync('public/data/words.json', 'utf8'));
const pool = words.filter((w) => w.level <= 3);

/** Repeatable random numbers so failures can be reproduced. */
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

const TYPES: QuizType[] = ['meaning', 'hanzi', 'pinyin', 'listen', 'tones'];

test('every question has 4 different options and exactly one right answer', () => {
  const random = seeded(42);
  for (const type of TYPES) {
    for (const word of pool.slice(0, 400)) {
      const q = makeQuestion(type, word, pool, random);
      assert.equal(q.options.length, 4, `${type} ${word.hanzi}`);
      assert.equal(q.options.filter((o) => o.correct).length, 1);
      assert.equal(new Set(q.options.map((o) => o.label)).size, 4, `${type} ${word.hanzi}: ${q.options.map((o) => o.label)}`);
    }
  }
});

test('pinyin options differ only in tones', () => {
  const random = seeded(7);
  for (const word of pool.slice(0, 300)) {
    const q = makeQuestion('pinyin', word, pool, random);
    const plain = new Set(q.options.map((o) => stripTones(o.label)));
    assert.equal(plain.size, 1, `${word.hanzi}: ${q.options.map((o) => o.label)}`);
  }
});

test('the other reading of the same characters is never a wrong option (好 hǎo / hào)', () => {
  const hao3 = words.find((w) => w.hanzi === '好' && w.pinyin === 'hǎo')!;
  for (let i = 0; i < 30; i++) {
    const q = makeQuestion('pinyin', hao3, words, seeded(i));
    assert.ok(!q.options.some((o) => !o.correct && o.label === 'hào'));
  }
});

test('listening options never include a word that sounds identical', () => {
  const random = seeded(3);
  for (const word of pool.slice(0, 300)) {
    const q = makeQuestion('listen', word, pool, random);
    const ids = q.options.filter((o) => !o.correct).map((o) => o.wordId);
    for (const id of ids) {
      const other = words.find((w) => w.id === id)!;
      assert.notEqual(other.numeric, word.numeric, `${word.hanzi} vs ${other.hanzi}`);
    }
  }
});

test('gloss is short', () => {
  for (const w of words) assert.ok(gloss(w).length <= 61, w.hanzi);
});

test('a round favours recent mistakes but is not only mistakes', () => {
  const mistakes = pool.slice(0, 20).map((w) => w.id);
  const round = pickRound(pool, 10, mistakes, seeded(1));
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((w) => w.id)).size, 10);
  const fromMistakes = round.filter((w) => mistakes.includes(w.id)).length;
  assert.ok(fromMistakes >= 1 && fromMistakes <= 4, String(fromMistakes));
});
