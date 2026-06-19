/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Loads the build artifact `pages.json` and caches it. The artifact is a
 * snapshot of every published page's source frontmatter (from the
 * metalsmith-site-data package), emitted at build time so the editor can
 * browse and open existing pages with a static fetch and no GitHub access.
 * It reflects the last deploy: draft pages and unmerged PRs are not in it.
 */

const PAGES_URL = '/assets/pages.json';

let pagesPromise = null;

/**
 * Fetches and caches the pages artifact. Safe to call repeatedly; the network
 * request happens once. Resolves to the raw map of sourcePath ->
 * { frontmatter, content }.
 * @return {Promise<Object>} The pages map.
 */
export function loadPages() {
  if (!pagesPromise) {
    pagesPromise = fetch(PAGES_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`pages fetch failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((err) => {
        // Reset so a later call can retry rather than caching the failure.
        pagesPromise = null;
        throw err;
      });
  }
  return pagesPromise;
}

/**
 * Derives a flat, display-ready list from the pages map: one entry per page
 * with the bits the picker shows (a title, the source path, the inferred page
 * type, and a sort date). The page type mirrors the editor's own inference
 * (a `card` block means a post), so the list groups the same way the editor
 * treats the page on open. Posts sort newest first, then pages alphabetically.
 * @param {Object} pages - The raw pages map from loadPages().
 * @return {Array<{path: string, title: string, pageType: string, date: string}>}
 */
export function listPages(pages) {
  return Object.entries(pages || {})
    .map(([path, entry]) => {
      const fm = (entry && entry.frontmatter) || {};
      const card = fm.card || {};
      const seo = fm.seo || {};
      const isPost = Boolean(card.title || card.date || Array.isArray(fm.tags));
      return {
        path,
        title: card.title || seo.title || fm.title || path,
        pageType: isPost ? 'post' : 'page',
        date: card.date || fm.date || ''
      };
    })
    .sort((a, b) => {
      if (a.pageType !== b.pageType) {
        return a.pageType === 'post' ? -1 : 1;
      }
      if (a.pageType === 'post') {
        return String(b.date).localeCompare(String(a.date));
      }
      return a.title.localeCompare(b.title);
    });
}
