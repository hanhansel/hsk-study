import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writableChars, promptFor, writingRound } from '../src/writing.ts';
import type { CharLists, Word } from '../src/types.ts';

const words: Word[] = JSON.parse(readFileSync('public/data/words.json', 'utf8'));
const chars: CharLists = JSON.parse(readFileSync('public/data/chars.json', 'utf8'));
const strokes: Record<string, unknown> = JSON.parse(readFileSync('public/data/strokes.json', 'utf8'));

test('levels 1 and 2 share the 100-character list; HSK 3 adds 150', () => {
  assert.equal(writableChars(chars, 1).length, 100);
  assert.equal(writableChars(chars, 2).length, 100);
  assert.equal(writableChars(chars, 3).length, 250);
});

test('every character to write has stroke data and an example word', () => {
  for (const ch of writableChars(chars, 6)) {
    assert.ok(strokes[ch], `no strokes for ${ch}`);
    assert.ok(promptFor(ch, words), `no example word for ${ch}`);
  }
});

test('the pinyin given is the reading of that character in the word', () => {
  const p = promptFor('好', words)!;
  assert.equal(p.word.hanzi[p.index], '好');
  assert.equal(p.pinyin, 'hǎo');
});

test('a round has the requested size and no repeats', () => {
  const round = writingRound(chars, words, 3, 8);
  assert.equal(round.length, 8);
  assert.equal(new Set(round.map((p) => p.char)).size, 8);
});
