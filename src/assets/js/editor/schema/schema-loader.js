/**
 * Loads the build artifact `components-schema.json` once and caches it. The
 * artifact is the resolved form of the component manifests: a map from
 * sectionType to its fully composed, nested field tree (see
 * docs/manifest-driven-editor.md). The editor treats it as read-only data
 * and never does composition in the browser.
 */

const SCHEMA_URL = '/assets/components-schema.json';

let schemaPromise = null;
let schemaCache = null;

/**
 * Fetches and caches the component schema. Safe to call repeatedly; the
 * network request happens once.
 * @return {Promise<Object>} The schema map (sectionType -> { name, fields }).
 */
export function loadSchema() {
  if (!schemaPromise) {
    schemaPromise = fetch(SCHEMA_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`schema fetch failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((schema) => {
        schemaCache = schema;
        return schema;
      })
      .catch((err) => {
        // Reset so a later call can retry rather than caching the failure.
        schemaPromise = null;
        throw err;
      });
  }
  return schemaPromise;
}

/**
 * Returns the resolved field tree for a section type from the loaded cache,
 * or null if the schema is not loaded yet or the type is unknown. Synchronous
 * so the emitter and form code can use it once loadSchema() has resolved.
 * @param {string} type - The sectionType.
 * @return {Object|null} The field tree, or null.
 */
export function getSectionFields(type) {
  if (!schemaCache || !schemaCache[type]) {
    return null;
  }
  return schemaCache[type].fields || null;
}

/**
 * Whether a section type is present in the loaded schema (and thus editable
 * through the schema-driven path).
 * @param {string} type - The sectionType.
 * @return {boolean} True if known.
 */
export function isSchemaType(type) {
  return Boolean(schemaCache && schemaCache[type]);
}

/**
 * The section types present in the loaded schema, sorted alphabetically. This
 * is the full set the add menu offers: it is whatever the build emitted from
 * the site's component manifests, so the editor adapts to a site's component
 * set with no per-type code. Empty until loadSchema() has resolved.
 * @return {string[]} The sorted sectionType keys.
 */
export function getSectionTypes() {
  return schemaCache ? Object.keys(schemaCache).sort() : [];
}
