// Phase 1 data pipeline.
//
// Builds the app's data files in public/data/ from three open sources:
//   1. The official HSK 3.0 (Nov 2025 syllabus) word list with entry numbers
//      -> uranbekanarbaev/hsk-3.0-vocabulary-dataset   (data/hsk-3.0-all.json)
//   2. English meanings, measure words, radicals and frequency
//      -> drkameleon/complete-hsk-vocabulary            (complete.json, CC-CEDICT meanings)
//   3. Character lists (read / write) and the official grammar points
//      -> krmanik/HSK-3.0                               ("New HSK (2025)" folder)
//
// The official list is the "master": every app word is one official entry, so
// per-level progress is measured against the real syllabus.
//
// Usage (Node 22.18+ runs .ts files directly):
//   node scripts/build-data.ts --official <path> --dict <path> --krmanik <path> --strokes <path>
// (--strokes = folder of chanind/hanzi-writer-data, for the Writing quiz)
// See README.md ("Rebuilding the data") for the exact commits used.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { segmentPinyin, stripTones, numericToMarked } from '../src/pinyin.ts';

// ---------- command line ----------
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || !args[i + 1]) throw new Error(`Missing --${name} <path>`);
  return args[i + 1];
};
const OFFICIAL = arg('official'); // folder of uranbekanarbaev/hsk-3.0-vocabulary-dataset
const DICT = arg('dict');         // folder of drkameleon/complete-hsk-vocabulary
const KRMANIK = arg('krmanik');   // folder of krmanik/HSK-3.0
const STROKES = arg('strokes');   // folder of chanind/hanzi-writer-data
const OUT = 'public/data';
const MAX_LEVEL = 6;              // levels 7–9 are left out for now (see notes/ROADMAP.md)

// ---------- source shapes ----------
type OfficialEntry = {
  id: number; level: string; hanzi: string; pinyin: string;
  part_of_speech: string; entry: string; homograph: number | null;
};
type DictForm = {
  traditional: string;
  transcriptions: { pinyin: string; numeric: string };
  meanings: string[]; classifiers: string[];
};
type DictEntry = { simplified: string; radical: string; frequency: number; pos: string[]; forms: DictForm[] };

/** One word as the app sees it (public/data/words.json). */
export type Word = {
  id: number;            // official entry number (first one, if merged)
  hanzi: string;
  pinyin: string;        // official pinyin with tone marks (as printed in the syllabus)
  numeric: string;       // same pinyin as tone numbers, e.g. "ai4 hao4"
  level: number;         // 1–6
  pos: string;           // official part of speech, e.g. "动、名"
  meanings: string[];    // English, from CC-CEDICT (cleaned)
  classifiers: string[]; // measure words, e.g. ["个"]
  freq: number | null;   // frequency rank (lower = more common); null if unknown
  radical: string;
  extraIds?: number[];   // other official entries merged into this one (same hanzi + pinyin)
};

const official: OfficialEntry[] = JSON.parse(readFileSync(join(OFFICIAL, 'data/hsk-3.0-all.json'), 'utf8'));
const dict: DictEntry[] = JSON.parse(readFileSync(join(DICT, 'complete.json'), 'utf8'));
const dictByHanzi = new Map(dict.map((d) => [d.simplified, d]));

// Valid plain syllables, learned from every numeric transcription in the dictionary.
const SYLLABLES = new Set<string>();
for (const d of dict) for (const f of d.forms) {
  for (const p of f.transcriptions.numeric.toLowerCase().split(/\s+/)) {
    const m = p.match(/^([a-zü]+)[1-5]$/);
    if (m && m[1] !== 'r') SYLLABLES.add(m[1]);
  }
}
// Vowel-less interjections like 嗯 ǹg are only allowed for one-character words,
// otherwise "nǎr" could be split as "n + ǎ + r".
const SYLLABLES_1CHAR = new Set([...SYLLABLES, 'n', 'ng', 'm', 'hm', 'hng']);

// ---------- helpers ----------
const report: string[] = [];
const problems = { noDictEntry: [] as string[], looseMeaning: [] as string[], noNumeric: [] as string[] };

/** Meanings that are noise for a learner. */
const DROP = [
  /^(erhua |old |archaic |japanese )?variant of/i, /^also pr\./i, /^also written/i,
  /^surname /i, /^see [^\s]+$/i, /^see also/i, /^\(Tw\)/, /^Taiwan pr\./i, /^used in [^\s]+$/i,
];
function cleanMeanings(list: string[]): string[] {
  const kept = list.map((m) => m.trim()).filter((m) => m && !DROP.some((re) => re.test(m)));
  return [...new Set(kept)].slice(0, 5);
}

/** How well a dictionary form matches the official pinyin (higher is better). */
function formScore(officialPinyin: string, form: DictForm): number {
  const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s’'\-·]/g, '');
  const a = norm(officialPinyin), b = norm(form.transcriptions.pinyin);
  if (a === b) return 3;
  if (stripTones(a) === stripTones(b)) return 2; // same sounds, tones differ (e.g. 一/不 tone changes)
  return 0;
}

/** "量、（名）" -> "量、名" (brackets mark a secondary use; we keep it, deduplicated). */
const cleanPos = (pos: string) => [...new Set(pos.replace(/[（）()]/g, '').split('、').map((p) => p.trim()).filter(Boolean))].join('、');

/** Hand-written meanings for the few entries where the dictionaries give nothing useful. */
const OVERRIDES: Record<string, string[]> = {
  '下功夫': ['to put in time and energy', "to concentrate one's efforts"],
  '纪录': ['record (e.g. a sports record)', 'to record'],
  '血|xiě': ['blood (colloquial reading of xuè)'],
};

const cjkCount = (s: string) => [...s].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;

// Full CC-CEDICT (as JSON, shipped in krmanik/HSK-3.0), used only as a fallback.
type CedictEntry = { simplified: string; pinyin: string[]; definitions: Record<string, string> };
const cedict: Record<string, CedictEntry> = JSON.parse(
  readFileSync(join(KRMANIK, 'Scripts and data/all_cedict.json'), 'utf8'),
);
/** Compare readings loosely: "yi2 xia4" ~ "yi1 xia4" (tone changes), "lü" ~ "lu:". */
const looseReading = (s: string) => s.toLowerCase().replace(/u:/g, 'ü').replace(/[1-5]/g, '').replace(/\s+r$/, '').replace(/\s+/g, ' ').trim();
function cedictLookup(hanzi: string, numeric: string): { meanings: string[]; classifiers: string[] } | null {
  const entry = cedict[hanzi] ?? cedict[hanzi.replace(/儿$/, '')];
  if (!entry) return null;
  const readings = Object.keys(entry.definitions);
  // Prefer lowercase readings: "Chi2" (capital) is the surname entry, "chi2" the word.
  readings.sort((a, b) => Number(a[0] !== a[0].toLowerCase()) - Number(b[0] !== b[0].toLowerCase()));
  const pick =
    readings.find((r) => r.toLowerCase().replace(/u:/g, 'ü') === numeric) ??
    readings.find((r) => looseReading(r) === looseReading(numeric)) ??
    (numeric ? null : readings[0]);
  if (!pick) return null;
  const parts = entry.definitions[pick].split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  const classifiers: string[] = [];
  const meanings: string[] = [];
  for (const p of parts) {
    const cl = p.match(/^CL:(.+)$/);
    if (cl) classifiers.push(...cl[1].split(',').map((c) => c.replace(/\[.*?\]/, '').split('|').pop()!.trim()));
    else meanings.push(p);
  }
  return { meanings: cleanMeanings(meanings), classifiers: [...new Set(classifiers)] };
}

// ---------- build words ----------
const words: Word[] = [];
const byKey = new Map<string, Word>();

for (const e of official) {
  if (e.level === '7-9' || Number(e.level) > MAX_LEVEL) continue;
  const level = Number(e.level);
  const pinyin = e.pinyin.split('/')[0].trim(); // "shéi/shuí" -> "shéi"
  const key = `${e.hanzi}|${pinyin}`;

  // Same hanzi + same pinyin listed twice (different senses) -> one card.
  const existing = byKey.get(key);
  if (existing) {
    (existing.extraIds ??= []).push(e.id);
    existing.pos = cleanPos(`${existing.pos}、${e.part_of_speech}`);
    continue;
  }

  // Tone numbers from the official pinyin.
  const chars = cjkCount(e.hanzi);
  // Erhua words (哪儿 nǎr) have one syllable fewer than characters: try that first,
  // then the normal count (女儿 nǚ'ér really has two syllables).
  const valid = chars === 1 ? SYLLABLES_1CHAR : SYLLABLES;
  const numeric = (e.hanzi.includes('儿') ? segmentPinyin(pinyin, chars - 1, valid) : null)
    ?? segmentPinyin(pinyin, chars, valid)
    ?? '';
  if (!numeric) problems.noNumeric.push(`${e.id} ${e.hanzi} ${pinyin}`);

  // Look up meanings. Try the word itself, then without a final 儿 (哪儿 -> 哪).
  const d = dictByHanzi.get(e.hanzi) ?? dictByHanzi.get(e.hanzi.replace(/儿$/, ''));
  let meanings: string[] = [], classifiers: string[] = [];
  let bestScore = -1;
  if (d) {
    const scored = d.forms.map((f) => ({ f, s: formScore(pinyin, f) })).sort((x, y) => y.s - x.s);
    bestScore = scored[0].s;
    // Merge meanings of all forms that match equally well (e.g. traditional variants).
    const good = scored.filter((x) => x.s === bestScore).map((x) => x.f);
    meanings = cleanMeanings(good.flatMap((f) => f.meanings));
    classifiers = [...new Set(good.flatMap((f) => f.classifiers))];
    if (!meanings.length) meanings = cleanMeanings(d.forms.flatMap((f) => f.meanings));
  }
  // Fallback: the full CC-CEDICT dictionary, for words the HSK dataset lacks
  // (e.g. 你好, 一下) or where its reading doesn't match the official pinyin.
  if (!d || bestScore === 0 || !meanings.length) {
    const fb = cedictLookup(e.hanzi, numeric);
    if (fb?.meanings.length) { meanings = fb.meanings; classifiers = fb.classifiers.length ? fb.classifiers : classifiers; }
    else if (!d) problems.noDictEntry.push(`${e.id} ${e.hanzi} ${pinyin}`);
    else if (bestScore === 0) problems.looseMeaning.push(`${e.id} ${e.hanzi} ${pinyin} (dict: ${d.forms.map((f) => f.transcriptions.pinyin).join(' / ')})`);
  }
  // Last resort: keep the raw dictionary text, unfiltered (e.g. 血 xiě = "colloquial pr. of 血 xuè").
  if (!meanings.length && d) meanings = d.forms.flatMap((f) => f.meanings).slice(0, 3);
  const override = OVERRIDES[`${e.hanzi}|${pinyin}`] ?? OVERRIDES[e.hanzi];
  if (override) meanings = override;
  if (!meanings.length) problems.noDictEntry.push(`${e.id} ${e.hanzi} ${pinyin} (empty)`);

  const w: Word = {
    id: e.id, hanzi: e.hanzi, pinyin, numeric, level,
    pos: cleanPos(e.part_of_speech),
    meanings, classifiers,
    freq: d && d.frequency < 1_000_000 ? d.frequency : null, // 1,000,000 = "unknown" in the source
    radical: d?.radical ?? '',
  };
  byKey.set(key, w);
  words.push(w);
}

// Sanity check: numeric -> marked should give back the official pinyin.
let roundTripMismatch = 0;
for (const w of words) {
  if (!w.numeric) continue;
  const back = numericToMarked(w.numeric).replace(/’/g, '');
  if (back !== w.pinyin.toLowerCase().replace(/[’'\-\s]/g, '')) roundTripMismatch++;
}

// ---------- characters and grammar ----------
const K = join(KRMANIK, 'New HSK (2025)');
const readList = (file: string) => readFileSync(join(K, file), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const chars: Record<string, { read: string[]; write: string[] }> = {};
for (let l = 1; l <= MAX_LEVEL; l++) {
  chars[l] = { read: readList(`HSK Hanzi/HSK_Level_${l}_hanzi.txt`), write: [] };
}
chars[2].write = readList('HSK Handwritten/HSK_Level_1-2_handwritten.txt'); // official list covers 1–2 together
for (let l = 3; l <= MAX_LEVEL; l++) chars[l].write = readList(`HSK Handwritten/HSK_Level_${l}_handwritten.txt`);

type GrammarRaw = { 类别: string; 类别名称: string; 细目: string; 语法内容: string };
const grammar: Record<string, { category: string; name: string; detail: string; content: string }[]> = {};
for (let l = 1; l <= MAX_LEVEL; l++) {
  const raw: GrammarRaw[] = JSON.parse(readFileSync(join(K, `HSK Grammar/json/HSK ${l}.json`), 'utf8'));
  grammar[l] = raw.map((g) => ({ category: g.类别, name: g.类别名称, detail: g.细目, content: g.语法内容 }));
}

// ---------- write ----------
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'words.json'), JSON.stringify(words));
writeFileSync(join(OUT, 'chars.json'), JSON.stringify(chars));
writeFileSync(join(OUT, 'grammar.json'), JSON.stringify(grammar));

// Stroke data for the characters you must be able to write (Writing quiz, Hanzi Writer).
const strokes: Record<string, unknown> = {};
for (let l = 1; l <= MAX_LEVEL; l++) {
  for (const ch of chars[l].write) strokes[ch] = JSON.parse(readFileSync(join(STROKES, 'data', `${ch}.json`), 'utf8'));
}
writeFileSync(join(OUT, 'strokes.json'), JSON.stringify(strokes));

// ---------- report ----------
const officialPerLevel: Record<number, number> = {};
for (const e of official) if (e.level !== '7-9') officialPerLevel[+e.level] = (officialPerLevel[+e.level] ?? 0) + 1;
let cumOfficial = 0, cumCards = 0, cumRead = 0, cumWrite = 0;
report.push('# Data build report', '', `Generated: ${new Date().toISOString().slice(0, 10)}`, '');
report.push('| Level | Official entries (cum.) | App cards (cum.) | Read chars (cum.) | Write chars (cum.) | Grammar points |', '|---|---|---|---|---|---|');
for (let l = 1; l <= MAX_LEVEL; l++) {
  cumOfficial += officialPerLevel[l];
  cumCards += words.filter((w) => w.level === l).length;
  cumRead += chars[l].read.length;
  cumWrite += chars[l].write.length;
  report.push(`| ${l} | ${officialPerLevel[l]} (${cumOfficial}) | ${words.filter((w) => w.level === l).length} (${cumCards}) | ${chars[l].read.length} (${cumRead}) | ${chars[l].write.length} (${cumWrite}) | ${grammar[l].length} |`);
}
report.push('', `Valid syllables known: ${SYLLABLES.size}`);
report.push(`Merged duplicate senses (same hanzi + pinyin): ${words.reduce((n, w) => n + (w.extraIds?.length ?? 0), 0)}`);
report.push(`Pinyin round-trip mismatches: ${roundTripMismatch}`);
report.push(`Words with no frequency rank: ${words.filter((w) => w.freq === null).length}`);
report.push('', `## No dictionary entry (${problems.noDictEntry.length}) — these have no English meaning yet`, ...problems.noDictEntry.map((s) => `- ${s}`));
report.push('', `## Pinyin differs from dictionary (${problems.looseMeaning.length}) — meaning may be for another reading`, ...problems.looseMeaning.map((s) => `- ${s}`));
report.push('', `## Could not split pinyin into syllables (${problems.noNumeric.length})`, ...problems.noNumeric.map((s) => `- ${s}`));
writeFileSync('notes/DATA_REPORT.md', report.join('\n') + '\n');

console.log(`words: ${words.length}, no meaning: ${problems.noDictEntry.length}, loose: ${problems.looseMeaning.length}, no numeric: ${problems.noNumeric.length}, round-trip mismatches: ${roundTripMismatch}`);
