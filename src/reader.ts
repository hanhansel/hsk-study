// The reader: split pasted Chinese text into words and tag each with its HSK level.
//
// Method (from the research notes): longest-match against our own HSK word list,
// because general-purpose segmenters produce chunks like 我的 or 七点 that are not
// in any graded list. Leftover Chinese is grouped with the browser's built-in
// word segmenter (Intl.Segmenter) when available, otherwise kept as single characters.

import type { CharLists, Word } from './types.ts';

export type Token =
  | { kind: 'word'; text: string; word: Word }        // found in the HSK 1–6 list
  | { kind: 'unknown'; text: string; charLevel: number | null } // Chinese, but not an HSK 1–6 word
  | { kind: 'other'; text: string };                   // punctuation, spaces, Latin, digits

const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);

/** Lookup table: hanzi -> words (one hanzi can have several readings). */
export function buildLexicon(words: Word[]): Map<string, Word[]> {
  const lex = new Map<string, Word[]>();
  for (const w of words) {
    const list = lex.get(w.hanzi) ?? [];
    list.push(w);
    lex.set(w.hanzi, list);
  }
  // Lowest level first, so 好 is tagged as HSK 1 hǎo rather than HSK 5 hào.
  for (const list of lex.values()) list.sort((a, b) => a.level - b.level);
  return lex;
}

/** Level at which each character must be recognised, from the official character lists. */
export function buildCharLevels(chars: CharLists): Map<string, number> {
  const map = new Map<string, number>();
  for (const [level, lists] of Object.entries(chars)) {
    for (const ch of lists.read) if (!map.has(ch)) map.set(ch, Number(level));
  }
  return map;
}

export function segment(
  text: string,
  lexicon: Map<string, Word[]>,
  charLevels: Map<string, number>,
  maxLen = 6,
): Token[] {
  const chars = [...text];
  const tokens: Token[] = [];
  let unknownRun = '';

  const flushUnknown = () => {
    if (!unknownRun) return;
    for (const piece of splitUnknown(unknownRun)) {
      const levels = [...piece].map((c) => charLevels.get(c) ?? null);
      const charLevel = levels.includes(null) ? null : Math.max(...(levels as number[]));
      tokens.push({ kind: 'unknown', text: piece, charLevel });
    }
    unknownRun = '';
  };

  let i = 0;
  while (i < chars.length) {
    if (!isHan(chars[i])) {
      flushUnknown();
      // group non-Chinese characters together
      let j = i;
      while (j < chars.length && !isHan(chars[j])) j++;
      tokens.push({ kind: 'other', text: chars.slice(i, j).join('') });
      i = j;
      continue;
    }
    // longest dictionary match starting at i
    let matched: Word | null = null, len = 0;
    for (let l = Math.min(maxLen, chars.length - i); l >= 1; l--) {
      const candidate = chars.slice(i, i + l).join('');
      const hit = lexicon.get(candidate);
      if (hit) { matched = hit[0]; len = l; break; }
    }
    if (matched) {
      flushUnknown();
      tokens.push({ kind: 'word', text: matched.hanzi, word: matched });
      i += len;
    } else {
      unknownRun += chars[i];
      i++;
    }
  }
  flushUnknown();
  return tokens;
}

/** Split a run of non-HSK Chinese into words with the browser's segmenter, if it has one. */
function splitUnknown(run: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Seg) return [...run];
  return [...new Seg('zh', { granularity: 'word' }).segment(run)].map((s) => s.segment);
}

export type Coverage = {
  hanTotal: number;          // Chinese characters in the text
  charsKnownLevel: number;   // of those, characters in the official lists at or below the level
  wordTokens: number;        // Chinese word tokens
  wordsInLevel: number;      // of those, HSK words at or below the level
};

/** How much of the text sits within a level. 95%+ of characters is comfortable reading. */
export function coverage(tokens: Token[], level: number, charLevels: Map<string, number>): Coverage {
  let hanTotal = 0, charsKnownLevel = 0, wordTokens = 0, wordsInLevel = 0;
  for (const t of tokens) {
    if (t.kind === 'other') continue;
    wordTokens++;
    if (t.kind === 'word' && t.word.level <= level) wordsInLevel++;
    for (const ch of t.text) {
      hanTotal++;
      const l = charLevels.get(ch);
      if (l !== undefined && l <= level) charsKnownLevel++;
    }
  }
  return { hanTotal, charsKnownLevel, wordTokens, wordsInLevel };
}
