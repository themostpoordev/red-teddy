import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Multi-page build.
 *
 * Each page is a separate HTML entry rather than one bundle with a client-side
 * router, for one reason: the menu is 2D and would otherwise drag the whole
 * renderer down with it. The menu ships a few KB of its own and no three.js at
 * all; the teddy page ships the renderer.
 *
 * `base: "./"` makes every emitted asset reference RELATIVE to the page that
 * uses it, so `dist/` can be served from any path — the site root today,
 * `/teddy/` tomorrow, or a subdirectory on someone else's server — without
 * touching this file or rebuilding. The alternative, absolute `/assets/...`
 * paths, silently break the moment a page moves below the root, and the
 * symptom is a blank page with a 404 in the console rather than an obvious
 * error at build time.
 *
 * Adding a character is a new directory under `pages/` with an index.html and
 * an entry script, plus one line in PAGES below. Nothing else changes — each
 * page bundles only what it imports, so a page built without three.js never
 * downloads it.
 *
 * `root: "pages"` is what makes the output paths come out right. Vite computes
 * an HTML entry's destination from its path RELATIVE TO THE ROOT, so with the
 * root at the repository root, an entry at `pages/teddy/index.html` would be
 * emitted to `dist/pages/teddy/index.html` and served at the wrong URL — the
 * URL of a page is the path it has inside `dist`, not the path it happens to
 * have in the source tree.
 *
 * Moving the root up to `pages/` makes those two the same thing:
 *
 *   pages/index.html        ->  dist/index.html        ->  /
 *   pages/teddy/index.html  ->  dist/teddy/index.html  ->  /teddy/
 *
 * `base: "./"` then makes each page reference its assets relatively, so
 * `dist/` can be served from any path on any host without a rebuild.
 */
const PAGES = {
  // Absolute paths, and they still come out right: Vite rebases each entry
  // against `root` before computing its output directory, so an entry at
  // <project>/pages/teddy/index.html with root "pages" is emitted to
  // dist/teddy/index.html. A bare relative path does not work — Rollup
  // resolves those against the process CWD, not against the root, and fails
  // to find the file.
  index: resolve(import.meta.dirname, "pages/index.html"),
  teddy: resolve(import.meta.dirname, "pages/teddy/index.html"),
};

export default defineConfig({
  // See the note above: this is what makes `pages/teddy/` land at `/teddy/`.
  root: "pages",

  // Relative asset URLs, so the built output is portable across deployment
  // paths. See the note above.
  base: "./",

  build: {
    // outDir is resolved relative to `root`, so the default would put the
    // bundle in pages/dist — inside the source tree and one level above where
    // it belongs. This points it back at the project's own dist/, which is
    // where the deploy script already expects it.
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,

    target: "es2022",
    rollupOptions: {
      input: PAGES,

      output: {
        // three is stable across releases, so it never needs a re-download.
        // Splitting it out also keeps it out of the entry chunk's gzip window,
        // which means a style-only rebuild of the teddy scene re-downloads a
        // few KB instead of the whole renderer.
        //
        // Manual chunks apply per-entry in a multi-page build, and since only
        // the teddy page imports three, the menu never receives the chunk.
        manualChunks: (id) =>
          id.includes("node_modules/three") ? "three" : undefined,
      },
    },
    assetsInlineLimit: 2048,
  },
});
