/**
 * Structured-frontmatter emitter. Serializes a draft's sections to YAML
 * frontmatter (with an empty body) that lib/layouts/pages/sections.njk
 * renders.
 *
 * Every section is schema-driven (tagged with `sectionType`): emitSection
 * runs it through the generic serializer in schema/serializer.js, driven by
 * the loaded component schema (see docs/manifest-driven-editor.md).
 */

import { getSectionFields } from '../editor/schema/schema-loader.js';
import { serializeSection, firstSectionImage } from '../editor/schema/serializer.js';

/**
 * Escapes a scalar string for safe use as a single-line YAML value.
 * @param {string|any} val - The value to escape.
 * @return {string|any} The escaped value.
 */
export function escapeYamlValue(val) {
  if (typeof val !== 'string') {
    return val;
  }
  if (val === '') {
    return "''";
  }
  // Quote if it contains YAML-special characters, starts ambiguously, or
  // would be type-coerced (bare dates become Date objects, which breaks
  // collections' card.date string sort against other posts).
  if (/[#:[\]{}>|&*?%@`'"]/.test(val) || /^[\s-]/.test(val) || /\s$/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

/**
 * Serializes a JS value to YAML lines.
 * Multiline strings become |- block scalars; everything else is inline.
 * @param {any} value - The value to serialize.
 * @param {number} indent - Current indentation depth in spaces.
 * @return {string} YAML fragment (without trailing newline).
 */
export function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null; // caller renders `key: []`
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const body = toYaml(item, indent + 2);
          // Hoist the first key onto the dash line
          return `${pad}- ${body.trimStart()}`;
        }
        return `${pad}- ${escapeYamlValue(item)}`;
      })
      .join('\n');
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value)
      .map(([ key, val ]) => {
        if (Array.isArray(val)) {
          if (val.length === 0) {
            return `${pad}${key}: []`;
          }
          return `${pad}${key}:\n${toYaml(val, indent + 2)}`;
        }
        if (val !== null && typeof val === 'object') {
          return `${pad}${key}:\n${toYaml(val, indent + 2)}`;
        }
        if (typeof val === 'string' && val.includes('\n')) {
          const block = val
            .split('\n')
            .map((line) => (line ? `${pad}  ${line}` : ''))
            .join('\n');
          return `${pad}${key}: |-\n${block}`;
        }
        return `${pad}${key}: ${escapeYamlValue(val)}`;
      })
      .join('\n');
  }

  return `${pad}${escapeYamlValue(value)}`;
}

/**
 * Slugifies a title the same way the publish path does.
 * @param {string} title - The post title.
 * @return {string} The slug.
 */
const slugify = (title) =>
  (title || 'untitled')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

/**
 * Page-type registry. Each type maps to its output directory (used by the
 * publish Function) and the published image directory root. A blog post lives
 * under `src/blog/` and carries a card + tags + collection membership; a page
 * lives at the top level and carries neither. Both share the sections layout.
 */
export const PAGE_TYPES = {
  post: { dir: 'src/blog', imageRoot: '/assets/images/blog', layout: 'pages/sections.njk' },
  page: { dir: 'src', imageRoot: '/assets/images', layout: 'pages/sections.njk' }
};

/** Resolves a draft's page type, defaulting to a blog post. */
export const pageTypeOf = (draft) => (draft && draft.pageType === 'page' ? 'page' : 'post');

/**
 * The post-only frontmatter blocks: the card (collections sort on card.date,
 * collection-list renders it), tags, and any ad classifier results.
 * @return {Object} The post blocks to merge into the doc.
 */
function postBlocks(draft, title, description, date, tags, thumbnail, classifierResults) {
  return {
    card: {
      title: title || '',
      description: description || '',
      date,
      author: Array.isArray(draft.authors) ? draft.authors : [],
      thumbnail
    },
    tags,
    ...(classifierResults.length > 0
      ? {
          ad_categories: classifierResults.map((r) => r.id),
          ad_confidences: classifierResults.map((r) => r.confidence)
        }
      : {})
  };
}

/**
 * The page-only navigation block, when the page opts into the main menu.
 * @return {Object} `{ navigation }` or an empty object.
 */
function pageBlocks(draft, title) {
  if (!draft.showInMenu) {
    return {};
  }
  return { navigation: { navLabel: draft.navLabel || title || '', navIndex: Number(draft.navIndex) || 0 } };
}

/**
 * Generates a structured-content markdown document (frontmatter only,
 * empty body) from draft data. The shape depends on the draft's page type:
 * a post carries seo + card + tags, a page carries seo and (optionally) a
 * navigation block. Top-level frontmatter the editor does not manage is
 * carried through `draft.extra` so an edited page never loses keys it does
 * not understand (navigation, bodyClasses, hasHero, ...).
 *
 * @param {Object} draft - The draft object.
 * @param {string} title - The title.
 * @param {string} description - The description.
 * @param {string} date - The date (posts only).
 * @param {string} tagsValue - Comma-separated tags string (posts only).
 * @param {string} content - Unused; kept for signature compatibility.
 * @param {Array<Object>} [classifierResults=[]] - AI classifier results (posts only).
 * @return {string} The formatted Markdown string.
 */
export function generateMarkdown(draft, title, description, date, tagsValue, content, classifierResults = []) {
  const slug = slugify(title);
  const type = pageTypeOf(draft);
  const cfg = PAGE_TYPES[type];
  const imageBase = `${cfg.imageRoot}/${slug}`;
  const isPost = type === 'post';

  const tags = tagsValue
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);

  const editorSections = Array.isArray(draft.sections) ? draft.sections : [];
  const thumbnail = firstSectionImage(editorSections, getSectionFields, imageBase);

  const doc = {
    layout: cfg.layout,
    draft: false,
    ...(isPost ? { bodyClass: '' } : {}),
    // Top-level keys the editor doesn't manage, preserved from the source page.
    ...(draft.extra && typeof draft.extra === 'object' ? draft.extra : {}),
    seo: {
      title: title || '',
      description: description || '',
      socialImage: thumbnail,
      canonicalOverwrite: ''
    },
    ...(isPost
      ? postBlocks(draft, title, description, date, tags, thumbnail, classifierResults)
      : pageBlocks(draft, title)),
    sections: editorSections.map((s) => emitSection(s, imageBase))
  };

  return `---\n${toYaml(doc)}\n---\n`;
}

/**
 * Emits one section into the library frontmatter shape via the schema.
 * @param {Object} s - A schema-driven section values object.
 * @param {string} imageBase - The published image directory for this page.
 * @return {Object} The library-schema section object.
 */
function emitSection(s, imageBase) {
  const fields = s.sectionType ? getSectionFields(s.sectionType) : null;
  if (fields) {
    return serializeSection(s.sectionType, s, fields, imageBase);
  }
  // Schema not loaded yet (an early preview render before the fetch
  // resolves). The values object is already library-shaped, so emit it with
  // the wrapper fields; the load-time re-sync corrects image paths.
  return { containerTag: 'section', id: '', classes: '', ...s };
}
