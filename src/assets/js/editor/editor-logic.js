/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { generateMarkdown } from '../utils/markdown-utils.js';

/**
 * Updates the preview pane. Until an in-browser Nunjucks renderer lands,
 * this shows the emitted structured-frontmatter document so the author
 * sees exactly what publishing will commit.
 * @param {string} currentId - The ID of the current draft.
 * @param {Object[]} drafts - The list of all drafts.
 * @param {Object} ui - The UI elements.
 * @return {Promise<void>}
 */
export async function updatePreview(currentId, drafts, ui) {
  const draft = drafts.find((d) => d.id === currentId);
  if (!draft) {
    return;
  }
  const classifierResults = window.getSelectedClassifierResults ? window.getSelectedClassifierResults() : [];
  const md = generateMarkdown(
    draft,
    ui.titleInput.value,
    ui.descInput.value,
    ui.dateInput.value,
    ui.tagsInput.value,
    ui.contentInput ? ui.contentInput.value : '',
    classifierResults
  );

  const pre = document.createElement('pre');
  pre.className = 'frontmatter-preview';
  pre.textContent = md;
  ui.previewContent.replaceChildren(pre);
}

export { wrapText } from '../utils/text-utils.js';
