# HSK Study

A simple study app for the **new HSK 3.0 exam** (November 2025 syllabus, HSK 1–6) that you install on your Android phone like a normal app.

- **今天 Today:** daily flashcards. The app decides which words you need to review.
- **练习 Practice:** quick quizzes on meaning, characters, pinyin, listening and tones, plus an experimental **Writing** quiz where you draw characters with your finger.
- **词汇 Words:** all 5,375 words. Search by 汉字, pinyin or English.
- **阅读 Reader:** paste any Chinese text and see which words are at your level.
- **设置 More:** settings, voice test and backups.

**Your progress is saved automatically on your phone** after every answer. It works without internet after the first time you open it.

---

## Put it on your phone (once, about 10 minutes)

The `docs/` folder is the **finished app**, ready to go. GitHub just needs to show it as a website.

1. **Upload** this `hsk-app` folder to a new GitHub repository, for example `hsk-study`.
2. On GitHub, go to **Settings → Pages**. Under **Branch**, choose **main** and the **/docs** folder, then press **Save**.
3. Wait about a minute. GitHub shows your link: `https://<your-username>.github.io/hsk-study/`
4. Open that link in **Chrome on your phone**, tap **⋮**, then **Install app** (or **Add to Home screen**).

The 学 icon now appears on your home screen. Open it like any app, anywhere, with or without internet.

**For listening and tones:** if the More tab says "No Chinese voice found", go to Android **Settings → System → Languages → Text-to-speech → Google → Install voice data → Chinese (Mandarin)**.

### About your saved progress

- It is saved on **this phone**, inside the installed app. Closing the app or restarting the phone doesn't lose it.
- Uninstalling the app or clearing Chrome's data for the site **does** delete it. Use **More → Save backup file** now and then, and to move to a new phone.
- Progress does not sync between devices. Opening the link on a laptop starts fresh there.

### Updating the app later

Replace the files in the repository with the new version. The phone picks up the update the next time you open the app (sometimes it takes a second reopen).

---

## For developers: changing the code

Requires [Node.js](https://nodejs.org) 22.18 or newer.

```bash
npm install
npm run dev        # try it at http://localhost:5173 while editing
npm test           # tests
npm run build      # rebuilds the finished app into docs/ (commit this folder)
```

| File | Purpose |
|---|---|
| `src/types.ts` | Data shapes: word, card, review, settings. Start here. |
| `src/queue.ts`, `src/srs.ts` | Which cards are due; scheduling (FSRS, via ts-fsrs). |
| `src/quiz.ts`, `src/pinyin.ts` | Quiz questions and pinyin helpers. |
| `src/writing.ts`, `src/ui/writing.ts` | The Writing quiz (Hanzi Writer). |
| `src/reader.ts` | Splits text into HSK words. |
| `src/db.ts`, `src/store.ts` | Saving progress on the phone, backup/restore. |
| `src/ui/*.ts` | One file per screen. |
| `src/styles.css` | Look and colours (light and dark). |
| `scripts/build-data.ts` | Builds the word data (see `notes/DATA_REPORT.md`). |

**Data sources:**
- Official HSK 3.0 word list with entry numbers: uranbekanarbaev/hsk-3.0-vocabulary-dataset. Syllabus content © CLEC/CTI.
- English meanings: CC-CEDICT (CC BY-SA 4.0), via drkameleon/complete-hsk-vocabulary (MIT).
- Character and grammar lists: krmanik/HSK-3.0.
- Stroke data: hanzi-writer-data (Arphic Public License).
- Libraries: Hanzi Writer (MIT) and ts-fsrs (MIT).

This app is for personal study and is not affiliated with CTI. Plans for later are in `notes/ROADMAP.md`.
