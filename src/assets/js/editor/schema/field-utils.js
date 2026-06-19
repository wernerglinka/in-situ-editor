/**
 * Pure helpers for walking a resolved component field tree.
 *
 * The field tree is the per-section value of the build artifact
 * `components-schema.json` (see docs/manifest-driven-editor.md). A node with
 * a `widget` key is a leaf field; any other object is a group whose nesting
 * becomes the field's path in the frontmatter. `widget: array` is a leaf
 * whose `items` is itself a field tree describing one entry.
 *
 * These functions carry no DOM or fetch dependency so they can be unit
 * tested directly with node:test.
 */

/** @param {any} node @return {boolean} True if the node is a field (has a widget). */
export function isLeaf(node) {
  return Boolean(node) && typeof node === 'object' && typeof node.widget === 'string';
}

/** @param {any} node @return {boolean} True if the node is a repeatable array field. */
export function isArrayField(node) {
  return isLeaf(node) && node.widget === 'array';
}

/** @param {any} node @return {boolean} True if the node is a group of nested fields. */
export function isGroup(node) {
  return Boolean(node) && typeof node === 'object' && !isLeaf(node);
}

/**
 * The empty value for a leaf widget when no `default` is declared.
 * @param {string} widget - The widget name.
 * @return {boolean|Array|string} The zero value.
 */
function zeroFor(widget) {
  if (widget === 'checkbox') {
    return false;
  }
  if (widget === 'array' || widget === 'multiselect') {
    return [];
  }
  return '';
}

/**
 * Builds a nested values object from a field tree, every leaf set to its
 * declared `default` (or the widget's zero value), every array empty, and
 * every group recursed. This is the shape a new section starts from and the
 * shape hydration fills.
 * @param {Object} fields - A field tree (the `fields` of a section, a group, or an array's `items`).
 * @return {Object} The materialized values object.
 */
export function materializeDefaults(fields) {
  const out = {};
  for (const [ key, node ] of Object.entries(fields)) {
    if (isArrayField(node)) {
      out[key] = [];
    } else if (isLeaf(node)) {
      out[key] = 'default' in node ? node.default : zeroFor(node.widget);
    } else if (isGroup(node)) {
      out[key] = materializeDefaults(node);
    }
  }
  return out;
}
