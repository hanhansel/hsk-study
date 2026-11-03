// "Today" screen: what's due, the study level, and progress per level.

import { h, mount } from './dom.ts';
import { app, saveSettings, cardMature } from '../store.ts';
import { levelProgress } from '../queue.ts';
import { planToday, startReview } from './review.ts';

/** Official HSK 3.0 (2025) cumulative targets, for the summary line. */
const SYLLABUS: Record<number, { words: number; grammar: number }> = {
  1: { words: 300, grammar: 70 }, 2: { words: 500, grammar: 148 }, 3: { words: 1000, grammar: 244 },
  4: { words: 2000, grammar: 339 }, 5: { words: 3600, grammar: 409 }, 6: { words: 5400, grammar: 459 },
};

export function renderToday(root: HTMLElement): void {
  const plan = planToday();
  const total = plan.due.length + plan.newIds.length;
  const level = app.settings.studyLevel;
  const progress = levelProgress(app.words, app.cards, cardMature);

  let readChars = 0, writeChars = 0;
  for (let l = 1; l <= level; l++) { readChars += app.chars[l]?.read.length ?? 0; writeChars += app.chars[l]?.write.length ?? 0; }

  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  mount(root,
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, date),
      h('h1', null, h('span', { lang: 'zh-CN', class: 'zh-title' }, '今天'), ' Today'),
    ),

    h('section', { class: 'panel review-panel' },
      h('div', { class: 'counts' },
        h('div', null, h('strong', null, String(plan.due.length)), h('span', null, 'due')),
        h('div', null, h('strong', null, String(plan.newIds.length)), h('span', null, 'new')),
        h('div', null, h('strong', null, String(app.reviewedToday)), h('span', null, 'done today')),
      ),
      total
        ? h('button', { class: 'btn primary wide', type: 'button', onclick: () => startReview(root, () => renderToday(root)) },
            `Start review · ${total} card${total === 1 ? '' : 's'}`)
        : h('p', { class: 'calm' }, 'All caught up. A quiz or the reader is a good next step.'),
      !total ? h('div', { class: 'row' },
        h('a', { class: 'btn', href: '#practice' }, 'Practise'),
        h('a', { class: 'btn', href: '#reader' }, 'Read')) : null,
    ),

    h('section', { class: 'panel' },
      h('h2', null, 'Studying up to'),
      h('div', { class: 'levels', role: 'radiogroup', 'aria-label': 'Study level' },
        [1, 2, 3, 4, 5, 6].map((l) =>
          h('button', {
            class: `level-pick${l === level ? ' on' : ''}`, type: 'button', role: 'radio',
            'aria-checked': String(l === level),
            onclick: async () => { await saveSettings({ studyLevel: l }); renderToday(root); },
          }, `HSK ${l}`))),
      h('p', { class: 'syllabus-line' },
        `HSK ${level} syllabus: ${SYLLABUS[level].words.toLocaleString()} words · ${readChars} characters to read · ${writeChars} to write · ${SYLLABUS[level].grammar} grammar points.`),
      h('p', { class: 'muted small' }, `New words: ${app.settings.newPerDay} a day, easiest levels first. Change this under More.`),
    ),

    h('section', { class: 'panel' },
      h('h2', null, 'Progress'),
      h('ul', { class: 'progress-list' },
        progress.map((p) =>
          h('li', { class: p.level > level ? 'dim' : '' },
            h('span', { class: 'p-level' }, `HSK ${p.level}`),
            h('span', { class: 'bar', role: 'img', 'aria-label': `${p.started} of ${p.total} started, ${p.mature} well known` },
              h('span', { class: 'bar-started', style: `width:${(100 * p.started) / p.total}%` }),
              h('span', { class: 'bar-mature', style: `width:${(100 * p.mature) / p.total}%` })),
            h('span', { class: 'p-num' }, `${p.started}`, h('small', null, ` / ${p.total}`)),
          ))),
      h('p', { class: 'legend' },
        h('span', { class: 'key key-started' }), 'started  ',
        h('span', { class: 'key key-mature' }), 'well known (3+ weeks between reviews)'),
    ),
  );
}
