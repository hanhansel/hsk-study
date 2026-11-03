// Writing quiz (experimental): pick characters to write and a word that uses each one.
// Like HSK writing part 1: you see a word with one character missing, plus its pinyin,
// and write the missing character. Pure functions, so they can be tested.

import { markSyllable, shuffle } from './pinyin.ts';
import type { CharLists, Word } from './types.ts';

export type WritingPrompt = {
  char: string;      // the character to write
  pinyin: string;    // its pinyin in this word, e.g. "ài"
  word: Word;        // the word it comes from, e.g. 爱好
  index: number;     // position of the character in the word
};

/**
 * Characters you must be able to write, up to `level`.
 * HSK 1 and 2 share one official list of 100 characters, so level 1 uses it too.
 */
export function writableChars(chars: CharLists, level: number): string[] {
  const out: string[] = [];
  for (let l = 1; l <= Math.max(level, 2); l++) out.push(...(chars[l]?.write ?? []));
  return out;
}

/** Find an easy, common word that contains `char`, and the char's pinyin in it. */
export function promptFor(char: string, words: Word[]): WritingPrompt | null {
  const candidates = words
    .filter((w) => w.hanzi.includes(char) && w.numeric)
    .sort((a, b) => a.level - b.level || [...a.hanzi].length - [...b.hanzi].length || (a.freq ?? Infinity) - (b.freq ?? Infinity));
  for (const word of candidates) {
    const index = [...word.hanzi].indexOf(char);
    const syllables = word.numeric.split(' ').filter((p) => p !== 'r');
    const part = syllables[index];
    if (!part) continue;
    return { char, word, index, pinyin: markSyllable(part.slice(0, -1), Number(part.slice(-1))) };
  }
  return null;
}

/** A round of writing prompts, random order. */
export function writingRound(chars: CharLists, words: Word[], level: number, size: number, random = Math.random): WritingPrompt[] {
  const out: WritingPrompt[] = [];
  for (const ch of shuffle(writableChars(chars, level), random)) {
    const p = promptFor(ch, words);
    if (p) out.push(p);
    if (out.length === size) break;
  }
  return out;
}
