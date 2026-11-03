// App state: the word list (read-only) plus the learner's progress (IndexedDB).
// Views read from `app` and call the functions below to change things.

import * as db from './db.ts';
import { newCard, rate, isMature, Grades, type GradeValue } from './srs.ts';
import { startOfDay } from './queue.ts';
import { buildLexicon, buildCharLevels } from './reader.ts';
import {
  CardState, DEFAULT_SETTINGS,
  type CardRecord, type CharLists, type QuizRecord, type ReviewRecord, type Settings, type Word,
} from './types.ts';

export const app = {
  words: [] as Word[],
  byId: new Map<number, Word>(),
  lexicon: new Map<string, Word[]>(),
  charLevels: new Map<string, number>(),
  chars: {} as CharLists,
  cards: new Map<number, CardRecord>(),
  settings: { ...DEFAULT_SETTINGS } as Settings,
  introducedToday: 0,
  reviewedToday: 0,
};

/** Load data files and saved progress. Called once at start-up. */
export async function loadApp(): Promise<void> {
  const [words, chars] = await Promise.all([
    fetch('data/words.json').then((r) => r.json() as Promise<Word[]>),
    fetch('data/chars.json').then((r) => r.json() as Promise<CharLists>),
  ]);
  app.words = words;
  app.byId = new Map(words.map((w) => [w.id, w]));
  app.lexicon = buildLexicon(words);
  app.chars = chars;
  app.charLevels = buildCharLevels(chars);

  const cards = await db.getAll<CardRecord>('cards');
  app.cards = new Map(cards.map((c) => [c.wordId, c]));
  app.settings = { ...DEFAULT_SETTINGS, ...((await db.getMeta<Settings>('settings')) ?? {}) };
  await refreshTodayCounts();
}

export async function refreshTodayCounts(): Promise<void> {
  const today = await db.getSince<ReviewRecord>('reviews', startOfDay());
  app.reviewedToday = today.filter((r) => r.source === 'review').length;
  // A word counts as "introduced" the first time it is answered on a flashcard.
  app.introducedToday = today.filter((r) => r.source === 'review' && r.stateBefore === CardState.New).length;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  app.settings = { ...app.settings, ...patch };
  await db.setMeta('settings', app.settings);
}

/** Put a word into the study deck (it appears as a new card in the next review). */
export async function addToDeck(wordId: number): Promise<CardRecord> {
  const existing = app.cards.get(wordId);
  if (existing) return existing;
  const record: CardRecord = { wordId, card: newCard(), addedAt: new Date() };
  app.cards.set(wordId, record);
  await db.put('cards', record);
  return record;
}

/** Record a flashcard answer: reschedule the card and log it. */
export async function answerCard(wordId: number, grade: GradeValue, source: 'review' | 'quiz' = 'review'): Promise<CardRecord> {
  const record = app.cards.get(wordId) ?? (await addToDeck(wordId));
  const stateBefore = record.card.state;
  const now = new Date();
  const { card, log } = rate(record.card, grade, now);
  const updated: CardRecord = { ...record, card };
  app.cards.set(wordId, updated);
  await db.put('cards', updated);
  await db.put<ReviewRecord>('reviews', { wordId, at: now, rating: grade, source, stateBefore, log });
  if (source === 'review') {
    app.reviewedToday++;
    if (stateBefore === CardState.New) app.introducedToday++;
  }
  return updated;
}

/**
 * Record a quiz answer. A wrong answer on a word you're already studying
 * counts as "forgot it" and brings the card back soon. Right answers don't
 * change the schedule (a multiple-choice guess is weaker evidence than recall).
 */
export async function recordQuiz(wordId: number, type: string, correct: boolean, chosen: string): Promise<void> {
  await db.put<QuizRecord>('quiz', { wordId, type, correct, chosen, at: new Date() });
  const record = app.cards.get(wordId);
  if (!correct && record && record.card.state !== CardState.New) {
    await answerCard(wordId, Grades.Again, 'quiz');
  }
}

/** Word ids answered wrongly in quizzes in the last 14 days (most recent first). */
export async function recentMistakes(): Promise<number[]> {
  const since = new Date(Date.now() - 14 * 864e5);
  const rows = await db.getSince<QuizRecord>('quiz', since);
  const lastResult = new Map<number, boolean>();
  for (const r of rows) lastResult.set(r.wordId, r.correct); // rows are in date order
  return [...lastResult].filter(([, ok]) => !ok).map(([id]) => id).reverse();
}

export function cardMature(c: CardRecord): boolean {
  return isMature(c.card);
}

/** Started (not new) words, for quiz pools. */
export function startedWords(): Word[] {
  return [...app.cards.values()]
    .filter((c) => c.card.state !== CardState.New)
    .map((c) => app.byId.get(c.wordId))
    .filter((w): w is Word => !!w);
}

// ---------- backup ----------

type Backup = {
  app: 'hsk-study';
  version: 1;
  exportedAt: string;
  settings: Settings;
  cards: CardRecord[];
  reviews: ReviewRecord[];
  quiz: QuizRecord[];
};

/** Everything you've done, as JSON text. */
export async function exportBackup(): Promise<string> {
  const backup: Backup = {
    app: 'hsk-study',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: app.settings,
    cards: await db.getAll<CardRecord>('cards'),
    reviews: await db.getAll<ReviewRecord>('reviews'),
    quiz: await db.getAll<QuizRecord>('quiz'),
  };
  return JSON.stringify(backup);
}

/** Replace all progress with a backup. Throws a readable error if the text isn't a backup. */
export async function importBackup(text: string): Promise<{ cards: number; reviews: number }> {
  let data: Backup;
  try { data = JSON.parse(text); } catch { throw new Error('That text is not a backup file (it is not valid JSON).'); }
  if (data?.app !== 'hsk-study' || !Array.isArray(data.cards)) throw new Error('That file is not a backup from this app.');

  // JSON turns dates into strings; turn them back into dates.
  const date = (v: unknown) => (v ? new Date(v as string) : undefined);
  const cards = data.cards.map((c) => ({
    ...c, addedAt: date(c.addedAt)!, card: { ...c.card, due: date(c.card.due)!, last_review: date(c.card.last_review) },
  }));
  const reviews = (data.reviews ?? []).map((r) => ({ ...r, at: date(r.at)! }));
  const quiz = (data.quiz ?? []).map((q) => ({ ...q, at: date(q.at)! }));

  for (const s of ['cards', 'reviews', 'quiz'] as const) await db.clear(s);
  await db.putMany('cards', cards);
  await db.putMany('reviews', reviews);
  await db.putMany('quiz', quiz);
  if (data.settings) await saveSettings(data.settings);
  app.cards = new Map(cards.map((c) => [c.wordId, c]));
  await refreshTodayCounts();
  return { cards: cards.length, reviews: reviews.length };
}

/** Delete all progress (settings are kept). */
export async function resetProgress(): Promise<void> {
  for (const s of ['cards', 'reviews', 'quiz'] as const) await db.clear(s);
  app.cards = new Map();
  await refreshTodayCounts();
}
