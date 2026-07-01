/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Object containing references to all major UI elements in the editor.
 */
export const ui = {
  draftsListEl: document.getElementById('drafts-list'),
  newDraftBtn: document.getElementById('new-draft-btn'),
  loadDraftBtn: document.getElementById('load-draft-btn'),
  openSiteBtn: document.getElementById('open-site-btn'),
  openSiteDialog: document.getElementById('open-site-dialog'),
  openSiteList: document.getElementById('open-site-list'),
  pageTypeRadios: Array.from(document.querySelectorAll('input[name="page-type"]')),
  pageTypeHint: document.getElementById('page-type-hint'),
  bodyModeToggle: document.getElementById('post-body-mode'),
  hasHeroToggle: document.getElementById('post-has-hero'),
  socialImageInput: document.getElementById('post-social-image'),
  canonicalUrlInput: document.getElementById('post-canonical-url'),
  bodyClassesInput: document.getElementById('post-body-classes'),
  topMessageTextInput: document.getElementById('post-top-message-text'),
  topMessageLinkUrlInput: document.getElementById('post-top-message-link-url'),
  topMessageLinkLabelInput: document.getElementById('post-top-message-link-label'),
  topMessageDismissibleToggle: document.getElementById('post-top-message-dismissible'),
  showInMenuToggle: document.getElementById('page-show-in-menu'),
  navLabelInput: document.getElementById('page-nav-label'),
  navIndexInput: document.getElementById('page-nav-index'),
  titleInput: document.getElementById('post-title'),
  aiSuggestTitleBtn: document.getElementById('ai-suggest-title-btn'),
  descInput: document.getElementById('post-description'),
  aiSuggestDescriptionBtn: document.getElementById('ai-suggest-description-btn'),
  dateInput: document.getElementById('post-date'),
  authorsSelect: document.getElementById('post-authors'),
  tagsInput: document.getElementById('post-tags'),
  tagPills: document.getElementById('tag-pills'),
  tagInput: document.getElementById('tag-input'),
  aiSuggestTagsBtn: document.getElementById('ai-suggest-tags-btn'),
  contentInput: document.getElementById('post-content'),
  sectionsList: document.getElementById('sections-list'),
  previewContent: document.getElementById('preview-content'),
  previewFrame: document.getElementById('preview-frame'),
  previewModeRenderedBtn: document.getElementById('preview-mode-rendered'),
  previewModeYamlBtn: document.getElementById('preview-mode-yaml'),
  copyBtn: document.getElementById('copy-btn'),
  downloadBtn: document.getElementById('download-btn'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  uploadBtn: document.getElementById('upload-btn'),
  aiStatus: document.getElementById('ai-status'),
  aiDownloadProgress: document.getElementById('ai-download-progress'),
  aiStatusText: document.getElementById('ai-status-text'),
  aiWriterInput: document.getElementById('ai-writer-input'),
  aiWriterBtn: document.getElementById('ai-writer-btn'),
  aiRewriterTone: document.getElementById('ai-rewriter-tone'),
  aiRewriterLength: document.getElementById('ai-rewriter-length'),
  aiRewriterBtn: document.getElementById('ai-rewriter-btn'),
  aiClassifierBtn: document.getElementById('ai-classifier-btn'),
  aiClassifierResults: document.getElementById('ai-classifier-results'),
  aiFeaturesToggle: document.getElementById('ai-features-toggle'),
  aiOnlyExistingTagsToggle: document.getElementById('ai-only-existing-tags-toggle'),
  settingsDetails: document.querySelector('.settings-details'),
  aiWriterSection: document.querySelector('.ai-writer-section'),
  aiRewriterSection: document.querySelector('.ai-rewriter-section'),
  aiClassifierSection: document.querySelector('.ai-classifier-section'),
  aiTranslationSection: document.querySelector('.ai-translation-section'),
  aiTranslateToggle: document.getElementById('ai-translate-toggle'),
  aiTranslationLocalesContainer: document.getElementById('ai-translation-locales-container'),
  aiTranslationsContainer: document.getElementById('ai-translations-container'),
  aiTranslateAllBtn: document.getElementById('ai-translate-all-btn'),
  alertDialog: document.getElementById('alert-dialog'),
  alertMessage: document.getElementById('alert-message'),
  alertDetails: document.getElementById('alert-details'),
  alertDetailsMessage: document.getElementById('alert-details-message'),
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmMessage: document.getElementById('confirm-message'),
  identitySignedOut: document.getElementById('identity-signed-out'),
  identitySignedIn: document.getElementById('identity-signed-in'),
  identityUserEmail: document.getElementById('identity-user-email'),
  identityUserRole: document.getElementById('identity-user-role'),
  identitySigninBtn: document.getElementById('identity-signin-btn'),
  identitySignoutBtn: document.getElementById('identity-signout-btn'),
  publishPrBtn: document.getElementById('publish-pr-btn'),
  publishDirectBtn: document.getElementById('publish-direct-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  loadSettingsBtn: document.getElementById('load-settings-btn'),
  activeAiStreams: 0,
  getTags: () =>
    ui.tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && t !== 'posts'),
  getAuthors: () => (ui.authorsSelect ? Array.from(ui.authorsSelect.selectedOptions).map((o) => o.value) : []),
  getPageType: () => {
    const checked = ui.pageTypeRadios.find((r) => r.checked);
    return checked && checked.value === 'page' ? 'page' : 'post';
  },
  getBodyMode: () => (ui.bodyModeToggle && ui.bodyModeToggle.checked ? 'content' : 'sections'),
  getSlug: (title) =>
    (title || 'untitled')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
};
