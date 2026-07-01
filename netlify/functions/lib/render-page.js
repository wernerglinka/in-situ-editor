/**
 * Faithful in-browser preview render.
 *
 * The whole point of this module is zero drift: it renders a draft through the
 * SAME Nunjucks templates and the SAME custom filters the Metalsmith build
 * uses, so the preview an author sees is the production render, not a
 * re-implementation. It mirrors metalsmith.js: a Nunjucks environment rooted at
 * `lib/layouts` with every filter from `nunjucks-filters/`, and the global site
 * data loaded from `lib/data/*.json` (so head/header/footer chrome renders).
 *
 * What it deliberately does NOT reproduce is the site-wide, collection-derived
 * context (the built menu, breadcrumbs, related-posts data). A single in-progress
 * draft has none of that, so those are stubbed empty and data-driven section
 * types render a labeled placeholder (see PLACEHOLDER_TYPES) — the author sees
 * where the section sits without inventing content.
 */

import fs from 'node:fs';
import path from 'node:path';

import nunjucks from 'nunjucks';
import * as nunjucksFilters from '../../../nunjucks-filters/index.js';

// Repo/deploy root. Netlify's esbuild bundler emits CJS, so import.meta.url is
// unavailable; resolve from the runtime root instead — LAMBDA_TASK_ROOT in a
// deployed function (where included_files land under lib/), else the process
// cwd (the repo root under `netlify dev` and in tests). The layout templates
// and data are shipped via netlify.toml [functions.preview] included_files.
const ROOT = process.env.LAMBDA_TASK_ROOT || process.cwd();
const LAYOUTS_DIR = path.join(ROOT, 'lib', 'layouts');
const DATA_DIR = path.join(ROOT, 'lib', 'data');
// Build artifacts (emitted by metalsmith-site-data / the pages snapshot). They
// let the preview reconstruct the site's collections so collection-driven
// sections render real content instead of a placeholder. Shipped into the
// function bundle via netlify.toml included_files.
const SITE_DATA_FILE = path.join(ROOT, 'build', 'assets', 'site-data.json');
const PAGES_FILE = path.join(ROOT, 'build', 'assets', 'pages.json');

let env;

/**
 * Build (once) the Nunjucks environment that mirrors the build's engine:
 * FileSystemLoader over lib/layouts plus every custom filter. noCache is off
 * here on purpose — templates are stable per process.
 * @return {nunjucks.Environment}
 */
function getEnv() {
  if (env) {
    return env;
  }
  env = new nunjucks.Environment(new nunjucks.FileSystemLoader(LAYOUTS_DIR), {
    autoescape: true
  });
  for (const [name, fn] of Object.entries(nunjucksFilters)) {
    if (typeof fn === 'function') {
      env.addFilter(name, fn);
    }
  }
  return env;
}

/**
 * Load the site's global data the same way the build does: every JSON file in
 * lib/data becomes a key under `data` (site.json -> data.site). Read fresh each
 * call so edits to data files show up without a restart, matching watch mode.
 * @return {Object} The `data` metadata object.
 */
function loadData() {
  const data = {};
  for (const file of fs.readdirSync(DATA_DIR)) {
    if (file.endsWith('.json')) {
      const key = file.replace('.json', '');
      data[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    }
  }
  return data;
}

/**
 * Reads and parses a build artifact, or returns null when it's missing (a site
 * that doesn't emit it, or an unbuilt tree). Never throws.
 * @param {string} file - Absolute path to the JSON artifact.
 * @return {Object|null} The parsed object, or null.
 */
function readArtifact(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The permalink a source path maps to, matching the build's permalink shape:
 * drop the .md extension and any trailing index segment (blog/hello.md ->
 * blog/hello). Templates wrap it as `/{permalink}/`.
 * @param {string} srcPath - The source path (a pages.json key).
 * @return {string} The permalink (no leading or trailing slash).
 */
function permalinkFromPath(srcPath) {
  return srcPath
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
}

/**
 * Reconstructs the `collections` render context from the build artifacts, so
 * collection-driven sections (related-posts, and any that walk collections)
 * render real members instead of a placeholder. Each collection name maps to an
 * array of member objects — the page's source frontmatter plus a derived
 * permalink — sorted newest first by card.date, mirroring the blog collection.
 * Returns {} when the artifacts aren't available, so those sections degrade to
 * empty rather than erroring.
 * @return {Object} name -> array of member objects.
 */
function loadCollections() {
  const siteData = readArtifact(SITE_DATA_FILE);
  const pages = readArtifact(PAGES_FILE);
  if (!siteData || !siteData.collections || !pages) {
    return {};
  }
  const collections = {};
  for (const [name, paths] of Object.entries(siteData.collections)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    collections[name] = paths
      .map((p) => {
        const entry = pages[p];
        if (!entry || !entry.frontmatter) {
          return null;
        }
        return { ...entry.frontmatter, permalink: permalinkFromPath(p) };
      })
      .filter(Boolean)
      .sort((a, b) => String((b.card || {}).date || '').localeCompare(String((a.card || {}).date || '')));
  }
  return collections;
}

/**
 * Render a draft's frontmatter to a full HTML page string, through the site's
 * own generic components — no editor-specific markup. The in-situ editor's
 * source-mapping attributes are injected client-side, after this renders, so the
 * library components stay generic (see the editor's preview wiring).
 *
 * @param {Object} frontmatter - The serialized draft (same object publishing
 *   commits): `sections`, `bodyClasses`, `hasHero`, etc. In content mode it
 *   carries `contents` (the Markdown body) and `bodyMode: 'content'`.
 * @return {string} The rendered HTML document.
 */
export function renderPage(frontmatter = {}) {
  const nj = getEnv();

  const isContent = frontmatter.bodyMode === 'content';
  const template = isContent ? 'pages/simple.njk' : 'pages/sections.njk';

  // Context mirrors a Metalsmith page: the frontmatter IS the context, plus the
  // global `data` and the reconstructed `collections` (so collection-driven
  // sections render real content). The remaining collection-derived bits a lone
  // draft has no position in are stubbed.
  const context = {
    ...frontmatter,
    data: loadData(),
    collections: loadCollections(),
    collection: {},
    mainMenu: [],
    navigation: { breadcrumbs: [] },
    urlPath: frontmatter.urlPath || '/',
    bodyClasses: frontmatter.bodyClasses || (isContent ? 'content-page' : 'sections-page')
  };

  return nj.render(template, context);
}
