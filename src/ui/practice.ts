// "Practice" screen: multiple-choice quizzes, including listening and tones.

import { h, mount } from './dom.ts';
import { hanziGrid, tonedPinyin, speakButton, speakerIcon, openWord, upTo } from './parts.ts';
import { app, recordQuiz, recentMistakes, startedWords } from '../store.ts';
import { QUIZ_TYPES, makeQuestion, pickRound, gloss, type QuizType, type Question } from '../quiz.ts';
import { speak, speechStatus } from '../tts.ts';
import type { Word } from '../types.ts';
import { startWriting } from './writing.ts';

const ROUND_SIZE = 10;
type PoolChoice = 'mine' | 'level' | 'mistakes';
let poolChoice: PoolChoice | null = null;

export async function renderPractice(root: HTMLElement): Promise<void> {
  const mine = startedWords();
  const mistakes = await recentMistakes();
  const levelPool = app.words.filter((w) => w.level <= app.settings.studyLevel);
  // Default: your own words once you have enough of them, otherwise the whole level.
  if (!poolChoice || (poolChoice === 'mistakes' && !mistakes.length)) poolChoice = mine.length >= 12 ? 'mine' : 'level';
  const audioOk = speechStatus() === 'ready';

  const choose = (c: PoolChoice) => { poolChoice = c; renderPractice(root); };
  const poolBtn = (c: PoolChoice, label: string, count: number, disabled = false) =>
    h('button', { class: `seg${poolChoice === c ? ' on' : ''}`, type: 'button', disabled, 'aria-pressed': String(poolChoice === c), onclick: () => choose(c) },
      label, h('small', null, String(count)));

  mount(root,
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, `${ROUND_SIZE} questions a round`),
      h('h1', null, h('span', { lang: 'zh-CN', class: 'zh-title' }, '练习'), ' Practice'),
    ),
    h('section', { class: 'panel' },
      h('h2', null, 'Words to use'),
      h('div', { class: 'segs' },
        poolBtn('mine', 'My words', mine.length, mine.length < 4),
        poolBtn('level', upTo(app.settings.studyLevel), levelPool.length),
        poolBtn('mistakes', 'Recent mistakes', mistakes.length, mistakes.length === 0),
      ),
    ),
    h('section', { class: 'quiz-grid' },
      QUIZ_TYPES.map((q) =>
        h('button', {
          class: 'quiz-type', type: 'button',
          onclick: () => {
            const pool = poolChoice === 'mine' ? mine : poolChoice === 'mistakes'
              ? mistakes.map((id) => app.byId.get(id)!).filter(Boolean) : levelPool;
            startRound(root, q.type, pool, levelPool, mistakes);
          },
        },
          h('span', { class: 'qt-zh', lang: 'zh-CN' }, q.zh),
          h('span', { class: 'qt-title' }, q.title),
          h('span', { class: 'qt-about' }, q.about),
          q.needsAudio && !audioOk ? h('span', { class: 'qt-warn' }, 'Needs a Chinese voice: see More') : null,
        )),
      // Experimental: handwriting with stroke checking.
      h('button', { class: 'quiz-type qt-try', type: 'button', onclick: () => startWriting(root, () => renderPractice(root)) },
        h('span', { class: 'qt-zh', lang: 'zh-CN' }, '书写'),
        h('span', { class: 'qt-title' }, 'Writing ', h('small', { class: 'qt-badge' }, 'try it')),
        h('span', { class: 'qt-about' }, 'Draw the missing character with your finger, stroke by stroke.')),
    ),
  );
}

/**
 * One round of questions. `pool` = words asked about; `distractorPool` = words
 * the wrong options may come from (always the whole level, so options vary).
 */
function startRound(root: HTMLElement, type: QuizType, pool: Word[], distractorPool: Word[], mistakes: number[]): void {
  const usable = type === 'pinyin' || type === 'tones' ? pool.filter((w) => w.numeric) : pool;
  const words = pickRound(usable, ROUND_SIZE, poolChoice === 'mistakes' ? [] : mistakes);
  const others = distractorPool.length >= 40 ? distractorPool : app.words.filter((w) => w.level <= 2);
  const questions: Question[] = words.map((w) => makeQuestion(type, w, others));
  const results: { q: Question; ok: boolean }[] = [];
  const info = QUIZ_TYPES.find((t) => t.type === type)!;
  document.body.classList.add('focus');

  const exit = () => { document.body.classList.remove('focus'); renderPractice(root); };

  const ask = (i: number) => {
    const q = questions[i];
    if (!q) return finish();
    let answered = false;
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const next = h('div', { class: 'session-actions' });

    const say = () => q.prompt.speak && speak(q.prompt.speak, app.settings.speechRate, app.settings.voiceURI);

    const choose = async (btn: HTMLButtonElement, opt: Question['options'][number]) => {
      if (answered) return;
      answered = true;
      results.push({ q, ok: opt.correct });
      optionButtons.forEach((b, k) => {
        b.disabled = true;
        if (q.options[k].correct) b.classList.add('right');
        // after answering, show pinyin under character options so you learn from them
        if (q.options[k].tonedPinyin) b.append(h('small', { class: 'opt-py' }, q.options[k].tonedPinyin!));
      });
      if (!opt.correct) btn.classList.add('wrong');
      await recordQuiz(q.word.id, type, opt.correct, opt.label);
      mount(feedback,
        h('p', { class: opt.correct ? 'fb-ok' : 'fb-no' }, opt.correct ? '对了！ Correct' : '不对 Not quite'),
        h('button', { class: 'fb-word', type: 'button', onclick: () => openWord(q.word) },
          h('span', { class: 'fb-hanzi', lang: 'zh-CN' }, q.word.hanzi),
          tonedPinyin(q.word),
          h('span', { class: 'fb-gloss' }, gloss(q.word, 50))),
      );
      if (q.type !== 'listen' && q.type !== 'tones') say();
      mount(next, h('button', { class: 'btn primary wide', type: 'button', onclick: () => ask(i + 1) }, i + 1 < questions.length ? 'Next' : 'See results'));
    };

    const optionButtons = q.options.map((opt) => {
      const isHanzi = q.type === 'hanzi' || q.type === 'listen';
      const b = h('button', { class: `option${isHanzi ? ' opt-hanzi' : ''}${q.type === 'pinyin' || q.type === 'tones' ? ' opt-py-big' : ''}`, type: 'button', lang: isHanzi ? 'zh-CN' : null },
        h('span', null, opt.label));
      b.addEventListener('click', () => choose(b, opt));
      return b;
    });

    const prompt = h('div', { class: 'prompt' },
      q.prompt.hanzi ? hanziGrid(q.prompt.hanzi, [...q.prompt.hanzi].length > 3 ? 'md' : 'lg') : null,
      q.prompt.text ? h('p', { class: 'prompt-text' }, q.prompt.text) : null,
      q.prompt.speak && !q.prompt.hanzi
        ? h('button', { class: 'big-speak', type: 'button', 'aria-label': 'Play again', onclick: say }, speakerIcon(), h('span', null, 'Play again'))
        : null,
      q.prompt.pinyin ? h('p', { class: 'prompt-py' }, q.prompt.pinyin) : null,
      q.prompt.hint ? h('p', { class: 'prompt-hint' }, q.prompt.hint) : null,
      q.prompt.hanzi && q.type === 'meaning' ? speakButton(q.prompt.hanzi) : null,
    );

    mount(root,
      h('section', { class: 'session' },
        h('header', { class: 'session-bar' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'End quiz', onclick: exit }, '×'),
          h('span', { class: 'session-count' }, `${info.title} · ${i + 1} / ${questions.length}`),
          h('span', { class: 'dots', 'aria-hidden': 'true' },
            questions.map((_, k) => h('span', { class: k < results.length ? (results[k].ok ? 'dot ok' : 'dot no') : k === i ? 'dot now' : 'dot' }))),
        ),
        prompt,
        h('div', { class: 'options' }, optionButtons),
        feedback,
        next,
      ));
    if (q.type === 'listen' || q.type === 'tones') say();
  };

  const finish = () => {
    const right = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok).map((r) => r.q.word);
    mount(root,
      h('section', { class: 'session done' },
        h('div', { class: 'score' }, h('strong', null, String(right)), h('span', null, `/ ${results.length}`)),
        h('h2', null, right === results.length ? 'Perfect round' : `${info.title} round finished`),
        missed.length
          ? h('div', { class: 'missed' },
              h('p', { class: 'muted' }, 'Words to look at again. Missed words you are studying come back in your next review.'),
              h('ul', { class: 'word-rows' }, missed.map((w) =>
                h('li', null, h('button', { class: 'word-row', type: 'button', onclick: () => openWord(w) },
                  h('span', { class: 'wr-hanzi', lang: 'zh-CN' }, w.hanzi), tonedPinyin(w), h('span', { class: 'wr-gloss' }, gloss(w, 40)))))))
          : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => startRound(root, type, pool, distractorPool, mistakes) }, 'Another round'),
          h('button', { class: 'btn', type: 'button', onclick: exit }, 'Done')),
      ));
  };

  if (!questions.length) {
    mount(root, h('section', { class: 'session done' }, h('h2', null, 'No words to quiz yet'), h('p', null, 'Study a few flashcards first, or pick a whole level.'),
      h('button', { class: 'btn primary', type: 'button', onclick: exit }, 'Back')));
    return;
  }
  ask(0);
}
