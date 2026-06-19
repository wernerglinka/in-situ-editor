/**
 * Loads the build artifact `site-data.json` once and caches it. The artifact
 * (emitted by the metalsmith-site-data package) is the site's build-time data
 * the editor cannot otherwise see: the `data` namespace (the lib/data/*.json
 * files) and `collections` (each name mapped to its member source-.md paths,
 * which key assets/pages.json). It backs select fields whose options come from
 * the site's data rather than a static enum (see form-renderer `source`).
 */

const SITE_DATA_URL = '/assets/site-data.json';

let dataPromise = null;
let dataCache = null;

/**
 * Fetches and caches the site data. Safe to call repeatedly; the network
 * request happens once. Resolves to an empty shape if the artifact is missing
 * so the editor degrades gracefully on a site that does not emit it.
 * @return {Promise<Object>} { data, collections }.
 */
export function loadSiteData() {
  if (!dataPromise) {
    dataPromise = fetch(SITE_DATA_URL)
      .then((res) => (res.ok ? res.json() : { data: {}, collections: {} }))
      .then((parsed) => {
        dataCache = parsed && typeof parsed === 'object' ? parsed : { data: {}, collections: {} };
        return dataCache;
      })
      .catch(() => {
        // Reset so a later call can retry; serve an empty shape meanwhile.
        dataPromise = null;
        dataCache = { data: {}, collections: {} };
        return dataCache;
      });
  }
  return dataPromise;
}

/**
 * The array stored under a `data` namespace key (e.g. 'author'), from the
 * loaded cache. Synchronous; empty until loadSiteData() has resolved.
 * @param {string} name - The data namespace key.
 * @return {Array<Object>} The array, or [] if absent or not an array.
 */
export function getDataArray(name) {
  const value = dataCache && dataCache.data ? dataCache.data[name] : null;
  return Array.isArray(value) ? value : [];
}

/**
 * The collection names present in the loaded site data.
 * @return {string[]} The collection names, or [] until loaded.
 */
export function getCollectionNames() {
  return dataCache && dataCache.collections ? Object.keys(dataCache.collections) : [];
}
