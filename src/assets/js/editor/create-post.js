/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { ui } from './ui-elements.js';
import { drafts, createNewDraft } from '../drafts/draft-manager.js';
import { updatePreview } from './editor-logic.js';
import { handleFiles } from './image-handler.js';
import { initPasteHandler } from './paste-handler.js';
import { initTagEditor } from './tag-editor.js';
import { debounce } from '../utils/debounce.js';
import { openAndLoadDraft } from '../drafts/load-draft.js';
import { openFromSite } from '../drafts/open-from-site.js';
import { initEditorActions } from './editor-actions.js';
import { initEditor } from './editor-init.js';
import { initSectionBuilder } from './section-builder.js';
import { attachMarkdownOverlay } from './markdown-overlay.js';
import { sync, renderList, loadDraft, applyPageType, applyBodyMode } from './editor-ui.js';

/**
 * Debounced version of updatePreview to prevent excessive re-renders.
 */
const debouncedPreview = debounce((id, ui) => updatePreview(id, drafts, ui), 300);

/**
 * Synchronizes the current draft data with the UI and updates the preview.
 */
const doSync = () => sync(ui, debouncedPreview, () => renderList(ui, doLoadDraft));
window.sync = doSync;

/**
 * Loads a draft by ID and refreshes the draft list.
 * @param {string} id - The draft ID.
 */
const doLoadDraft = (id) => loadDraft(id, ui, () => renderList(ui, doLoadDraft), tagEditor);

/**
 * The tag editor component instance.
 */
const tagEditor = initTagEditor(ui, doSync);

ui.titleInput.oninput = () => {
  doSync();
  applyPageType(ui); // keep the destination hint in step with the slug
};
ui.descInput.oninput = doSync;
ui.dateInput.oninput = doSync;
if (ui.authorsSelect) {
  ui.authorsSelect.onchange = doSync;
}
for (const radio of ui.pageTypeRadios || []) {
  radio.onchange = () => {
    applyPageType(ui);
    doSync();
  };
}
if (ui.bodyModeToggle) {
  ui.bodyModeToggle.onchange = () => {
    applyBodyMode(ui);
    doSync();
  };
}
if (ui.hasHeroToggle) {
  ui.hasHeroToggle.onchange = doSync;
}
// Page meta fields all feed the same sync; the dismissible toggle is a change.
for (const el of [
  ui.socialImageInput,
  ui.canonicalUrlInput,
  ui.bodyClassesInput,
  ui.topMessageTextInput,
  ui.topMessageLinkUrlInput,
  ui.topMessageLinkLabelInput
]) {
  if (el) {
    el.oninput = doSync;
  }
}
if (ui.topMessageDismissibleToggle) {
  ui.topMessageDismissibleToggle.onchange = doSync;
}
if (ui.showInMenuToggle) {
  ui.showInMenuToggle.onchange = () => {
    applyPageType(ui); // reveal/hide the menu label + order
    doSync();
  };
  ui.navLabelInput.oninput = doSync;
  ui.navIndexInput.oninput = doSync;
}
if (ui.contentInput) {
  ui.contentInput.oninput = doSync;
  attachMarkdownOverlay(ui.contentInput, 'Page content');
}
window.addEventListener('classifier-updated', doSync);

ui.newDraftBtn.onclick = () => createNewDraft(ui, doLoadDraft, () => renderList(ui, doLoadDraft));
ui.loadDraftBtn.onclick = () => openAndLoadDraft(ui, doLoadDraft, () => renderList(ui, doLoadDraft));
if (ui.openSiteBtn) {
  ui.openSiteBtn.onclick = () => openFromSite(ui, doLoadDraft, () => renderList(ui, doLoadDraft));
}

/**
 * Collapsible side panes for distraction-free editing. Each toggle hides its
 * pane (the grid reflows the remaining columns) and remembers the choice per
 * browser so it survives reloads.
 */
function initPaneToggles() {
  const container = document.querySelector('.editor-container');
  if (!container) {
    return;
  }
  const panes = [
    { btn: document.getElementById('toggle-sidebar-btn'), cls: 'no-sidebar', key: 'editor-hide-sidebar' },
    { btn: document.getElementById('toggle-preview-btn'), cls: 'no-preview', key: 'editor-hide-preview' }
  ];
  for (const { btn, cls, key } of panes) {
    if (!btn) {
      continue;
    }
    const collapsed = localStorage.getItem(key) === 'true';
    container.classList.toggle(cls, collapsed);
    btn.setAttribute('aria-pressed', String(!collapsed));
    btn.onclick = () => {
      const nowCollapsed = !container.classList.contains(cls);
      container.classList.toggle(cls, nowCollapsed);
      btn.setAttribute('aria-pressed', String(!nowCollapsed));
      localStorage.setItem(key, String(nowCollapsed));
    };
  }
}
initPaneToggles();

initEditorActions(ui);
// Legacy body-textarea paths: only wire them if the markup still has the
// drop zone / upload button (removed when the section builder replaced
// the markdown body editor).
if (ui.dropZone && ui.contentInput) {
  initPasteHandler(ui, drafts, tagEditor, doSync);
}
if (ui.uploadBtn && ui.fileInput) {
  ui.uploadBtn.onclick = () => ui.fileInput.click();
  ui.fileInput.onchange = () =>
    handleFiles(ui.fileInput.files, localStorage.getItem('current-draft-id'), drafts, ui, doSync);
}

initSectionBuilder(ui, doSync);

initEditor(ui, doLoadDraft, () => renderList(ui, doLoadDraft), doSync, tagEditor);

export { doLoadDraft as loadDraft, renderList, doSync as sync, tagEditor };
