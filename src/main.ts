// App start-up: load data, draw the bottom tabs, and show the screen named in the URL hash.

import './styles.css';
import { h, mount } from './ui/dom.ts';
import { loadApp } from './store.ts';
import { initSpeech } from './tts.ts';
import { renderToday } from './ui/today.ts';
import { renderPractice } from './ui/practice.ts';
import { renderWords } from './ui/words.ts';
import { renderReader } from './ui/readerView.ts';
import { renderMore, install } from './ui/more.ts';

const TABS = [
  { id: 'today', zh: '今天', en: 'Today', render: renderToday },
  { id: 'practice', zh: '练习', en: 'Practice', render: renderPractice },
  { id: 'words', zh: '词汇', en: 'Words', render: renderWords },
  { id: 'reader', zh: '阅读', en: 'Reader', render: renderReader },
  { id: 'more', zh: '设置', en: 'More', render: renderMore },
] as const;

const view = document.getElementById('view')!;
const nav = document.getElementById('tabs')!;

function currentTab() {
  const id = location.hash.slice(1);
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

function show(): void {
  const tab = currentTab();
  document.body.classList.remove('focus');
  mount(nav, TABS.map((t) =>
    h('a', { href: `#${t.id}`, class: t === tab ? 'on' : '', 'aria-current': t === tab ? 'page' : null },
      h('span', { class: 'tab-zh', lang: 'zh-CN' }, t.zh), h('span', { class: 'tab-en' }, t.en))));
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  tab.render(view);
}

async function start(): Promise<void> {
  try {
    await Promise.all([loadApp(), initSpeech()]);
  } catch (err) {
    mount(view, h('section', { class: 'panel' },
      h('h1', null, 'Could not start'),
      h('p', null, 'The word list or the saved progress could not be loaded. Check the connection on first launch, then reload.'),
      h('pre', { class: 'muted small' }, String(err))));
    return;
  }
  window.addEventListener('hashchange', show);
  show();
  // Ask the browser to never clear our saved progress. Chrome decides silently
  // (it says yes once the app is installed), so there's nothing for you to tap.
  navigator.storage?.persist?.().catch(() => {});
}

// Offline support: the service worker caches the app after the first visit.
// (Some preview environments block service workers; the app still works there.)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* not available here */ });
}

// Chrome on Android offers installation through this event.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  const evt = e as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
  install.prompt = async () => { await evt.prompt(); await evt.userChoice; install.prompt = null; };
});

start();
