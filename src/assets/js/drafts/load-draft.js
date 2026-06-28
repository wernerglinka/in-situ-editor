/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { fileOpen } from 'browser-fs-access';
import { parseFrontmatter } from '../editor/frontmatter-parser.js';
import { drafts, saveDrafts, setCurrentDraftId } from './draft-manager.js';
import { saveImage } from '../utils/db-storage.js';
import { customAlert } from '../utils/dialog-utils.js';
import { loadSchema, getSectionFields } from '../editor/schema/schema-loader.js';
import { hydrateSections } from '../editor/schema/hydrate.js';

/** Top-level frontmatter keys the editor manages; everything else is kept in
 * `draft.extra` so an edited page round-trips its unknown keys unchanged. */
const MANAGED_KEYS = new Set([
  'layout', 'draft', 'bodyClass', 'bodyClasses', 'hasHero', 'topMessage', 'seo', 'card', 'tags',
  'ad_categories', 'ad_confidences', 'navigation', 'sections'
]);

/**
 * Builds a draft from a page's parsed frontmatter. Structured-content pages
 * carry the title/description/date in nested `seo`/`card` blocks rather than
 * top-level keys, and their content lives in the `sections` array, which is
 * hydrated back into editor sections. The page type is inferred from the
 * presence of a `card` block (posts have one; pages don't), navigation is
 * read back into the menu fields, and any unmanaged top-level key is stashed
 * in `extra`. The schema must be loaded first.
 * @param {Object} metadata - The parsed frontmatter.
 * @param {string} content - The markdown body (legacy fallback).
 * @param {string} id - The new draft id.
 * @return {Object} The draft object.
 */
function navFields(nav) {
  return {
    showInMenu: Boolean(nav),
    navLabel: nav ? nav.navLabel || '' : '',
    navIndex: nav ? nav.navIndex ?? '' : ''
  };
}

/** Spreads a `topMessage` block back into the draft's flat editor fields. */
function topMessageFields(tm) {
  const m = tm || {};
  const link = m.link || {};
  return {
    topMessageText: m.text || '',
    topMessageLinkUrl: link.url || '',
    topMessageLinkLabel: link.label || '',
    topMessageDismissible: m.dismissible !== false
  };
}

export function draftFromMetadata(metadata, content, id) {
  const m = metadata || {};
  const card = m.card || {};
  const seo = m.seo || {};
  const pageType = card.title || card.date || Array.isArray(m.tags) ? 'post' : 'page';
  // A page is content-bodied when it renders with the simple layout, or (as a
  // fallback for hand-authored files) when it has a body and no sections.
  const bodyMode =
    m.layout === 'pages/simple.njk' || (!Array.isArray(m.sections) && Boolean(content && content.trim()))
      ? 'content'
      : 'sections';
  const extra = Object.fromEntries(Object.entries(m).filter(([ k ]) => !MANAGED_KEYS.has(k)));
  return {
    id,
    pageType,
    bodyMode,
    title: card.title || seo.title || m.title || '',
    description: seo.description || m.description || '',
    date: card.date || m.date || '',
    // Page meta fields. socialImage is the single source for both the social
    // image and (for posts) the card thumbnail; bodyClasses and the top message
    // round-trip through their own fields now rather than the `extra` bag.
    socialImage: seo.socialImage || card.thumbnail || '',
    canonicalUrl: seo.canonicalURL || '',
    bodyClasses: m.bodyClasses || '',
    hasHero: m.hasHero === true,
    ...topMessageFields(m.topMessage),
    tags: Array.isArray(m.tags) ? m.tags.join(', ') : m.tags || '',
    authors: Array.isArray(card.author) ? card.author : [],
    ...navFields(m.navigation || null),
    ad_categories: m.ad_categories,
    ad_confidences: m.ad_confidences,
    extra,
    sections: hydrateSections(m.sections, getSectionFields),
    content: content || '',
    imageFiles: [],
    lastModified: Date.now()
  };
}

/**
 * Opens a file picker to load a draft from a .md or .zip file.
 * @param {Object} ui - The UI elements.
 * @param {Function} loadDraftFn - Function to load a draft.
 * @param {Function} renderListFn - Function to render the drafts list.
 * @return {Promise<void>}
 */
export async function openAndLoadDraft(ui, loadDraftFn, renderListFn) {
  try {
    const blob = await fileOpen({
      mimeTypes: ['text/markdown', 'application/zip'],
      extensions: ['.md', '.zip'],
      description: 'Blog Drafts',
    });
    await handleLoadDraft(blob, ui, loadDraftFn, renderListFn);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      customAlert(ui, 'Failed to open file.');
    }
  }
}

/**
 * Internal handler for loading a draft from a File/Blob.
 * @param {File|Blob} file - The draft file.
 * @param {Object} ui - The UI elements.
 * @param {Function} loadDraftFn - Function to load a draft.
 * @param {Function} renderListFn - Function to render the drafts list.
 */
async function handleLoadDraft(file, ui, loadDraftFn, renderListFn) {
  // Hydration fills section defaults from the schema, so make sure it is
  // loaded before building the draft.
  await loadSchema().catch(() => {});

  if (file.name.endsWith('.md')) {
    const text = await file.text();
    const { metadata, content } = parseFrontmatter(text);
    const id = Date.now().toString();
    const newDraft = draftFromMetadata(metadata, content, id);
    drafts.unshift(newDraft);
    setCurrentDraftId(id);
    saveDrafts();
    await loadDraftFn(id);
    renderListFn();
  } else if (file.name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const mdFile = Object.values(zip.files).find((f) => f.name.endsWith('.md'));
    if (!mdFile) {
      customAlert(ui, 'No .md file found in the ZIP archive.');
      return;
    }

    const text = await mdFile.async('text');
    const { metadata, content } = parseFrontmatter(text);
    const id = Date.now().toString();
    const newDraft = draftFromMetadata(metadata, content, id);

    // Extract images
    for (const [filename, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir || filename === mdFile.name) {
        continue;
      }

      // Basic image extension check
      if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(filename)) {
        const buffer = await zipEntry.async('arrayBuffer');
        const simpleName = filename.split('/').pop();
        const imageId = `${id}:${Date.now()}:${simpleName}`;
        const type =
          `image/${simpleName.split('.').pop().toLowerCase()}`.replace(
            'jpg',
            'jpeg',
          );

        await saveImage(imageId, buffer);
        newDraft.imageFiles.push({ name: simpleName, id: imageId, type });
      }
    }

    drafts.unshift(newDraft);
    setCurrentDraftId(id);
    saveDrafts();
    await loadDraftFn(id);
    renderListFn();
  }
}
