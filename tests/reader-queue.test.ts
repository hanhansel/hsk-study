import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLexicon, buildCharLevels, segment, coverage } from '../src/reader.ts';
import { newWordQueue, dueCards, levelProgress, newLeftToday } from '../src/queue.ts';
import { matches } from '../src/search.ts';
import { CardState, type CardRecord, type CharLists, type Word } from '../src/types.ts';

const words: Word[] = JSON.parse(readFileSync('public/data/words.json', 'utf8'));
const chars: CharLists = JSON.parse(readFileSync('public/data/chars.json', 'utf8'));
const lexicon = buildLexicon(words);
const charLevels = buildCharLevels(chars);

test('reader keeps the text intact and finds whole words', () => {
  const text = '我觉得学习汉语很有意思，但是汉字有点儿难。Hello 2026!';
  const tokens = segment(text, lexicon, charLevels);
  assert.equal(tokens.map((t) => t.text).join(''), text);
  const found = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
  for (const w of ['觉得', '学习', '汉语', '有意思', '但是', '汉字', '有点儿', '难']) assert.ok(found.includes(w), w);
});

test('reader tags 好 as HSK 1 (hǎo), not the HSK 5 reading', () => {
  const t = segment('好', lexicon, charLevels)[0];
  assert.equal(t.kind, 'word');
  if (t.kind === 'word') assert.equal(t.word.level, 1);
});

test('coverage of an easy sentence at HSK 1 is high', () => {
  const tokens = segment('我是中国人。你好吗？', lexicon, charLevels);
  const c = coverage(tokens, 1, charLevels);
  assert.equal(c.charsKnownLevel, c.hanTotal);
});

const card = (wordId: number, state: number, due: Date): CardRecord => ({
  wordId, addedAt: new Date(0),
  card: { due, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: state === CardState.Review ? 30 : 0, learning_steps: 0, reps: 1, lapses: 0, state },
});

test('new words come from lower levels first, then by frequency', () => {
  const q = newWordQueue(words, new Map(), 3);
  assert.equal(q[0].level, 1);
  assert.equal(q.length, words.filter((w) => w.level <= 3).length);
  const l1 = q.filter((w) => w.level === 1);
  for (let i = 1; i < l1.length; i++) assert.ok((l1[i - 1].freq ?? Infinity) <= (l1[i].freq ?? Infinity));
});

test('started words leave the new-word queue; due cards are found', () => {
  const now = new Date('2026-11-03T10:00:00');
  const cards = new Map<number, CardRecord>([
    [words[0].id, card(words[0].id, CardState.Review, new Date('2026-11-02'))],
    [words[1].id, card(words[1].id, CardState.Review, new Date('2026-11-09'))],
    [words[2].id, card(words[2].id, CardState.New, new Date('2026-11-01'))],
  ]);
  assert.ok(!newWordQueue(words, cards, 1).some((w) => cards.has(w.id)));
  assert.deepEqual(dueCards(cards, now).map((c) => c.wordId), [words[0].id]); // new cards aren't "due"
  const p = levelProgress(words, cards, (c) => c.card.scheduled_days >= 21);
  assert.equal(p[0].started, 2);
  assert.equal(p[0].mature, 2);
  assert.equal(newLeftToday(10, 12), 0);
});

test('search by hanzi, pinyin and English', () => {
  const aihao = words.find((w) => w.hanzi === '爱好')!;
  for (const q of ['爱好', 'aihao', 'ài hào', 'ai4hao4', 'hobby']) assert.ok(matches(aihao, q), q);
  assert.ok(!matches(aihao, 'zzz'));
});
