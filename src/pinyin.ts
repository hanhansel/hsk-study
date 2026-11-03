// Pinyin helpers: tone marks <-> tone numbers, syllable splitting, and
// "wrong tone" variants used as quiz distractors.
//
// Terms used in this file:
//   marked  = pinyin with tone marks, e.g. "nǐhǎo"
//   numeric = syllables with tone numbers, space separated, e.g. "ni3 hao3"
//             (tone 5 = neutral tone, "r" = erhua suffix written as its own token)

const MARKS: Record<string, string> = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ',
};

/** Map every marked vowel to [plain vowel, tone number]. */
const UNMARK: Record<string, [string, number]> = {};
for (const [plain, marked] of Object.entries(MARKS)) {
  [...marked].forEach((ch, i) => { UNMARK[ch] = [plain, i + 1]; });
}

/** Remove tone marks: "nǚ'ér" -> "nü'er". Lowercases the text. */
export function stripTones(text: string): string {
  return [...text.toLowerCase().normalize('NFC')]
    .map((ch) => (UNMARK[ch] ? UNMARK[ch][0] : ch))
    .join('')
    .replace(/ń|ň|ǹ/g, 'n');
}

/** Put a tone mark on one plain syllable, e.g. ("hao", 3) -> "hǎo". */
export function markSyllable(syllable: string, tone: number): string {
  const s = syllable.replace(/v/g, 'ü');
  if (tone < 1 || tone > 4) return s; // neutral tone: no mark
  // Standard rule: a or e takes the mark; in "ou" the o does; otherwise the last vowel.
  let idx = s.search(/[ae]/);
  if (idx === -1) idx = s.indexOf('ou');
  if (idx === -1) {
    for (let i = s.length - 1; i >= 0; i--) {
      if ('iouü'.includes(s[i])) { idx = i; break; }
    }
  }
  if (idx === -1) {
    // Vowel-less interjections such as 嗯 ǹg: the mark goes on the n (or m).
    const n = { n: ['n', 'ń', 'ň', 'ǹ'], m: ['m', 'ḿ', 'm̌', 'm̀'] }[s[0] as 'n' | 'm'];
    return n ? n[tone - 1] + s.slice(1) : s;
  }
  const vowel = s[idx];
  return s.slice(0, idx) + MARKS[vowel][tone - 1] + s.slice(idx + 1);
}

/** "ni3 hao3" -> "nǐhǎo". Adds an apostrophe before a, e, o syllables (xī'ān). */
export function numericToMarked(numeric: string): string {
  const parts = numeric.trim().split(/\s+/);
  let out = '';
  parts.forEach((part, i) => {
    if (part === 'r') { out += 'r'; return; }
    const m = part.match(/^([a-zü]+)([1-5])$/);
    const syl = m ? markSyllable(m[1], Number(m[2])) : part;
    if (i > 0 && /^[aeo]/.test(m ? m[1] : part)) out += '’';
    out += syl;
  });
  return out;
}

/** Tone numbers of a numeric string: "ni3 hao3" -> [3, 3]. Erhua "r" is skipped. */
export function tonesOf(numeric: string): number[] {
  return numeric.split(/\s+/).filter((p) => p !== 'r').map((p) => Number(p.slice(-1)));
}

/** Plain syllables of a numeric string: "ni3 hao3" -> ["ni", "hao"]. */
export function syllablesOf(numeric: string): string[] {
  return numeric.split(/\s+/).filter((p) => p !== 'r').map((p) => p.slice(0, -1));
}

/**
 * Split marked pinyin into numeric syllables, using a set of valid plain syllables.
 * `expected` is the number of syllables we expect (normally the number of
 * Chinese characters, not counting an erhua 儿). Returns null if it can't split.
 *
 *   segmentPinyin("bàba", 2, set) -> "ba4 ba5"
 *   segmentPinyin("nǎr", 1, set)  -> "na3 r"
 */
export function segmentPinyin(marked: string, expected: number, valid: Set<string>): string | null {
  const text = marked.toLowerCase().normalize('NFC').replace(/[’'\-\s·]/g, ' ').trim();
  // Work character by character, remembering the tone carried by each character.
  const chars: { ch: string; tone: number }[] = [];
  for (const ch of text) {
    if (ch === ' ') { chars.push({ ch: ' ', tone: 0 }); continue; }
    const um = UNMARK[ch];
    if (um) chars.push({ ch: um[0], tone: um[1] });
    else if ('ńňǹ'.includes(ch)) chars.push({ ch: 'n', tone: 'ńňǹ'.indexOf(ch) + 2 });
    else chars.push({ ch: ch === 'v' ? 'ü' : ch, tone: 0 });
  }

  // Depth-first search for a split into exactly `expected` syllables (+ optional "r").
  const results: string[][] = [];
  const walk = (pos: number, acc: string[]) => {
    if (results.length) return;
    while (pos < chars.length && chars[pos].ch === ' ') pos++;
    const count = acc.filter((a) => a !== 'r').length;
    if (pos === chars.length) {
      if (count === expected) results.push([...acc]);
      return;
    }
    if (count > expected) return;
    for (let len = Math.min(6, chars.length - pos); len >= 1; len--) {
      const slice = chars.slice(pos, pos + len);
      if (slice.some((c) => c.ch === ' ')) continue;
      const plain = slice.map((c) => c.ch).join('');
      // erhua: a lone "r" right after a syllable that isn't itself complete with r
      if (plain === 'r' && acc.length && acc[acc.length - 1] !== 'r') {
        acc.push('r'); walk(pos + 1, acc); acc.pop();
        continue;
      }
      if (!valid.has(plain)) continue;
      const tone = slice.find((c) => c.tone > 0)?.tone ?? 5;
      acc.push(plain + tone); walk(pos + len, acc); acc.pop();
    }
  };
  walk(0, []);
  return results.length ? results[0].join(' ') : null;
}

/**
 * Wrong-tone versions of a word, for "pick the right pinyin" questions.
 * Changes one syllable's tone at a time (the most realistic mistake),
 * then two at a time if more options are needed. Never returns the original.
 */
export function toneVariants(numeric: string, howMany: number, random = Math.random): string[] {
  const parts = numeric.split(/\s+/);
  const idx = parts.map((p, i) => (p === 'r' ? -1 : i)).filter((i) => i >= 0);
  const out = new Set<string>();
  const original = parts.join(' ');
  const make = (changes: [number, number][]) => {
    const copy = [...parts];
    for (const [i, t] of changes) copy[i] = copy[i].slice(0, -1) + t;
    const s = copy.join(' ');
    if (s !== original) out.add(s);
  };
  // one syllable changed
  const singles: [number, number][] = [];
  for (const i of idx) for (let t = 1; t <= 4; t++) if (t !== Number(parts[i].slice(-1))) singles.push([i, t]);
  shuffle(singles, random).forEach((c) => make([c]));
  // neutral tone as a last resort for one-syllable words (只 zhī: zhí, zhì, zhi)
  if (out.size < howMany) for (const i of idx) make([[i, 5]]);
  // two syllables changed (only if needed)
  if (out.size < howMany && idx.length >= 2) {
    for (let k = 0; k < 40 && out.size < howMany * 3; k++) {
      const [a, b] = shuffle([...idx], random);
      make([[a, 1 + Math.floor(random() * 4)], [b, 1 + Math.floor(random() * 4)]]);
    }
  }
  return shuffle([...out], random).slice(0, howMany);
}

/** Fisher–Yates shuffle (in place, also returned for convenience). */
export function shuffle<T>(arr: T[], random = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
