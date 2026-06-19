/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

/**
 * Parses frontmatter from a string. Uses the bundled js-yaml (global
 * `jsyaml`, loaded in admin.njk) so nested structures like the `sections`
 * tree round-trip faithfully; falls back to a flat scalar parser only if the
 * library is missing. Dates stay strings (JSON schema) to match the emitter,
 * which quotes them.
 * @param {string} text - The input text containing frontmatter.
 * @return {Object} { metadata, content } (or { content } when no frontmatter).
 */
export function parseFrontmatter(text) {
  const regex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = text.match(regex);
  if (!match) {
    return { content: text };
  }

  const yaml = match[1];
  const content = match[2];
  const lib = typeof globalThis !== 'undefined' ? globalThis.jsyaml : null;
  if (lib) {
    try {
      return { metadata: lib.load(yaml, { schema: lib.JSON_SCHEMA }) || {}, content };
    } catch (err) {
      console.error('YAML parse failed; falling back to the flat parser', err);
    }
  }
  return { metadata: parseFlatYaml(yaml), content };
}

/**
 * Minimal flat-scalar fallback used only when js-yaml is unavailable. Reads
 * top-level `key: value` pairs and simple inline `[a, b]` arrays; cannot
 * represent nested structures like `sections`.
 * @param {string} yaml - The frontmatter YAML block.
 * @return {Object} The parsed flat metadata.
 */
function parseFlatYaml(yaml) {
  const metadata = {};
  yaml.split('\n').forEach((line) => {
    const part = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (part) {
      const key = part[1].trim();
      let value = part[2].trim().replace(/^["']|["']$/g, '');
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^["']|["']$/g, ''));
      }
      metadata[key] = value;
    }
  });
  return metadata;
}

/**
 * Populates the editor UI with values from the parsed metadata.
 * @param {Object} metadata - The metadata object.
 * @param {Object} ui - The UI elements.
 * @param {Object} tagEditor - The tag editor component instance.
 */
export async function populateUIFromMetadata(metadata, ui, tagEditor) {
  if (metadata.title) {
    ui.titleInput.value = metadata.title;
  }
  if (metadata.description) {
    ui.descInput.value = metadata.description;
  }
  if (metadata.date) {
    ui.dateInput.value = metadata.date;
  }
  if (metadata.authors && ui.authorsSelect) {
    const authors = Array.isArray(metadata.authors)
      ? metadata.authors
      : [metadata.authors];
    for (const option of ui.authorsSelect.options) {
      option.selected = authors.includes(option.value);
    }
  }
  if (metadata.tags) {
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags.join(', ')
      : metadata.tags;
    ui.tagsInput.value = tags;
    tagEditor.renderPills();
  }

  if (metadata.ad_categories && window.renderClassifierResults) {
    const categories = Array.isArray(metadata.ad_categories)
      ? metadata.ad_categories
      : [metadata.ad_categories];
    const confidences = Array.isArray(metadata.ad_confidences)
      ? metadata.ad_confidences
      : [metadata.ad_confidences];

    const results = categories.map((id, i) => ({
      id,
      confidence: confidences[i] ? parseFloat(confidences[i]) : null,
    }));

    await window.renderClassifierResults(ui, results, () => {
      if (window.sync) {
        window.sync();
      }
    });
  }
}
