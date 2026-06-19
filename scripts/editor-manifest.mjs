/**
 * The in-situ editor's distributable surface, shared by the installer
 * (install-editor.mjs — the published package's bin, which copies the surface
 * into a consuming site) and the exporter (export-editor.mjs — which
 * materializes the editor-only package from this dev fixture). One source of
 * truth so the two never drift.
 */

/**
 * Editor surface: paths relative to the package/repo root, copied verbatim into
 * the same relative path under a consuming site. Directories recurse. The site's
 * own /assets/main.css and /assets/main.js (which the admin layout also loads)
 * are assumed to exist on the target.
 */
export const MANIFEST = [
  // The admin page and its layout
  'src/admin/index.html',
  'lib/layouts/admin.njk',
  // The editor frontend and its vendored libraries
  'src/assets/js/editor',
  'src/assets/js/drafts',
  'src/assets/js/utils',
  'src/assets/js/ai',
  'src/assets/js/export',
  'src/assets/js/helpers',
  'src/assets/js/marked',
  'src/assets/js/turndown',
  'src/assets/js/prismjs',
  'src/assets/js/jszip',
  'src/assets/js/js-yaml',
  'src/assets/js/browser-fs-access',
  // Admin styles (layered over the site's main.css)
  'src/assets/css/admin-styles.css',
  // The publish backend
  'netlify/functions/publish.js',
  'netlify.toml'
];

/** Build plugins a consuming site must install for the editor to work. */
export const NPM_DEPS = ['metalsmith-site-data', 'metalsmith-bundled-components'];
