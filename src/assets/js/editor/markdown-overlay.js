/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Markdown overlay editor.
 *
 * A single EasyMDE instance lives inside the #markdown-editor-dialog <dialog>
 * and is reused for every Markdown field. Field controls stay plain textareas;
 * an "Expand" button opens this overlay for distraction-free editing with a
 * toolbar and live preview. The overlay only ever edits a string: it resolves
 * with the new value on Save (or null on Cancel/Escape), and the caller writes
 * that back to its textarea. So the overlay knows nothing about drafts,
 * sections, or obj[key] — the existing field wiring does the commit.
 *
 * EasyMDE wraps CodeMirror 5, which measures its layout on init. Because the
 * dialog is hidden when the instance is created, we refresh() after showModal()
 * reveals it, or the editor renders with zero height and a misplaced cursor.
 */

let editor = null; // the one EasyMDE instance, created on first open
let dialog = null; // the <dialog> element
let titleEl = null;
let resolveOpen = null; // resolver for the in-flight open() promise
let pendingResult = null; // value to resolve with when the dialog closes

/**
 * Toolbar icons, lifted verbatim from the site's Feather set in
 * lib/layouts/icons/ so the overlay matches the rest of the admin. EasyMDE sets
 * a button's innerHTML from its `icon` property; CSS sizes the SVG (see
 * admin-styles.css). The letter and number buttons (B, I, H, 1.) stay as text.
 */
const ICONS = {
  // quotes.njk — a filled icon; recolored to currentColor to theme with the button
  quote:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M221.216,43C130.487,49.375,0.072,63.86,0,241.546v223.561h202.455V225.913H135.23c-4.258-63.869,48.334-80.36,105.527-93.02L221.216,43z M492.458,43c-90.728,6.375-221.144,20.86-221.215,198.546v223.561h202.455V225.913h-67.226c-4.258-63.869,48.336-80.36,105.527-93.02L492.458,43L492.458,43z"/></svg>',
  // list.njk
  list: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  // link.njk
  link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  // eye.njk
  eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
};

/**
 * Build the dialog's single EasyMDE instance and wire Save/Cancel/close. Runs
 * once, lazily, on the first open. The toolbar uses text letters/numbers and
 * inline Feather SVGs rather than FontAwesome classes, and autoDownloadFontAwesome
 * is off, so nothing reaches out to a CDN — the admin stays self-contained.
 */
function ensureEditor() {
  if (editor) {
    return;
  }
  const EasyMDE = window.EasyMDE;
  dialog = document.getElementById('markdown-editor-dialog');
  titleEl = document.getElementById('markdown-editor-title');
  const host = document.getElementById('markdown-editor-host');
  const saveBtn = document.getElementById('markdown-editor-save');
  const cancelBtn = document.getElementById('markdown-editor-cancel');

  editor = new EasyMDE({
    element: host,
    autoDownloadFontAwesome: false,
    spellChecker: false,
    status: false,
    autofocus: false,
    minHeight: '300px',
    placeholder: 'Write Markdown…',
    toolbar: [
      { name: 'bold', action: EasyMDE.toggleBold, title: 'Bold', text: 'B' },
      { name: 'italic', action: EasyMDE.toggleItalic, title: 'Italic', text: 'I' },
      { name: 'heading', action: EasyMDE.toggleHeadingSmaller, title: 'Heading', text: 'H' },
      '|',
      { name: 'quote', action: EasyMDE.toggleBlockquote, title: 'Quote', icon: ICONS.quote },
      { name: 'unordered-list', action: EasyMDE.toggleUnorderedList, title: 'Bulleted list', icon: ICONS.list },
      { name: 'ordered-list', action: EasyMDE.toggleOrderedList, title: 'Numbered list', text: '1.' },
      '|',
      { name: 'link', action: EasyMDE.drawLink, title: 'Insert link', icon: ICONS.link },
      '|',
      { name: 'preview', action: EasyMDE.togglePreview, title: 'Toggle preview', icon: ICONS.eye, noDisable: true }
    ]
  });

  // Save and Cancel set the result, then close. Escape/backdrop close the
  // dialog without touching pendingResult (which open() reset to null), so they
  // resolve as a cancel. Resolving in one place — the 'close' handler — keeps
  // the three paths from double-resolving.
  saveBtn.addEventListener('click', () => {
    pendingResult = editor.value();
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => {
    pendingResult = null;
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (resolveOpen) {
      const resolve = resolveOpen;
      resolveOpen = null;
      resolve(pendingResult);
    }
  });
}

/**
 * Opens the overlay to edit a Markdown string.
 * @param {string} initial - The current field value.
 * @param {string} [title] - Heading shown above the editor.
 * @return {Promise<string|null>} The edited value on Save, or null on cancel.
 */
export function openMarkdownOverlay(initial, title) {
  ensureEditor();
  return new Promise((resolve) => {
    resolveOpen = resolve;
    pendingResult = null;
    titleEl.textContent = title || 'Edit Markdown';
    dialog.showModal();
    editor.value(initial || '');
    // The dialog is now laid out; refresh CodeMirror so it has a real height,
    // then focus with the cursor at the top of the document.
    requestAnimationFrame(() => {
      const cm = editor.codemirror;
      cm.refresh();
      cm.setCursor(0, 0);
      cm.focus();
    });
  });
}

/**
 * Adds an "Expand" button after a Markdown textarea that opens the overlay and,
 * on Save, writes the result back to the textarea and dispatches an `input`
 * event. Dispatching the event (rather than mutating obj[key] here) reuses the
 * textarea's own oninput wiring, so this works for both a section field and the
 * page-content body without knowing how either commits its value.
 *
 * The textarea must already be attached to a parent.
 * @param {HTMLTextAreaElement} textarea - The Markdown field.
 * @param {string} [title] - Heading shown in the overlay.
 */
export function attachMarkdownOverlay(textarea, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'md-expand-btn';
  btn.textContent = '⤢ Expand';
  btn.title = 'Open the Markdown editor';
  btn.addEventListener('click', async () => {
    const result = await openMarkdownOverlay(textarea.value, title);
    if (result === null) {
      return;
    }
    textarea.value = result;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  textarea.insertAdjacentElement('afterend', btn);
}
