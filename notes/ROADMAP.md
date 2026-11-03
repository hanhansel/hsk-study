# HSK Study: Roadmap

Goal: a personal Android study app for the **HSK 3.0 exam (November 2025 syllabus)**. The target is HSK 3 or above, with self-paced study and no fixed exam date.

## Facts the plan is built on

- The exam to prepare for is the **新版HSK考试大纲 (November 2025)**, not the 2021 standard (GF0025-2021). The two disagree on the level of about 40% of shared words. The first regular sitting is **13 December 2026**.
- **HSK 3 requirements:** 1,000 words, 655 characters to read, 250 characters to write, and 244 grammar points.
- **HSK 3 written test:** 70 questions, about 83 minutes, with **no pinyin** on the paper.

  | Section | Questions | Time | Parts |
  |---|---|---|---|
  | Listening | 30 | ~23 min | Dialogue → picture; dialogue + question → 3 options; monologue + question → 3 options |
  | Reading | 30 | 30 min | Match responses; word-bank cloze; short passages with ★ questions |
  | Writing | 10 | 20 min | Write the character from a pinyin hint; write your own sentence with a given word |

- **HSK 3 speaking test:** separate, about 15 minutes. It is reported to have 3 parts: repeat sentences, describe pictures, and answer questions.
- **HSK 1:** 40 questions (listening and reading), with pinyin printed.
- **HSK 2:** 60 questions; writing starts at this level.
- **Pass marks:** none have been published yet for the new HSK 1–6. Mock exams will show unofficial percentages.

## Phases

### ✅ Phase 1: Data (done)

- The official 2025 list is the master, with entry numbers. drkameleon provides meanings, and full CC-CEDICT fills the gaps.
- The pipeline is `scripts/build-data.ts`, and its results are in `notes/DATA_REPORT.md`.
- Word, character and grammar counts all match the syllabus.

### ✅ Phase 2: App MVP (done)

- Installable PWA: plain TypeScript, esbuild, IndexedDB and a service worker. It works offline.
- **FSRS flashcards:**
  - 90% target recall, intervals capped at 1 year, and 10 new words a day by default.
  - New words come lowest level first, then most frequent first.
- **Pinyin on the card front** disappears once a word is well known, as recommended for a pinyin-free exam.
- **Quizzes:** meaning, characters, pinyin, listening, and tones by ear.
  - The research recommended bringing listening forward, because it is 30 of the 70 questions on HSK 3.
  - Wrong options are chosen to be believable. Pinyin options differ only in tone. Listening options sound alike but are never identical.
- **Reader** (moved earlier because it was cheap):
  - Tags each word with its HSK level.
  - Shows character and word coverage; 95%+ means comfortable reading.
  - Adds unknown words to your deck.
- **Protecting progress:** the app asks for persistent storage automatically, and there is JSON backup and restore.
- **Hosting:** the built app is committed in `docs/` and served by GitHub Pages ("Deploy from branch → /docs"). No build step is needed on GitHub.
- **Writing quiz (experimental):**
  - Draw the missing character of a word, stroke by stroke, using Hanzi Writer with offline stroke data for the 700 HSK 1–6 characters to write.
  - It is a single Practice card and doesn't affect flashcards.

### Phase 3: Fill the gaps the exam tests (next; keep it simple)

The app should stay simple: add only what clearly helps, and avoid new screens where possible. Handwriting is covered by the experimental Writing quiz.

1. **Example sentences.** Use Tatoeba Mandarin–English pairs (CC BY 2.0 FR), filtered so ≥95% of characters are at or below the word's level. Show them on cards, and use them for "listen to a sentence" drills.
2. **Grammar checklist.** List the 244 HSK 1–3 grammar points (data already in `public/data/grammar.json`), each with a short English explanation and a link to the Chinese Grammar Wiki (CC BY-NC-SA, fine for private use). Mark points as learned.
3. **Better tone audio.** Use recorded syllables (audio-cmn) for the tone trainer, since phone voices are weak on single syllables. Drill easy contrasts first and tone 2 vs 3 last.
4. **Sentence production.** For writing part 2 and speaking, show a word, have the learner type or say a sentence, then compare with a model answer and self-grade.
5. **Character cards.** Recognition cards for the 655 HSK 1–3 characters.

### Phase 4: Mock exams

- Timed papers in the real 2025 format for HSK 1–3, built from original questions using in-level words only. The official sample papers are copyrighted, so only their format is copied.
- Picture items will use simple icons in place of photos.
- Scoring will be a percentage per section, labelled unofficial, until CTI publishes pass marks.

### Phase 5: More reading and later options

- Graded reading texts: harukicoder's CC BY 4.0 graded readers.
- A speaking trainer that uses speech recognition.
- Wrap the app with Capacitor (a real APK) only if phone storage or voice proves unreliable.
- **Not planned:** HSK 7–9 and traditional characters.

## Licence notes, if this is ever published

Chinese Grammar Wiki text (non-commercial) and audio-cmn (unclear licence) are fine for private use but not for a public or paid app. The syllabus lists are CTI's content.
