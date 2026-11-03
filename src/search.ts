// Word search: by characters, pinyin (with or without tones, spaces or tone numbers), or English.

import { stripTones } from './pinyin.ts';
import type { Word } from './types.ts';

/** Does a word match the search text? Pinyin may be typed with or without tones/spaces. */
export function matches(w: Word, q: string): boolean {
  if (!q) return true;
  if (/\p{Script=Han}/u.test(q)) return w.hanzi.includes(q);
  const plain = q.toLowerCase().replace(/[\s']/g, '');
  const py = stripTones(w.pinyin).replace(/[\s’'-]/g, '');
  const pyNum = w.numeric.replace(/\s/g, '');
  if (py.startsWith(stripTones(plain)) || pyNum.startsWith(plain)) return true;
  const re = new RegExp(`\\b${q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  return w.meanings.some((m) => re.test(m.toLowerCase()));
}
