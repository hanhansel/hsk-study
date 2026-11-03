// Shared data shapes. Kept free of imports so tests can load it directly.

/** One study word, as written by scripts/build-data.ts into public/data/words.json. */
export type Word = {
  id: number;            // official HSK syllabus entry number
  hanzi: string;         // simplified characters, e.g. "爱好"
  pinyin: string;        // official pinyin with tone marks, e.g. "àihào"
  numeric: string;       // tone numbers, e.g. "ai4 hao4" (5 = neutral, "r" = erhua)
  level: number;         // HSK level 1–6
  pos: string;           // official part of speech in Chinese, e.g. "动、名"
  meanings: string[];    // English meanings (CC-CEDICT)
  classifiers: string[]; // measure words
  freq: number | null;   // frequency rank, lower = more common
  radical: string;
  extraIds?: number[];   // other syllabus entries merged into this card
};

/** Character lists per level (public/data/chars.json). */
export type CharLists = Record<string, { read: string[]; write: string[] }>;

/** Card states, same numbers as ts-fsrs uses (State.New = 0 …). */
export const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;

/** The scheduling data ts-fsrs keeps for each card. */
export type FsrsCard = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: Date;
};

/** A word the learner has started (stored in IndexedDB "cards"). */
export type CardRecord = {
  wordId: number;
  card: FsrsCard;
  addedAt: Date;
};

/** One answer to a flashcard or quiz (stored in IndexedDB "reviews"). */
export type ReviewRecord = {
  id?: number;
  wordId: number;
  at: Date;
  rating: 1 | 2 | 3 | 4;           // Again, Hard, Good, Easy
  source: 'review' | 'quiz';
  stateBefore: number;             // CardState before this answer
  log?: unknown;                   // full ts-fsrs review log, kept for future optimising
};

/** One quiz answer (stored in IndexedDB "quiz"), used for "your mistakes" rounds. */
export type QuizRecord = {
  id?: number;
  wordId: number;
  type: string;
  correct: boolean;
  chosen: string;
  at: Date;
};

export type PinyinMode = 'always' | 'auto' | 'never';
export type AudioMode = 'front' | 'reveal' | 'off';

export type Settings = {
  studyLevel: number;        // new words come from levels up to this one
  newPerDay: number;         // new cards introduced per day
  pinyinOnFront: PinyinMode; // 'auto' = shown until a card is well known
  audio: AudioMode;          // when flashcards speak the word
  speechRate: number;        // 0.6 – 1.2
  voiceURI: string | null;   // chosen Chinese voice, null = automatic
};

export const DEFAULT_SETTINGS: Settings = {
  studyLevel: 1,
  newPerDay: 10,
  pinyinOnFront: 'auto',
  audio: 'reveal',
  speechRate: 0.85,
  voiceURI: null,
};
