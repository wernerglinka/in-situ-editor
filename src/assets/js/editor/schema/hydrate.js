/**
 * Hydration: the inverse of the serializer. Turns a published page's
 * frontmatter sections back into the editor's schema-driven values objects so
 * an existing page can be opened and round-tripped (see
 * docs/manifest-driven-editor.md).
 *
 * Because the editor's section model already mirrors the library frontmatter
 * shape, hydration is mostly a completeness pass: deep-merge the page's
 * section over the schema's defaults so every control renders and the page's
 * own values win, while any field the schema does not describe is preserved.
 * A section whose type the editor does not own (an auto/chrome type with no
 * fields) is returned untouched and round-trips verbatim.
 *
 * Pure (no DOM or fetch) so it can be unit tested with node:test.
 */

import { materializeDefaults } from './field-utils.js';

/** @param {any} v @return {boolean} True for a non-null, non-array object. */
function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep-merges `over` onto `base`: nested objects merge, everything else
 * (scalars, arrays) takes the `over` value. Keys present only in `base` are
 * kept (defaults), keys present only in `over` are kept (unknown extras).
 * @param {Object} base - The defaults.
 * @param {Object} over - The page's values.
 * @return {Object} The merged object.
 */
function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) {
    return over;
  }
  const out = { ...base };
  for (const [ key, value ] of Object.entries(over)) {
    out[key] = isPlainObject(out[key]) && isPlainObject(value) ? deepMerge(out[key], value) : value;
  }
  return out;
}

/**
 * Hydrates one frontmatter section into an editor section.
 * @param {Object} section - A library-shaped frontmatter section.
 * @param {Function} fieldsFor - Maps a sectionType to its field tree.
 * @return {Object} The hydrated (or, for unowned types, untouched) section.
 */
export function hydrateSection(section, fieldsFor) {
  if (!isPlainObject(section) || !section.sectionType) {
    return section;
  }
  const fields = fieldsFor(section.sectionType);
  if (!fields) {
    return section;
  }
  return deepMerge(materializeDefaults(fields), section);
}

/**
 * Hydrates a frontmatter `sections` array.
 * @param {Array<Object>} sections - The page's sections.
 * @param {Function} fieldsFor - Maps a sectionType to its field tree.
 * @return {Array<Object>} The hydrated sections.
 */
export function hydrateSections(sections, fieldsFor) {
  return (Array.isArray(sections) ? sections : []).map((s) => hydrateSection(s, fieldsFor));
}
