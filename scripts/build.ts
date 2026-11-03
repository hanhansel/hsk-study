// Build the app.
//
//   node scripts/build.ts           build the finished app into docs/ (GitHub Pages serves this folder)
//   node scripts/build.ts --serve   build into dist/, rebuild on changes, serve on http://localhost:5173
//
// Steps: bundle src/main.ts (and its CSS) with esbuild, copy public/ and index.html,
// then write dist/sw.js with the list of files to keep offline.

import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const serve = process.argv.includes('--serve');
const OUT = serve ? 'dist' : 'docs';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** Copy static files and write the service worker. Runs after every bundle. */
function finish(): void {
  cpSync('public', OUT, { recursive: true });
  cpSync('index.html', join(OUT, 'index.html'));
  writeFileSync(join(OUT, '.nojekyll'), ''); // tells GitHub Pages to serve files as they are
  const files = listFiles(OUT).filter((f) => !f.endsWith('sw.js') && !f.endsWith('.map') && !f.endsWith('.nojekyll'));
  // The version changes whenever any file changes, so phones pick up updates.
  const hash = createHash('sha256');
  for (const f of files.sort()) hash.update(f).update(readFileSync(f));
  const version = hash.digest('hex').slice(0, 10);
  const urls = ['./', ...files.map((f) => './' + relative(OUT, f).split('\\').join('/'))];
  const sw = readFileSync('scripts/sw-template.js', 'utf8')
    .replace('__VERSION__', version)
    .replace('__FILES__', JSON.stringify(urls, null, 2));
  writeFileSync(join(OUT, 'sw.js'), sw);
  console.log(`built ${files.length} files, version ${version}`);
}

const options: esbuild.BuildOptions = {
  entryPoints: { app: 'src/main.ts' },
  bundle: true,
  format: 'esm',
  target: ['chrome100', 'safari16'],
  outdir: OUT,
  minify: !serve,
  sourcemap: serve,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [{ name: 'finish', setup: (b) => b.onEnd((r) => { if (!r.errors.length) finish(); }) }],
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: OUT, port: 5173 });
  console.log(`Open http://localhost:${port} (for phone testing use your PC's IP address)`);
} else {
  await esbuild.build(options);
}
