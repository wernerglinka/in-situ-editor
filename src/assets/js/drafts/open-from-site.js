/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { loadPages, listPages } from './pages-loader.js';
import { draftFromMetadata } from './load-draft.js';
import { drafts, saveDrafts, setCurrentDraftId } from './draft-manager.js';
import { customAlert } from '../utils/dialog-utils.js';
import { loadSchema } from '../editor/schema/schema-loader.js';

/**
 * Renders the page list into the picker dialog and resolves with the chosen
 * source path, or null if the dialog is dismissed. Posts and pages are shown
 * in two labelled groups, matching how the editor treats them on open.
 * @param {Object} ui - The UI elements.
 * @param {Array} items - The list from listPages().
 * @return {Promise<string|null>} The chosen page path, or null.
 */
function pickPage(ui, items) {
  const list = ui.openSiteList;
  list.innerHTML = '';

  const groups = [
    { type: 'post', label: 'Posts' },
    { type: 'page', label: 'Pages' }
  ];
  for (const group of groups) {
    const groupItems = items.filter((i) => i.pageType === group.type);
    if (!groupItems.length) {
      continue;
    }
    const heading = document.createElement('li');
    heading.className = 'open-site-group';
    heading.textContent = group.label;
    list.appendChild(heading);

    for (const item of groupItems) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'open-site-item';
      btn.dataset.path = item.path;
      const title = document.createElement('span');
      title.className = 'open-site-item-title';
      title.textContent = item.title;
      const meta = document.createElement('span');
      meta.className = 'open-site-item-path';
      meta.textContent = item.date ? `${item.path} · ${item.date}` : item.path;
      btn.append(title, meta);
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  return new Promise((resolve) => {
    const onClick = (e) => {
      const btn = e.target.closest('.open-site-item');
      if (!btn) {
        return;
      }
      ui.openSiteDialog.close(btn.dataset.path);
    };
    list.addEventListener('click', onClick);
    ui.openSiteDialog.addEventListener(
      'close',
      () => {
        list.removeEventListener('click', onClick);
        const val = ui.openSiteDialog.returnValue;
        resolve(val && val !== 'cancel' ? val : null);
      },
      { once: true }
    );
    ui.openSiteDialog.showModal();
  });
}

/**
 * Opens a published page from the build artifact into a new draft. Fetches
 * pages.json, shows the picker, and on selection hydrates the chosen page's
 * frontmatter through the same path as a loaded .md file. The schema is loaded
 * first so hydration can fill section defaults.
 * @param {Object} ui - The UI elements.
 * @param {Function} loadDraftFn - Function to load a draft by id.
 * @param {Function} renderListFn - Function to render the drafts list.
 * @return {Promise<void>}
 */
export async function openFromSite(ui, loadDraftFn, renderListFn) {
  try {
    await loadSchema().catch(() => {});
    const pages = await loadPages();
    const items = listPages(pages);
    if (!items.length) {
      customAlert(ui, 'No published pages found in the site artifact.');
      return;
    }

    const path = await pickPage(ui, items);
    if (!path) {
      return;
    }

    const entry = pages[path];
    const id = Date.now().toString();
    const newDraft = draftFromMetadata(entry.frontmatter, entry.content || '', id);
    // Remember where the page came from so the slug/destination round-trips.
    newDraft.sourcePath = path;
    drafts.unshift(newDraft);
    setCurrentDraftId(id);
    saveDrafts();
    await loadDraftFn(id);
    renderListFn();
  } catch (err) {
    console.error(err);
    customAlert(ui, 'Failed to load pages from the site.', err.message || String(err));
  }
}
