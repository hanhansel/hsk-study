// Quiz questions generated from the word list.
// Pure functions: give them words and a random function, get a question back.
//
// Question types:
//   meaning – see 汉字, pick the English meaning
//   hanzi   – see English, pick the 汉字
//   pinyin  – see 汉字, pick the right pinyin (wrong options differ only in tones)
//   listen  – hear the word, pick the 汉字 (wrong options sound similar)
//   tones   – hear the word, see pinyin without tones, pick the right tones

import { numericToMarked, toneVariants, syllablesOf, shuffle } from './pinyin.ts';
import type { Word } from './types.ts';

export type QuizType = 'meaning' | 'hanzi' | 'pinyin' | 'listen' | 'tones';

export const QUIZ_TYPES: { type: QuizType; title: string; zh: string; about: string; needsAudio: boolean }[] = [
  { type: 'meaning', title: 'Meaning', zh: '词义', about: 'See the characters, pick the English meaning.', needsAudio: false },
  { type: 'hanzi', title: 'Characters', zh: '汉字', about: 'See the English, pick the characters.', needsAudio: false },
  { type: 'pinyin', title: 'Pinyin', zh: '拼音', about: 'See the characters, pick the right tones.', needsAudio: false },
  { type: 'listen', title: 'Listening', zh: '听力', about: 'Hear a word, pick the characters.', needsAudio: true },
  { type: 'tones', title: 'Tones', zh: '声调', about: 'Hear a word, pick its tones by ear.', needsAudio: true },
];

export type Option = { label: string; correct: boolean; wordId?: number; tonedPinyin?: string };

export type Question = {
  type: QuizType;
  word: Word;
  /** What to show above the options. `speak` is text for the speaker button. */
  prompt: { hanzi?: string; text?: string; pinyin?: string; speak?: string; hint?: string };
  options: Option[];
};

/** A short English gloss: the first meaning, cut at a sensible length. */
export function gloss(word: Word, max = 60): string {
  const first = word.meanings[0] ?? '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const semi = cut.lastIndexOf(';');
  return (semi > 20 ? cut.slice(0, semi) : cut.replace(/\s+\S*$/, '')) + '…';
}

/** Main part of speech, e.g. "动、名" -> "动". */
const mainPos = (w: Word) => w.pos.split('、')[0] ?? '';
const plainSyllables = (w: Word) => syllablesOf(w.numeric);

/**
 * Pick `n` distractor words that are plausible but clearly wrong.
 * `score` rates how tempting a candidate is (higher = more similar);
 * a little randomness keeps rounds varied.
 */
function pickDistractors(
  answer: Word,
  pool: Word[],
  n: number,
  score: (w: Word) => number,
  label: (w: Word) => string,
  random: () => number,
): Word[] {
  const answerLabel = label(answer);
  const seen = new Set([answerLabel]);
  const candidates = pool
    .filter((w) => w.id !== answer.id && w.hanzi !== answer.hanzi && w.numeric !== answer.numeric)
    .map((w) => ({ w, s: score(w) + random() * 2 }))
    .sort((a, b) => b.s - a.s);
  const picked: Word[] = [];
  for (const { w } of candidates) {
    const l = label(w);
    if (!l || seen.has(l)) continue;
    seen.add(l);
    picked.push(w);
    if (picked.length === n) break;
  }
  return picked;
}

/** Similarity used for meaning/character questions. */
function lookAlike(answer: Word) {
  const chars = new Set(answer.hanzi);
  return (w: Word) =>
    (mainPos(w) === mainPos(answer) ? 3 : 0) +
    (w.level === answer.level ? 2 : Math.abs(w.level - answer.level) === 1 ? 1 : 0) +
    ([...w.hanzi].length === [...answer.hanzi].length ? 2 : 0) +
    ([...w.hanzi].some((c) => chars.has(c)) ? 2 : 0) +
    (w.radical && w.radical === answer.radical ? 1 : 0);
}

/** Similarity used for listening questions: words that sound alike. */
function soundAlike(answer: Word) {
  const syl = new Set(plainSyllables(answer));
  const count = plainSyllables(answer).length;
  return (w: Word) => {
    const ws = plainSyllables(w);
    return (ws.some((s) => syl.has(s)) ? 4 : 0) +
      (ws.length === count ? 2 : 0) +
      (w.level <= answer.level ? 1 : 0);
  };
}

export function makeQuestion(type: QuizType, word: Word, pool: Word[], random = Math.random): Question {
  switch (type) {
    case 'meaning': {
      const wrong = pickDistractors(word, pool, 3, lookAlike(word), (w) => gloss(w), random);
      return {
        type, word,
        // Same characters can have two readings (好 hǎo / hào), so show pinyin as a hint.
        prompt: { hanzi: word.hanzi, speak: word.hanzi, hint: pool.some((w) => w.hanzi === word.hanzi && w.id !== word.id) ? word.pinyin : undefined },
        options: shuffle([
          { label: gloss(word), correct: true, wordId: word.id },
          ...wrong.map((w) => ({ label: gloss(w), correct: false, wordId: w.id })),
        ], random),
      };
    }
    case 'hanzi': {
      const wrong = pickDistractors(word, pool, 3, lookAlike(word), (w) => w.hanzi, random);
      return {
        type, word,
        prompt: { text: gloss(word, 90) },
        options: shuffle([
          { label: word.hanzi, correct: true, wordId: word.id, tonedPinyin: word.pinyin },
          ...wrong.map((w) => ({ label: w.hanzi, correct: false, wordId: w.id, tonedPinyin: w.pinyin })),
        ], random),
      };
    }
    case 'pinyin':
    case 'tones': {
      const right = numericToMarked(word.numeric);
      // Other real readings of the same characters (好 hǎo / hào) must not appear as "wrong".
      const otherReadings = pool.filter((w) => w.hanzi === word.hanzi && w.id !== word.id);
      const banned = new Set(otherReadings.map((w) => w.numeric));
      const wrong = toneVariants(word.numeric, 3 + banned.size, random).filter((v) => !banned.has(v)).slice(0, 3).map(numericToMarked);
      return {
        type, word,
        prompt: type === 'pinyin'
          ? { hanzi: word.hanzi, hint: otherReadings.length ? gloss(word) : undefined }
          : { speak: word.hanzi, pinyin: plainSyllables(word).join(' ') },
        options: shuffle([
          { label: right, correct: true },
          ...wrong.map((label) => ({ label, correct: false })),
        ], random),
      };
    }
    case 'listen': {
      const wrong = pickDistractors(word, pool, 3, soundAlike(word), (w) => w.hanzi, random);
      return {
        type, word,
        prompt: { speak: word.hanzi },
        options: shuffle([
          { label: word.hanzi, correct: true, wordId: word.id, tonedPinyin: word.pinyin },
          ...wrong.map((w) => ({ label: w.hanzi, correct: false, wordId: w.id, tonedPinyin: w.pinyin })),
        ], random),
      };
    }
  }
}

/**
 * Choose the words for one round. Words you recently got wrong are favoured
 * (up to a third of the round); the rest are random from the pool.
 */
export function pickRound(pool: Word[], size: number, recentMistakes: number[], random = Math.random): Word[] {
  const byId = new Map(pool.map((w) => [w.id, w]));
  const missed = shuffle([...new Set(recentMistakes)].filter((id) => byId.has(id)), random)
    .slice(0, Math.ceil(size / 3))
    .map((id) => byId.get(id)!);
  const rest = shuffle(pool.filter((w) => !missed.includes(w)), random).slice(0, size - missed.length);
  return shuffle([...missed, ...rest], random);
}
