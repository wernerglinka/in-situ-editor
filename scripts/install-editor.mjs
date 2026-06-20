#!/usr/bin/env node
/**
 * Install the in-situ editor into a Metalsmith structured-content site.
 *
 * Copies the editor's frontend surface (admin page + layout, the editor JS
 * tree and its vendored libraries, the admin stylesheet) and the Netlify
 * publish backend into a target site, then prints the wiring that has to be
 * done by hand (the metalsmith.js plugin calls and the Netlify Identity /
 * Function setup, which are too site-specific to patch safely).
 *
 * Usage:
 *   # inside a freshly cloned starter-derived site:
 *   npx @wernerglinka/in-situ-editor [--force] [--dev]
 *
 *   # or from a checkout of this repo, targeting another site:
 *   node scripts/install-editor.mjs <target-site-dir> [--force] [--dev]
 *
 * The source is this package's own files (SRC_ROOT), so it works whether run
 * from a repo checkout or from node_modules via npx. The target defaults to the
 * current directory. Existing files are skipped unless --force is given. It does
 * not touch the target's metalsmith.js, package.json, or any Netlify dashboard
 * settings — those steps are printed at the end.
 *
 * With --dev it also copies the distribution scripts (scripts/) into the site,
 * turning it into a self-contained dev fixture: the in-site exporter resolves its
 * source root to that site, so it exports the editor edits you make there rather
 * than the pristine package. A plain content install (no --dev) stays free of
 * editor tooling.
 */
import { cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST, NPM_DEPS, SCRIPTS } from './editor-manifest.mjs';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const dev = args.includes('--dev');
// Target defaults to the current directory so `npx @wernerglinka/in-situ-editor`
// installs into the site you are standing in; an explicit path still works.
const targetArg = args.find((a) => !a.startsWith('--')) || '.';

const target = resolve(process.cwd(), targetArg);

if (!existsSync(target) || !statSync(target).isDirectory()) {
  fail(`Target is not a directory: ${target}`);
}
if (target === SRC_ROOT) {
  fail('Target is this repo; choose a different site to install into.');
}
for (const marker of ['metalsmith.js', 'package.json']) {
  if (!existsSync(join(target, marker))) {
    fail(`Target does not look like a Metalsmith site (missing ${marker}): ${target}`);
  }
}

console.log(`\nInstalling the in-situ editor into:\n  ${target}\n`);

// Copy a set of package-relative paths into the target, honoring --force for
// existing files (files and dirs both via cpSync recursive).
function copyInto(relPaths) {
  let copied = 0;
  let skipped = 0;
  for (const rel of relPaths) {
    const from = join(SRC_ROOT, rel);
    const to = join(target, rel);
    if (!existsSync(from)) {
      console.warn(`  ⚠ source missing, skipped: ${rel}`);
      continue;
    }
    if (existsSync(to) && !force) {
      console.log(`  • exists, skipped (use --force): ${rel}`);
      skipped += 1;
      continue;
    }
    cpSync(from, to, { recursive: true });
    console.log(`  ✓ ${rel}`);
    copied += 1;
  }
  return { copied, skipped };
}

const surface = copyInto(MANIFEST);
console.log(
  `\nCopied ${surface.copied} item(s)${surface.skipped ? `, skipped ${surface.skipped} existing` : ''}.`
);

// --dev: also vendor the distribution scripts so the site is a dev fixture whose
// in-site exporter exports this site's editor edits (not the pristine package).
if (dev) {
  const scripts = copyInto(SCRIPTS);
  console.log(
    `\nDev mode: copied ${scripts.copied} script(s)${scripts.skipped ? `, skipped ${scripts.skipped} existing` : ''} into scripts/.`
  );
}

/**
 * Adapt the admin layout's chrome includes to the target site.
 *
 * `admin.njk` shares the site's header/footer so the editor matches the rest
 * of the site. This repo keeps those as section components
 * (`components/sections/header/header.njk`), but a starter-derived site may
 * render its chrome from a different path (the public starter uses
 * `pages/parts/header.njk`). Copying admin.njk verbatim would then make
 * Nunjucks throw on a missing include. So rewrite admin.njk's header/footer
 * includes to whatever the target's own page layout uses.
 */
function adaptAdminChrome() {
  const adminPath = join(target, 'lib/layouts/admin.njk');
  if (!existsSync(adminPath)) {
    return;
  }
  // Find a reference page layout in the target to copy the convention from.
  const refPath = ['lib/layouts/pages/default.njk', 'lib/layouts/pages/sections.njk']
    .map((p) => join(target, p))
    .find((p) => existsSync(p));
  if (!refPath) {
    console.warn(
      '\n  ⚠ Could not find a page layout in the target to copy the header/footer\n' +
        '    convention from. Check lib/layouts/admin.njk includes resolve before building.'
    );
    return;
  }
  const ref = readFileSync(refPath, 'utf8');
  const findInclude = (word) => {
    const m = ref.match(
      new RegExp(`\\{%\\s*include\\s+["']([^"']*${word}[^"']*)["'][^%]*%\\}`, 'i')
    );
    return m ? m[1] : null;
  };
  let admin = readFileSync(adminPath, 'utf8');
  const rewritten = [];
  for (const word of ['header', 'footer']) {
    const inc = findInclude(word);
    if (!inc) {
      continue;
    }
    const re = new RegExp(`\\{%\\s*include\\s+["'][^"']*${word}[^"']*["'][^%]*%\\}`, 'i');
    if (re.test(admin) && !admin.includes(`"${inc}"`)) {
      admin = admin.replace(re, `{% include "${inc}" %}`);
      rewritten.push(`${word} → ${inc}`);
    }
  }
  if (rewritten.length) {
    writeFileSync(adminPath, admin);
    console.log(`\n  ✓ Adapted admin.njk chrome to this site: ${rewritten.join(', ')}`);
  }
}

adaptAdminChrome();

// Remaining steps that are not safe to automate.
const steps = `
Next steps (not automated — they touch your metalsmith.js and Netlify setup):

1. Install the build plugins in the target site:

     npm install ${NPM_DEPS.join(' ')}

2. Wire the plugins into metalsmith.js. Add the imports:

     import { pagesArtifact, dataArtifact } from 'metalsmith-site-data';
     import componentBundler from 'metalsmith-bundled-components';

   Emit the editor schema from the component bundler (add to its options):

     componentBundler({ /* ... */ schema: { enabled: true } })

   Place the two artifact plugins by their pipeline position:

     .use(drafts())
     .use(pagesArtifact())          // BEFORE collections()/permalinks()
     .use(collections({ /* ... */ }))
     .use(dataArtifact())           // AFTER collections(), BEFORE permalinks()
     .use(permalinks())

3. Make sure the site loads its data files into metalsmith.metadata().data
   before dataArtifact() runs (an inline loader or @metalsmith/metadata), so
   data-backed editor fields resolve.

4. Netlify (the publish path):
   - Enable Netlify Identity on the site, and set the roles that may publish.
   - Set the Function's GitHub PAT and repo env vars (see netlify/functions/
     publish.js for the names it reads). The PAT lives only in the Function,
     never in the client.
   - Run locally with \`netlify dev\` so Identity and the Function are proxied.

5. Review the POC globals near the bottom of lib/layouts/admin.njk
   (window.AUTHORS, the locale globals) and set them for this site.

6. The admin is at /admin/. Build, then open /admin/?admin=true. Sign in to
   edit and publish.
`;

console.log(steps);

if (dev) {
  console.log(`Dev fixture: the distribution scripts are now in this site's scripts/. After
editing the editor here, re-export an editor-only package from this site with:

     node scripts/export-editor.mjs <editor-only-dir>
`);
}
