/**
 * Generic section serializer: turns a schema-driven section's values object
 * into the library frontmatter shape that lib/layouts/pages/sections.njk
 * renders. This replaces the hand-written per-type branches in
 * markdown-utils.js as section types move onto the schema-driven path.
 *
 * The values object already mirrors the frontmatter (it was materialized
 * from the same field tree), so serialization is a structural walk that
 * fills any missing leaf from its `default`, rewrites uploaded image
 * filenames into their published path, and adds the section wrapper fields
 * the template needs but the author never edits (`containerTag`, `id`,
 * `classes`).
 */

import { isLeaf, isArrayField, isGroup } from './field-utils.js';

/**
 * Per-type wrapper overrides. The template reads `containerTag`/`classes`
 * off the section root; these are presentation defaults the schema's
 * author-facing `fields` deliberately omit. Anything not listed uses a
 * plain `<section>` with no extra classes.
 */
const WRAPPER = {
  banner: { containerTag: 'aside', classes: 'cta-banner' }
};

/**
 * Rewrites an image widget's value. A bare uploaded filename becomes the
 * published path under the page's image base; a URL or already-rooted path is
 * left untouched.
 * @param {string} value - The stored image value.
 * @param {string} imageBase - The published image directory (no trailing slash).
 * @return {string} The path to emit.
 */
function rewriteImage(value, imageBase) {
  if (typeof value !== 'string' || value === '') {
    return value;
  }
  if (value.includes('/') || /^https?:/i.test(value) || /^data:/i.test(value)) {
    return value;
  }
  return `${imageBase}/${value}`;
}

/**
 * Produces the emitted value for one leaf: image leaves are path-rewritten,
 * number leaves are coerced to a real number (an empty/unset value stays as
 * is so optional numbers don't become 0), everything else passes through.
 * @param {Object} node - The leaf field definition.
 * @param {any} val - The raw value (or the node default).
 * @param {string} imageBase - The published image directory, for image paths.
 * @return {any} The value to emit.
 */
function serializeLeaf(node, val, imageBase) {
  if (node.widget === 'image') {
    return rewriteImage(val, imageBase);
  }
  if (node.widget === 'number') {
    return val === '' || val === null || val === undefined ? val : Number(val);
  }
  return val;
}

/**
 * Walks a field tree alongside a values object, producing a clean nested
 * object: defaults fill gaps, image leaves are path-rewritten, arrays map
 * their entries through their `items` tree.
 * @param {Object} fields - The field tree.
 * @param {Object} values - The values object (may be partial).
 * @param {string} imageBase - The published image directory, for image paths.
 * @return {Object} The serialized nested object.
 */
function walk(fields, values, imageBase) {
  const out = {};
  const src = values && typeof values === 'object' ? values : {};
  // Carry through anything the schema does not describe (wrapper fields like
  // containerTag, and any field a hand-authored page has that the schema
  // does not), so opening and saving a page never silently drops data.
  for (const key of Object.keys(src)) {
    if (!(key in fields)) {
      out[key] = src[key];
    }
  }
  for (const [ key, node ] of Object.entries(fields)) {
    if (isArrayField(node)) {
      const arr = Array.isArray(src[key]) ? src[key] : [];
      out[key] = arr.map((item) => walk(node.items, item, imageBase));
    } else if (isLeaf(node)) {
      out[key] = serializeLeaf(node, key in src ? src[key] : node.default, imageBase);
    } else if (isGroup(node)) {
      out[key] = walk(node, src[key], imageBase);
    }
  }
  return out;
}

/**
 * Serializes one schema-driven section into a library frontmatter section.
 * @param {string} type - The section type (its `sectionType`).
 * @param {Object} values - The section's values object.
 * @param {Object} fields - The resolved field tree for this type.
 * @param {string} imageBase - The published image directory, for image paths.
 * @return {Object} The library-schema section object.
 */
export function serializeSection(type, values, fields, imageBase) {
  const wrap = WRAPPER[type] || {};
  return {
    sectionType: type,
    containerTag: wrap.containerTag || 'section',
    id: '',
    classes: wrap.classes || '',
    ...walk(fields, values, imageBase)
  };
}

/**
 * Finds the first uploaded image across a set of schema-driven sections, for
 * use as the card thumbnail and social image. Walks each section's field
 * tree to locate image leaves so it works regardless of section type.
 * @param {Array<Object>} sections - Schema-driven section values objects.
 * @param {Function} fieldsFor - Maps a sectionType to its field tree.
 * @param {string} imageBase - The published image directory, for the returned path.
 * @return {string} The published image path, or '' if none.
 */
export function firstSectionImage(sections, fieldsFor, imageBase) {
  for (const section of sections || []) {
    if (!section || !section.sectionType) {
      continue;
    }
    const fields = fieldsFor(section.sectionType);
    if (!fields) {
      continue;
    }
    const found = findImage(fields, section);
    if (found) {
      return rewriteImage(found, imageBase);
    }
  }
  return '';
}

/**
 * Depth-first search for the first non-empty image leaf in a values object.
 * @param {Object} fields - The field tree.
 * @param {Object} values - The values object.
 * @return {string|null} The raw image value, or null.
 */
function findImage(fields, values) {
  const src = values && typeof values === 'object' ? values : {};
  for (const [ key, node ] of Object.entries(fields)) {
    if (isArrayField(node)) {
      for (const item of Array.isArray(src[key]) ? src[key] : []) {
        const hit = findImage(node.items, item);
        if (hit) {
          return hit;
        }
      }
    } else if (isLeaf(node)) {
      if (node.widget === 'image' && typeof src[key] === 'string' && src[key] !== '') {
        return src[key];
      }
    } else if (isGroup(node)) {
      const hit = findImage(node, src[key]);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}
