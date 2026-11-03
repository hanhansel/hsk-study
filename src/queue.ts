// Which cards to study today, and progress numbers per level.
// Pure functions (no database, no browser APIs) so they are easy to test.

import { CardState, type CardRecord, type Word } from './types.ts';

/** Midnight at the start of today (local time). */
export function startOfDay(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Words not started yet, in the order they should be introduced:
 * lower level first, then more frequent words first, then syllabus order.
 * Includes every level up to `studyLevel`, so picking HSK 3 still finishes HSK 1–2 first.
 */
export function newWordQueue(words: Word[], cards: Map<number, CardRecord>, studyLevel: number): Word[] {
  return words
    .filter((w) => w.level <= studyLevel && !cards.has(w.id))
    .sort((a, b) =>
      a.level - b.level ||
      (a.freq ?? Infinity) - (b.freq ?? Infinity) ||
      a.id - b.id);
}

/** Started cards that are due now (or earlier), oldest first. */
export function dueCards(cards: Map<number, CardRecord>, now = new Date()): CardRecord[] {
  return [...cards.values()]
    .filter((c) => c.card.state !== CardState.New && c.card.due.getTime() <= now.getTime())
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime());
}

/** Cards added by hand (from the word list or reader) that haven't been studied yet. */
export function addedNotStudied(cards: Map<number, CardRecord>): CardRecord[] {
  return [...cards.values()]
    .filter((c) => c.card.state === CardState.New)
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
}

/** How many new words are still allowed today. */
export function newLeftToday(newPerDay: number, introducedToday: number): number {
  return Math.max(0, newPerDay - introducedToday);
}

export type LevelProgress = { level: number; total: number; started: number; mature: number };

/** Progress for each level 1–6: total cards, started cards, and well-known cards. */
export function levelProgress(
  words: Word[],
  cards: Map<number, CardRecord>,
  isMature: (c: CardRecord) => boolean,
): LevelProgress[] {
  const out: LevelProgress[] = [];
  for (let level = 1; level <= 6; level++) {
    const inLevel = words.filter((w) => w.level === level);
    let started = 0, mature = 0;
    for (const w of inLevel) {
      const c = cards.get(w.id);
      if (!c || c.card.state === CardState.New) continue;
      started++;
      if (isMature(c)) mature++;
    }
    out.push({ level, total: inLevel.length, started, mature });
  }
  return out;
}
