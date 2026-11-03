// Writing quiz screen (experimental). Draw the missing character with your finger;
// Hanzi Writer checks each stroke and shows a hint after 3 misses.

import HanziWriter from 'hanzi-writer';
import { h, mount } from './dom.ts';
import { tonedPinyin, speakButton, upTo } from './parts.ts';
import { app } from '../store.ts';
import { writingRound, type WritingPrompt } from '../writing.ts';
import { gloss } from '../quiz.ts';

const ROUND_SIZE = 8;

// Stroke data for all characters to write (public/data/strokes.json), loaded once.
let strokeData: Promise<Record<string, unknown>> | null = null;
const loadStrokes = () => (strokeData ??= fetch('data/strokes.json').then((r) => r.json()));

/** Read a colour token from the stylesheet, so the drawing follows light/dark mode. */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333';

export function startWriting(root: HTMLElement, onExit: () => void): void {
  const prompts = writingRound(app.chars, app.words, app.settings.studyLevel, ROUND_SIZE);
  const results: { p: WritingPrompt; mistakes: number; shown: boolean }[] = [];
  document.body.classList.add('focus');
  const exit = () => { document.body.classList.remove('focus'); onExit(); };

  const ask = (i: number) => {
    const p = prompts[i];
    if (!p) return finish();
    let done = false, shown = false;

    // The word with the missing character as a gap: 爱好 -> （  ）好
    const chars = [...p.word.hanzi];
    const gapped = h('p', { class: 'w-word', lang: 'zh-CN' },
      chars.map((c, k) => (k === p.index ? h('span', { class: 'w-gap' }, '　') : c)));

    const pad = h('div', { class: 'w-pad tzg-cell', 'aria-label': 'Writing area' });
    const status = h('p', { class: 'w-status', 'aria-live': 'polite' }, 'Write the missing character, stroke by stroke.');
    const actions = h('div', { class: 'row w-actions' });

    mount(root,
      h('section', { class: 'session' },
        h('header', { class: 'session-bar' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'End writing practice', onclick: exit }, '×'),
          h('span', { class: 'session-count' }, `Writing · ${i + 1} / ${prompts.length}`),
          h('span', { class: 'chip-new' }, 'Experiment'),
        ),
        h('div', { class: 'prompt w-prompt' },
          gapped,
          h('p', { class: 'w-hint' }, h('strong', null, `（${p.pinyin}）`), ' ', tonedPinyin(p.word), ' · ', gloss(p.word, 50)),
        ),
        pad, status, actions,
      ));

    const size = Math.min(280, pad.clientWidth || 280);
    const writer = HanziWriter.create(pad, p.char, {
      width: size, height: size, padding: 18,
      showCharacter: false, showOutline: false,
      strokeColor: token('--ink'), drawingColor: token('--accent'), highlightColor: token('--warn'),
      outlineColor: token('--line'), drawingWidth: 18,
      charDataLoader: (char, onLoad, onError) => { loadStrokes().then((d) => (d[char] ? onLoad(d[char] as never) : onError())).catch(onError); },
    });

    const complete = (mistakes: number) => {
      if (done) return;
      done = true;
      results.push({ p, mistakes, shown });
      status.className = `w-status ${shown ? 'warn' : mistakes <= 2 ? 'ok' : 'warn'}`;
      status.textContent = shown ? `This is ${p.char}. Try it again next round.`
        : mistakes === 0 ? '对了！ Perfect.' : `Done, with ${mistakes} wrong stroke${mistakes === 1 ? '' : 's'}.`;
      mount(actions,
        speakButton(p.word.hanzi),
        h('button', { class: 'btn', type: 'button', onclick: () => writer.animateCharacter() }, 'Show strokes'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => ask(i + 1) }, i + 1 < prompts.length ? 'Next' : 'See results'));
    };

    writer.quiz({
      showHintAfterMisses: 3,
      onMistake: (d) => { status.textContent = d.mistakesOnStroke >= 3 ? 'Follow the hint.' : 'Not that stroke. Try again.'; },
      onCorrectStroke: (d) => { status.textContent = d.strokesRemaining ? `${d.strokesRemaining} stroke${d.strokesRemaining === 1 ? '' : 's'} left` : ''; },
      onComplete: (s) => complete(s.totalMistakes),
    });

    mount(actions,
      h('button', {
        class: 'btn', type: 'button',
        onclick: () => { shown = true; writer.cancelQuiz(); writer.animateCharacter(); complete(99); },
      }, 'I don’t know, show me'));
  };

  const finish = () => {
    const good = results.filter((r) => !r.shown && r.mistakes <= 2).length;
    mount(root,
      h('section', { class: 'session done' },
        h('div', { class: 'score' }, h('strong', null, String(good)), h('span', null, `/ ${results.length}`)),
        h('h2', null, 'Writing round finished'),
        h('p', { class: 'muted' }, `Characters to write for ${upTo(Math.max(app.settings.studyLevel, 2))}. Counted as right with 2 wrong strokes or fewer.`),
        h('p', { class: 'w-review', lang: 'zh-CN' }, results.map((r) =>
          h('span', { class: !r.shown && r.mistakes <= 2 ? 'ok' : 'warn' }, r.p.char))),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => startWriting(root, onExit) }, 'Another round'),
          h('button', { class: 'btn', type: 'button', onclick: exit }, 'Done')),
      ));
  };

  ask(0);
}
