// "Reader" screen: paste any Chinese text, see each word's HSK level,
// tap a word for details, and add the words you don't know to your deck.

import { h, mount, toast } from './dom.ts';
import { openWord, upTo } from './parts.ts';
import { app, addToDeck } from '../store.ts';
import { segment, coverage, type Token } from '../reader.ts';
import { CardState } from '../types.ts';

// An original practice text using HSK 1–3 words (written for this app).
const SAMPLE = '我叫小明，今年二十岁，是大学生。我每天早上七点起床，先喝一杯茶，然后坐公共汽车去学校。'
  + '我们学校很大，有图书馆，也有咖啡店。下午没有课的时候，我常常和朋友一起去打篮球。'
  + '晚上回家以后，我会看一会儿中文书，或者听中国音乐。我觉得学习汉语很有意思，但是汉字有点儿难。';

let text = SAMPLE;

export function renderReader(root: HTMLElement): void {
  const out = h('div', { class: 'reader-out' });
  const level = app.settings.studyLevel;

  const area = h('textarea', {
    id: 'reader-text', class: 'reader-input', rows: 6, lang: 'zh-CN', 'aria-label': 'Chinese text to read',
    placeholder: '把中文贴在这里 · Paste Chinese text here', value: text,
    oninput: (e: Event) => { text = (e.target as HTMLTextAreaElement).value; },
  });

  const analyse = () => {
    const tokens = segment(text, app.lexicon, app.charLevels);
    const cov = coverage(tokens, level, app.charLevels);
    const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
    const charPct = pct(cov.charsKnownLevel, cov.hanTotal);

    // Words at or below your level that you haven't started.
    const toLearn = [...new Map(tokens
      .filter((t): t is Extract<Token, { kind: 'word' }> => t.kind === 'word' && t.word.level <= level && !app.cards.has(t.word.id))
      .map((t) => [t.word.id, t.word])).values()];

    const tokenEl = (t: Token) => {
      if (t.kind === 'other') return document.createTextNode(t.text);
      if (t.kind === 'unknown') return h('span', { class: 'tk tk-x', title: t.charLevel ? `Not an HSK word; characters up to HSK ${t.charLevel}` : 'Not in HSK 1–6' }, t.text);
      const c = app.cards.get(t.word.id);
      const cls = c && c.card.state !== CardState.New ? 'tk-k' : t.word.level <= level ? 'tk-n' : 'tk-a';
      return h('button', { class: `tk ${cls}`, type: 'button', onclick: () => openWord(t.word, analyse) },
        t.text, h('sub', null, String(t.word.level)));
    };

    mount(out,
      h('div', { class: 'cov' },
        h('div', null, h('strong', null, `${charPct}%`), h('span', null, `of characters are in ${upTo(level)}`)),
        h('div', null, h('strong', null, `${pct(cov.wordsInLevel, cov.wordTokens)}%`), h('span', null, `of words are in ${upTo(level)}`)),
      ),
      h('p', { class: 'muted small' }, charPct >= 95
        ? 'Comfortable reading for your level (95% or more of the characters).'
        : 'Above 95% of characters is comfortable reading; this text will be a stretch.'),
      h('p', { class: 'legend' },
        h('span', { class: 'tk tk-k' }, '学'), ' studying  ',
        h('span', { class: 'tk tk-n' }, '学'), ' your level, not started  ',
        h('span', { class: 'tk tk-a' }, '学'), ' higher level  ',
        h('span', { class: 'tk tk-x' }, '学'), ' not in HSK 1–6'),
      h('div', { class: 'reading', lang: 'zh-CN' }, tokens.map(tokenEl)),
      toLearn.length
        ? h('button', {
            class: 'btn primary wide', type: 'button',
            onclick: async () => { for (const w of toLearn) await addToDeck(w.id); toast(`${toLearn.length} words added to your deck`); analyse(); },
          }, `Add ${toLearn.length} new ${upTo(level)} word${toLearn.length === 1 ? '' : 's'} to my deck`)
        : null,
    );
  };

  mount(root,
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'Tap a word for its meaning'),
      h('h1', null, h('span', { lang: 'zh-CN', class: 'zh-title' }, '阅读'), ' Reader'),
    ),
    area,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'button', onclick: analyse }, 'Read this text'),
      h('button', { class: 'btn', type: 'button', onclick: () => { text = ''; area.value = ''; area.focus(); out.replaceChildren(); } }, 'Clear'),
      text !== SAMPLE ? h('button', { class: 'btn', type: 'button', onclick: () => { text = SAMPLE; renderReader(root); } }, 'Sample text') : null,
    ),
    out,
  );
  if (text.trim()) analyse();
}
