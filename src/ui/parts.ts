// Small building blocks shared by several screens.

import { h, mount, toast } from './dom.ts';
import { markSyllable } from '../pinyin.ts';
import { speak } from '../tts.ts';
import { app, addToDeck, cardMature } from '../store.ts';
import { CardState, type Word } from '../types.ts';

/** Characters drawn in 田字格 practice squares, one square per character. */
export function hanziGrid(hanzi: string, size: 'xl' | 'lg' | 'md' = 'xl'): HTMLElement {
  return h('div', { class: `tzg tzg-${size}`, lang: 'zh-CN', 'aria-label': hanzi },
    [...hanzi].map((ch) => h('span', { class: 'tzg-cell' }, ch)));
}

/** Pinyin with each syllable coloured by tone (1 red, 2 green, 3 blue, 4 purple, neutral grey). */
export function tonedPinyin(word: Pick<Word, 'numeric' | 'pinyin'>, cls = 'py'): HTMLElement {
  if (!word.numeric) return h('span', { class: cls }, word.pinyin);
  const spans: HTMLElement[] = [];
  for (const part of word.numeric.split(' ')) {
    if (part === 'r' && spans.length) { spans[spans.length - 1].append('r'); continue; }
    const tone = Number(part.slice(-1));
    spans.push(h('span', { class: `t${tone}` }, markSyllable(part.slice(0, -1), tone)));
  }
  return h('span', { class: cls, lang: 'zh-Latn-pinyin' }, spans);
}

const POS: Record<string, string> = {
  名: 'noun', 动: 'verb', 形: 'adjective', 副: 'adverb', 量: 'measure word', 数: 'number',
  代: 'pronoun', 介: 'preposition', 连: 'conjunction', 助: 'particle', 叹: 'interjection',
  拟声: 'sound word', 数量: 'number + measure', 前缀: 'prefix', 后缀: 'suffix',
};
export const posInEnglish = (pos: string) => pos.split('、').map((p) => POS[p] ?? p).join(', ');

/** "HSK 1" or "HSK 1–3": the levels up to `level`. */
export const upTo = (level: number) => (level === 1 ? 'HSK 1' : `HSK 1–${level}`);

export function levelTag(level: number): HTMLElement {
  return h('span', { class: `lvl lvl-${level}` }, `HSK ${level}`);
}

/** Round speaker button. */
export function speakButton(text: string, label = 'Play sound'): HTMLButtonElement {
  return h('button', {
    class: 'speak', type: 'button', 'aria-label': label,
    onclick: (e: Event) => { e.stopPropagation(); speak(text, app.settings.speechRate, app.settings.voiceURI); },
  }, speakerIcon());
}

export function speakerIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  return svg;
}

/** "New", "Learning", "Due", "Known" label for a word. */
export function statusOf(wordId: number): { key: string; label: string } {
  const c = app.cards.get(wordId);
  if (!c) return { key: 'none', label: 'Not started' };
  if (c.card.state === CardState.New) return { key: 'queued', label: 'In your deck' };
  if (cardMature(c)) return { key: 'known', label: 'Well known' };
  if (c.card.due.getTime() <= Date.now()) return { key: 'due', label: 'Due now' };
  return { key: 'learning', label: 'Learning' };
}

// ---------- word details (bottom sheet) ----------

let sheet: HTMLDialogElement | null = null;

/** Open the details sheet for a word. `onChange` runs after the word is added to the deck. */
export function openWord(word: Word, onChange?: () => void): void {
  if (!sheet) {
    sheet = h('dialog', { class: 'sheet', 'aria-label': 'Word details' });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet!.close(); });
    document.body.appendChild(sheet);
  }
  const render = () => {
    const status = statusOf(word.id);
    const c = app.cards.get(word.id);
    mount(sheet!,
      h('div', { class: 'sheet-body' },
        h('div', { class: 'sheet-top' },
          levelTag(word.level),
          h('span', { class: `status s-${status.key}` }, status.label),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => sheet!.close() }, '×'),
        ),
        h('div', { class: 'sheet-word' }, hanziGrid(word.hanzi, 'lg'), speakButton(word.hanzi)),
        tonedPinyin(word, 'py py-lg'),
        h('ol', { class: 'meanings' }, word.meanings.map((m) => h('li', null, m))),
        h('dl', { class: 'facts' },
          word.pos ? [h('dt', null, 'Part of speech'), h('dd', null, `${posInEnglish(word.pos)}  ·  ${word.pos}`)] : null,
          word.classifiers.length ? [h('dt', null, 'Measure word'), h('dd', { lang: 'zh-CN' }, word.classifiers.join('  '))] : null,
          h('dt', null, 'Syllabus entry'), h('dd', null, `No. ${[word.id, ...(word.extraIds ?? [])].join(', ')}`),
          c && c.card.state !== CardState.New ? [h('dt', null, 'Next review'), h('dd', null, c.card.due.toLocaleDateString())] : null,
        ),
        !c
          ? h('button', {
              class: 'btn primary wide', type: 'button',
              onclick: async () => { await addToDeck(word.id); toast(`${word.hanzi} added to your deck`); render(); onChange?.(); },
            }, 'Add to my deck')
          : null,
      ),
    );
  };
  render();
  if (!sheet.open) sheet.showModal();
}
