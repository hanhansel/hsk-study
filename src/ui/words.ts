// "Words" screen: browse the syllabus by level, or search by hanzi, pinyin or English.

import { h, mount } from './dom.ts';
import { tonedPinyin, openWord, statusOf } from './parts.ts';
import { app } from '../store.ts';
import { gloss } from '../quiz.ts';
import { matches } from '../search.ts';

let level = 0;       // 0 = follow the study level
let query = '';
let shown = 150;

export function renderWords(root: HTMLElement): void {
  if (!level) level = app.settings.studyLevel;
  const list = h('ul', { class: 'word-rows' });
  const more = h('div');
  const countLine = h('p', { class: 'muted small' });

  const draw = () => {
    const results = app.words.filter((w) => (query ? true : w.level === level) && matches(w, query.trim()));
    tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', !query && i + 1 === level));
    countLine.textContent = query
      ? `${results.length} match${results.length === 1 ? '' : 'es'} in HSK 1–6`
      : `${results.length} words first taught at HSK ${level}`;
    mount(list, results.slice(0, shown).map((w) => {
      const st = statusOf(w.id);
      return h('li', null, h('button', { class: 'word-row', type: 'button', onclick: () => openWord(w, draw) },
        h('span', { class: 'wr-hanzi', lang: 'zh-CN' }, w.hanzi),
        tonedPinyin(w),
        h('span', { class: 'wr-gloss' }, gloss(w, 44)),
        h('span', { class: `dot-status s-${st.key}`, title: st.label, 'aria-label': st.label })));
    }));
    mount(more, results.length > shown
      ? h('button', { class: 'btn wide', type: 'button', onclick: () => { shown += 300; draw(); } }, `Show ${Math.min(300, results.length - shown)} more`)
      : null);
  };

  const tabs = h('div', { class: 'levels small-levels', role: 'tablist' },
    [1, 2, 3, 4, 5, 6].map((l) => h('button', {
      class: 'level-pick', type: 'button', role: 'tab', 'aria-selected': String(l === level),
      onclick: () => { level = l; query = ''; shown = 150; renderWords(root); },
    }, `HSK ${l}`)));

  const search = h('input', {
    id: 'word-search', class: 'search', type: 'search', placeholder: 'Search 汉字, pinyin or English',
    value: query, autocomplete: 'off', 'aria-label': 'Search words',
    oninput: (e: Event) => { query = (e.target as HTMLInputElement).value; shown = 150; draw(); },
  });

  mount(root,
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'HSK 3.0 syllabus, 2025 edition'),
      h('h1', null, h('span', { lang: 'zh-CN', class: 'zh-title' }, '词汇'), ' Words'),
    ),
    search,
    tabs,
    h('p', { class: 'legend' },
      h('span', { class: 'dot-status s-learning' }), 'learning  ',
      h('span', { class: 'dot-status s-due' }), 'due  ',
      h('span', { class: 'dot-status s-known' }), 'well known  ',
      h('span', { class: 'dot-status s-queued' }), 'in deck'),
    countLine, list, more,
  );
  draw();
}
