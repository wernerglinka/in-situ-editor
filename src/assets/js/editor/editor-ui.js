/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { drafts, updateDraftData, setCurrentDraftId } from '../drafts/draft-manager.js';
import { updatePreview } from './editor-logic.js';
import { loadSections } from './section-builder.js';
export { renderList } from './editor-list-renderer.js';

/**
 * Tracks the last synced title to avoid redundant list renders.
 */
let lastSyncedTitle = '';

/**
 * Synchronizes the UI with the draft data and updates the preview.
 * @param {Object} ui - The UI elements.
 * @param {Function} debouncedPreview - Debounced preview update function.
 * @param {Function} renderListFn - Function to render the draft list.
 */
export const sync = (ui, debouncedPreview, renderListFn) => {
  const id = localStorage.getItem('current-draft-id');
  updateDraftData(id, ui);
  debouncedPreview(id, ui);
  if (ui.titleInput.value !== lastSyncedTitle) {
    renderListFn();
    lastSyncedTitle = ui.titleInput.value;
  }
};

/**
 * Shows the fields that belong to the current page type: a post shows
 * date/authors/tags, a page shows the menu (navigation) fields. Also sets the
 * destination hint.
 * @param {Object} ui - The UI elements.
 */
export function applyPageType(ui) {
  const type = ui.getPageType ? ui.getPageType() : 'post';
  const isPage = type === 'page';
  for (const el of document.querySelectorAll('.post-only')) {
    el.hidden = isPage;
  }
  for (const el of document.querySelectorAll('.page-only')) {
    el.hidden = !isPage;
  }
  // The menu label/order only matter when the page opts into the menu.
  const navFields = document.getElementById('page-nav-fields');
  if (navFields) {
    navFields.hidden = !isPage || !(ui.showInMenuToggle && ui.showInMenuToggle.checked);
  }
  if (ui.pageTypeHint) {
    const slug = ui.getSlug(ui.titleInput.value);
    ui.pageTypeHint.textContent = isPage ? `Publishes to src/${slug}.md` : `Publishes to src/blog/${slug}.md`;
  }
}

/**
 * Populates the page-type selector and menu fields from a draft, then applies
 * the matching field visibility.
 * @param {Object} ui - The UI elements.
 * @param {Object} d - The draft.
 */
function populatePageType(ui, d) {
  if (ui.pageTypeSelect) {
    ui.pageTypeSelect.value = d.pageType === 'page' ? 'page' : 'post';
  }
  if (ui.showInMenuToggle) {
    ui.showInMenuToggle.checked = Boolean(d.showInMenu);
    ui.navLabelInput.value = d.navLabel || '';
    ui.navIndexInput.value = d.navIndex ?? '';
  }
  applyPageType(ui);
}

/**
 * Loads a draft's data into the UI.
 * @param {string} id - The draft ID to load.
 * @param {Object} ui - The UI elements.
 * @param {Function} renderList - Function to refresh the draft list.
 * @param {Object} tagEditor - The tag editor component instance.
 */
export async function loadDraft(id, ui, renderList, tagEditor) {
  const d = drafts.find((draft) => draft.id === id);
  if (!d) {
    return;
  }
  setCurrentDraftId(id);
  ui.titleInput.value = d.title || '';
  populatePageType(ui, d); // after the title, so the destination hint uses the right slug
  ui.descInput.value = d.description || '';
  ui.dateInput.value = d.date || '';
  if (ui.authorsSelect) {
    const selectedAuthors = d.authors || [];
    for (const option of ui.authorsSelect.options) {
      option.selected = selectedAuthors.includes(option.value);
    }
  }
  ui.tagsInput.value = d.tags || '';

  const content = d.content || '';
  let classifierResults = [];

  if (ui.contentInput) {
    ui.contentInput.value = content;
  }
  loadSections(d);
  ui.aiWriterInput.value = '';
  lastSyncedTitle = ui.titleInput.value;
  if (tagEditor) {
    tagEditor.renderPills();
  }

  if (window.renderClassifierResults) {
    if (d.classifierResults) {
      classifierResults = d.classifierResults;
    } else if (d.ad_categories) {
      const categories = Array.isArray(d.ad_categories) ? d.ad_categories : [ d.ad_categories ];
      const confidences = Array.isArray(d.ad_confidences) ? d.ad_confidences : [ d.ad_confidences ];
      classifierResults = categories.map((id, i) => ({
        id,
        confidence: confidences[i] ? parseFloat(confidences[i]) : null
      }));
    }
    await window.renderClassifierResults(ui, classifierResults, () =>
      sync(ui, (id, ui) => updatePreview(id, drafts, ui), renderList)
    );
  }

  if (window.restoreTranslations) {
    window.restoreTranslations(d.translations || {});
  }

  updatePreview(id, drafts, ui);
  renderList(ui, loadDraft);
}
