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
  'src/assets/js/easymde',
  'src/assets/js/browser-fs-access',
  // Admin styles (layered over the site's main.css)
  'src/assets/css/admin-styles.css',
  // The publish backend
  'netlify/functions/publish.js',
  // The preview render backend (renders a draft through the site's own Nunjucks
  // templates/filters for the live rendered preview and inline editing)
  'netlify/functions/preview.js',
  'netlify/functions/lib/render-page.js',
  'netlify.toml'
];

/** Build plugins a consuming site must install for the editor to work. */
export const NPM_DEPS = ['metalsmith-site-data', 'metalsmith-bundled-components'];

/**
 * The distribution scripts the package carries: the installer (its bin), this
 * manifest (imported by both the installer and the exporter at runtime), and the
 * exporter. The whole toolkit travels with the editor so it never depends on a
 * particular pre-existing fixture. The exporter folds this into FILES to decide
 * what the package ships; a `--dev` install copies this same set into a site so
 * the site becomes a self-contained dev fixture you can edit and re-export from.
 */
export const SCRIPTS = [
  'scripts/install-editor.mjs',
  'scripts/editor-manifest.mjs',
  'scripts/export-editor.mjs'
];
