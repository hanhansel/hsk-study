// "More" screen: study settings, voice, saving your data (install, backup, restore), and credits.

import { h, mount, toast } from './dom.ts';
import { app, saveSettings, exportBackup, importBackup, resetProgress } from '../store.ts';
import { speak, speechStatus, chineseVoices } from '../tts.ts';
import type { AudioMode, PinyinMode } from '../types.ts';

/** Set by main.ts when Chrome offers to install the app. */
export const install: { prompt: (() => Promise<void>) | null } = { prompt: null };

export async function renderMore(root: HTMLElement): Promise<void> {
  const s = app.settings;
  const status = speechStatus();
  const voices = chineseVoices();
  const persisted = await navigator.storage?.persisted?.().catch(() => false) ?? false;
  const usage = await navigator.storage?.estimate?.().catch(() => null) ?? null;
  const standalone = matchMedia('(display-mode: standalone)').matches;

  const radio = <T extends string>(name: string, value: T, current: T, label: string, onPick: (v: T) => void) =>
    h('label', { class: 'radio' },
      h('input', { type: 'radio', name, id: `${name}-${value}`, value, checked: value === current, onchange: () => onPick(value) }),
      h('span', null, label));

  const backupBox = h('div', { class: 'backup-box' });
  const confirmBox = h('div', { class: 'confirm-box' });

  /** In-page confirmation (browser confirm() dialogs are blocked in some views). */
  const askConfirm = (message: string, action: string, run: () => Promise<void>) => {
    mount(confirmBox,
      h('div', { class: 'confirm', role: 'alertdialog', 'aria-label': message },
        h('p', null, message),
        h('div', { class: 'row' },
          h('button', { class: 'btn danger', type: 'button', onclick: async () => { confirmBox.replaceChildren(); await run(); } }, action),
          h('button', { class: 'btn', type: 'button', onclick: () => confirmBox.replaceChildren() }, 'Cancel'))));
    confirmBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const restoreFrom = (text: string) =>
    askConfirm('Restoring replaces all progress on this phone with the backup.', 'Replace my progress', async () => {
      try {
        const r = await importBackup(text);
        toast(`Restored ${r.cards} cards and ${r.reviews} answers`);
        renderMore(root);
      } catch (err) { toast((err as Error).message); }
    });

  mount(root,
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'Settings, voice, backup'),
      h('h1', null, h('span', { lang: 'zh-CN', class: 'zh-title' }, '设置'), ' More'),
    ),

    h('section', { class: 'panel form' },
      h('h2', null, 'Flashcards'),
      h('label', { class: 'field', for: 'new-per-day' }, h('span', null, 'New words per day'),
        h('select', { id: 'new-per-day', onchange: (e: Event) => saveSettings({ newPerDay: Number((e.target as HTMLSelectElement).value) }) },
          [5, 10, 15, 20, 30].map((n) => h('option', { value: String(n), selected: n === s.newPerDay }, String(n))))),
      h('p', { class: 'muted small' }, '10 a day reaches the 1,000 words of HSK 3 in about 3½ months.'),
      h('fieldset', null, h('legend', null, 'Pinyin on the front of the card'),
        radio<PinyinMode>('pinyin', 'auto', s.pinyinOnFront, 'Until I know the word well (recommended)', (v) => saveSettings({ pinyinOnFront: v })),
        radio<PinyinMode>('pinyin', 'always', s.pinyinOnFront, 'Always', (v) => saveSettings({ pinyinOnFront: v })),
        radio<PinyinMode>('pinyin', 'never', s.pinyinOnFront, 'Never (like the HSK 3 paper)', (v) => saveSettings({ pinyinOnFront: v }))),
      h('fieldset', null, h('legend', null, 'Say the word'),
        radio<AudioMode>('audio', 'reveal', s.audio, 'When I show the answer', (v) => saveSettings({ audio: v })),
        radio<AudioMode>('audio', 'front', s.audio, 'As soon as the card appears (listening practice)', (v) => saveSettings({ audio: v })),
        radio<AudioMode>('audio', 'off', s.audio, 'Only when I tap the speaker', (v) => saveSettings({ audio: v }))),
    ),

    h('section', { class: 'panel form' },
      h('h2', null, 'Voice'),
      h('p', { class: `voice-status v-${status}` },
        status === 'ready' ? `Chinese voice ready (${voices.length} available).`
          : status === 'unsupported' ? 'This browser cannot speak. Use Chrome on Android.'
          : 'No Chinese voice found. Listening and tone quizzes need one.'),
      status !== 'ready' ? h('p', { class: 'muted small' },
        'On Android: Settings → System → Languages → Text-to-speech → Google → Install voice data → Chinese (Mandarin). Installing it also makes the voice work offline.') : null,
      voices.length > 1 ? h('label', { class: 'field', for: 'voice' }, h('span', null, 'Voice'),
        h('select', { id: 'voice', onchange: (e: Event) => saveSettings({ voiceURI: (e.target as HTMLSelectElement).value || null }) },
          h('option', { value: '' }, 'Automatic'),
          voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${v.name}${v.localService ? '' : ' (online)'}`)))) : null,
      h('label', { class: 'field', for: 'rate' }, h('span', null, 'Speed'),
        h('input', { id: 'rate', type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.speechRate),
          onchange: (e: Event) => saveSettings({ speechRate: Number((e.target as HTMLInputElement).value) }) })),
      h('button', { class: 'btn', type: 'button', onclick: () => speak('你好，我们一起学习汉语吧。', app.settings.speechRate, app.settings.voiceURI) }, 'Test: 你好，我们一起学习汉语吧'),
    ),

    h('section', { class: 'panel form' },
      h('h2', null, 'Your data'),
      h('p', null, 'Progress is saved on this phone only. ',
        persisted ? h('strong', { class: 'ok' }, 'Protected: the browser will not clear it.')
          : h('strong', { class: 'warn' }, 'Not fully protected yet.')),
      !persisted ? h('p', { class: 'muted small' }, 'The app asks for protection automatically. Chrome grants it once the app is installed on your home screen.') : null,
      install.prompt && !standalone ? h('button', { class: 'btn primary', type: 'button', onclick: async () => { await install.prompt?.(); renderMore(root); } }, 'Install app on this phone') : null,
      !standalone && !install.prompt ? h('p', { class: 'muted small' }, 'To install: open this page in Chrome, tap ⋮, then "Add to Home screen" or "Install app". Installed apps work offline and keep their data more reliably.') : null,
      usage?.usage ? h('p', { class: 'muted small' }, `Using ${(usage.usage / 1e6).toFixed(1)} MB on this device.`) : null,

      h('h3', null, 'Backup'),
      h('p', { class: 'muted small' }, 'Make a backup now and then, and before changing phones.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn', type: 'button',
          onclick: async () => {
            const json = await exportBackup();
            const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: `hsk-backup-${new Date().toISOString().slice(0, 10)}.json` });
            a.click();
            toast('Backup file saved');
          },
        }, 'Save backup file'),
        h('button', {
          class: 'btn', type: 'button',
          onclick: async () => {
            const json = await exportBackup();
            try { await navigator.clipboard.writeText(json); toast('Backup copied. Paste it somewhere safe.'); }
            catch { mount(backupBox, h('textarea', { class: 'backup-text', readonly: true, rows: 4, 'aria-label': 'Backup text' }, json)); }
          },
        }, 'Copy backup as text'),
      ),
      h('label', { class: 'btn file-btn', for: 'restore-file' }, 'Restore from file',
        h('input', { id: 'restore-file', type: 'file', accept: 'application/json,.json', class: 'sr-only',
          onchange: async (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) restoreFrom(await f.text()); } })),
      h('details', null, h('summary', null, 'Restore from pasted text'),
        h('textarea', { id: 'restore-text', class: 'backup-text', rows: 4, 'aria-label': 'Paste backup text' }),
        h('button', { class: 'btn', type: 'button', onclick: () => restoreFrom((document.getElementById('restore-text') as HTMLTextAreaElement).value) }, 'Restore')),
      backupBox,
      h('button', { class: 'btn danger-quiet', type: 'button', onclick: () => askConfirm('Delete all progress? Settings are kept. This cannot be undone without a backup.', 'Delete progress', async () => { await resetProgress(); toast('Progress deleted'); renderMore(root); }) }, 'Delete all progress'),
      confirmBox,
    ),

    h('section', { class: 'panel about' },
      h('h2', null, 'About the data'),
      h('p', null, 'Words, characters and grammar follow the HSK 3.0 exam syllabus published by Chinese Testing International in November 2025 (used for exams from 13 December 2026). Cards cover HSK 1–6.'),
      h('ul', { class: 'credits' },
        h('li', null, 'Official word list with entry numbers: uranbekanarbaev/hsk-3.0-vocabulary-dataset (syllabus content © CLEC/CTI).'),
        h('li', null, 'English meanings: CC-CEDICT (CC BY-SA 4.0), via drkameleon/complete-hsk-vocabulary (MIT).'),
        h('li', null, 'Character and grammar lists: krmanik/HSK-3.0.'),
        h('li', null, 'Scheduling: FSRS via ts-fsrs (MIT).'),
      ),
      h('p', { class: 'muted small' }, 'For personal study. Not affiliated with CTI.'),
    ),
  );
}
