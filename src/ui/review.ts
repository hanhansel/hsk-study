// Flashcard review session: due cards first, then today's new words.

import { h, mount } from './dom.ts';
import { hanziGrid, tonedPinyin, speakButton, levelTag, posInEnglish, openWord } from './parts.ts';
import { app, answerCard, addToDeck } from '../store.ts';
import { dueCards, addedNotStudied, newWordQueue, newLeftToday } from '../queue.ts';
import { previewIntervals, isMature, Grades, type GradeValue } from '../srs.ts';
import { speak } from '../tts.ts';
import { CardState, type Word } from '../types.ts';

/** What today's session will contain. Also used by the Today screen for its numbers. */
export function planToday(now = new Date()) {
  const due = dueCards(app.cards, now).map((c) => c.wordId);
  const added = addedNotStudied(app.cards).map((c) => c.wordId);
  const left = newLeftToday(app.settings.newPerDay, app.introducedToday);
  const fresh = newWordQueue(app.words, app.cards, app.settings.studyLevel)
    .slice(0, Math.max(0, left - added.length))
    .map((w) => w.id);
  // Words you added yourself always come; they still count toward the daily limit.
  return { due, newIds: [...added, ...fresh] };
}

export function startReview(root: HTMLElement, onExit: () => void): void {
  const plan = planToday();
  const queue: number[] = [...plan.due, ...plan.newIds];
  let reviewed = 0, again = 0;
  document.body.classList.add('focus');

  const exit = () => {
    keyHandler = null;
    document.body.classList.remove('focus');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    onExit();
  };

  const showNext = async () => {
    const wordId = queue[0];
    if (wordId === undefined) return finish();
    // A new word gets its card now, so the answer buttons can show their intervals.
    if (!app.cards.has(wordId)) await addToDeck(wordId);
    showCard(app.byId.get(wordId)!);
  };

  const showCard = (word: Word) => {
    const record = app.cards.get(word.id);
    const isNew = !record || record.card.state === CardState.New;
    const mode = app.settings.pinyinOnFront;
    const showPinyin = mode === 'always' || (mode === 'auto' && !(record && isMature(record.card)));
    let revealed = false;

    const topBar = h('header', { class: 'session-bar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'End review', onclick: exit }, '×'),
      h('span', { class: 'session-count' }, `${queue.length} left`),
      isNew ? h('span', { class: 'chip-new' }, 'New word') : levelTag(word.level),
    );

    const front = h('div', { class: 'card-front' },
      hanziGrid(word.hanzi, [...word.hanzi].length > 3 ? 'lg' : 'xl'),
      h('div', { class: 'front-pinyin' }, showPinyin ? tonedPinyin(word, 'py py-lg') : null),
    );
    const back = h('div', { class: 'card-back', hidden: true });
    const actions = h('div', { class: 'session-actions' });

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (app.settings.audio === 'reveal') speak(word.hanzi, app.settings.speechRate, app.settings.voiceURI);
      mount(back,
        h('div', { class: 'answer-line' }, tonedPinyin(word, 'py py-lg'), speakButton(word.hanzi)),
        h('ol', { class: 'meanings' }, word.meanings.slice(0, 3).map((m) => h('li', null, m))),
        h('p', { class: 'facts-inline' },
          word.pos ? posInEnglish(word.pos) : null,
          word.classifiers.length ? h('span', { lang: 'zh-CN' }, ` · measure word ${word.classifiers.slice(0, 3).join(' ')}`) : null,
          ' · ', h('button', { class: 'link', type: 'button', onclick: () => openWord(word) }, 'details'),
        ),
      );
      back.hidden = false;
      (front.querySelector('.front-pinyin') as HTMLElement).hidden = true; // pinyin now shows in the answer
      const card = (app.cards.get(word.id)?.card) ?? null;
      const intervals = card ? previewIntervals(card) : null;
      const btn = (grade: GradeValue, label: string, cls: string) =>
        h('button', { class: `grade ${cls}`, type: 'button', onclick: () => grade_(grade) },
          h('span', null, label), intervals ? h('small', null, intervals[grade]) : null);
      mount(actions,
        h('div', { class: 'grades' },
          btn(Grades.Again, 'Again', 'g-again'), btn(Grades.Hard, 'Hard', 'g-hard'),
          btn(Grades.Good, 'Good', 'g-good'), btn(Grades.Easy, 'Easy', 'g-easy')),
      );
    };

    const grade_ = async (grade: GradeValue) => {
      const updated = await answerCard(word.id, grade);
      reviewed++;
      if (grade === Grades.Again) again++;
      queue.shift();
      // Still learning and due again within 20 minutes? Show it again later in this session.
      const soon = updated.card.due.getTime() - Date.now() < 20 * 60000;
      if (updated.card.state !== CardState.Review && soon) queue.splice(Math.min(queue.length, 4), 0, word.id);
      showNext();
    };

    mount(actions, h('button', { class: 'btn primary wide', type: 'button', onclick: reveal }, 'Show answer'));
    front.addEventListener('click', reveal);
    mount(root, h('section', { class: 'session' }, topBar, h('div', { class: 'flashcard' }, front, back), actions));
    if (app.settings.audio === 'front') speak(word.hanzi, app.settings.speechRate, app.settings.voiceURI);
    keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      else if (revealed && ['1', '2', '3', '4'].includes(e.key)) grade_(Number(e.key) as GradeValue);
    };
  };

  const finish = () => {
    keyHandler = null;
    mount(root,
      h('section', { class: 'session done' },
        h('div', { class: 'done-mark', 'aria-hidden': 'true' }, '好'),
        h('h2', null, reviewed ? 'Session complete' : 'Nothing to review right now'),
        reviewed ? h('p', null, `${reviewed} answers · ${again} marked “Again”. Cards you missed come back soon.`) : h('p', null, 'Come back later, or practise with a quiz.'),
        h('button', { class: 'btn primary wide', type: 'button', onclick: exit }, 'Back to Today'),
      ),
    );
  };

  showNext();
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;
document.addEventListener('keydown', (e) => keyHandler?.(e));
