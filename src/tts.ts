// Speaking Chinese with the phone's built-in text-to-speech (Web Speech API).
//
// On Android, Chrome uses the system voice (usually Google). To work offline,
// install the Chinese voice: Android Settings → Text-to-speech → Google →
// Install voice data → Chinese (Mandarin). The More tab has a test button.

let voices: SpeechSynthesisVoice[] = [];

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Load the voice list. Chrome fills it in a moment after page load. */
export function initSpeech(): Promise<void> {
  if (!supported()) return Promise.resolve();
  return new Promise((resolve) => {
    const read = () => { voices = speechSynthesis.getVoices(); };
    read();
    if (voices.length) return resolve();
    speechSynthesis.addEventListener('voiceschanged', () => { read(); resolve(); }, { once: true });
    setTimeout(() => { read(); resolve(); }, 1500); // some browsers never fire the event
  });
}

/** Voices that speak Mandarin (zh-CN first). */
export function chineseVoices(): SpeechSynthesisVoice[] {
  const zh = voices.filter((v) => /^(zh|cmn)/i.test(v.lang) && !/HK|yue/i.test(v.lang));
  return zh.sort((a, b) => Number(/CN|Hans/i.test(b.lang)) - Number(/CN|Hans/i.test(a.lang)));
}

export type SpeechStatus = 'ready' | 'no-chinese-voice' | 'unsupported';

export function speechStatus(): SpeechStatus {
  if (!supported()) return 'unsupported';
  return chineseVoices().length ? 'ready' : 'no-chinese-voice';
}

/** Say `text` in Mandarin. Resolves when finished (or after a timeout). */
export function speak(text: string, rate = 0.85, voiceURI: string | null = null): Promise<void> {
  if (!supported()) return Promise.resolve();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; // Chrome on Android needs this even when a voice is chosen
  u.rate = rate;
  const list = chineseVoices();
  const voice = list.find((v) => v.voiceURI === voiceURI) ?? list[0];
  if (voice) u.voice = voice;
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    setTimeout(resolve, 4000 + text.length * 400);
    speechSynthesis.speak(u);
  });
}
