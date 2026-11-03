// Spaced repetition with FSRS (the algorithm Anki uses), via the ts-fsrs library.
// This is the only file that talks to ts-fsrs, so the rest of the app stays simple.

import { fsrs, generatorParameters, createEmptyCard, Rating, type Card, type Grade } from 'ts-fsrs';
import { CardState, type FsrsCard } from './types.ts';

/**
 * Scheduler settings:
 * - 90% target recall: you should remember about 9 in 10 cards when they come back.
 * - Intervals capped at one year, which suits a beginner.
 * - Short learning steps (1 and 10 minutes) so new words repeat in the same session.
 */
const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }),
);

/** The four answer buttons. */
export const Grades = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type GradeValue = (typeof Grades)[keyof typeof Grades];

export function newCard(now = new Date()): FsrsCard {
  return createEmptyCard(now) as FsrsCard;
}

/** Apply an answer to a card. Returns the updated card and a log entry. */
export function rate(card: FsrsCard, grade: GradeValue, now = new Date()) {
  const result = scheduler.next(card as Card, now, grade as unknown as Grade);
  return { card: result.card as FsrsCard, log: result.log };
}

/** Text shown under each answer button, e.g. { 1: "1m", 2: "6m", 3: "10m", 4: "3d" }. */
export function previewIntervals(card: FsrsCard, now = new Date()): Record<GradeValue, string> {
  const preview = scheduler.repeat(card as Card, now);
  const out = {} as Record<GradeValue, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    out[g as unknown as GradeValue] = formatInterval(preview[g].card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** A card counts as "well known" once it waits 3+ weeks between reviews. */
export function isMature(card: FsrsCard): boolean {
  return card.state === CardState.Review && card.scheduled_days >= 21;
}
