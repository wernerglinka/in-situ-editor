# Theory of Operations — the in-situ editor development flow

This document explains how the in-situ editor is developed, packaged, published,
and installed. It lives in the **published package repo**
(`@wernerglinka/in-situ-editor`), which is a *generated* artifact — almost
everything around it is produced by a script in a separate development repo. If
you are reading this in the published package and wondering "where does this code
actually come from and how do I change it," this is the answer.

`docs/` sits outside the editor's distributable surface (the `MANIFEST`). Most
of it is hand-owned and a re-export never touches it — including this file. The
two exceptions are the consumer docs `editor-guide.md` and `validation.md`, which
are maintained in the dev fixture and copied into this `docs/` on every export
(see Flow 2). Edit those two in the fixture, not here.


## The shape of the system: three kinds of repository

The editor exists across three distinct places, each with a different job.

1. **A dev fixture** — `wernerglinka/in-situ-editor-dev`, on disk at
   `~/Documents/Projects/metalsmith/in-situ-editor-dev`, is where the editor is
   developed and exercised today. A fixture is nothing special: it is just a
   starter-derived Metalsmith site with the editor imported into it. You run the
   site, open the admin, author content, and watch the editor work against a real
   build. Editor source changes happen in a fixture and flow to the package by
   export. The current one is not privileged — any starter site with the editor
   in it can serve as a fixture, which is the point of keeping the toolkit in the
   editor repo (next).

2. **The published package** — `wernerglinka/in-situ-editor`, on disk at
   `~/Documents/Projects/metalsmith/in-situ-editor` (this repo). A
   zero-dependency, editor-only instance: the editor's distributable surface plus
   the distribution scripts in `scripts/` — the installer `bin`
   (`install-editor.mjs`), the shared `editor-manifest.mjs`, and the exporter
   (`export-editor.mjs`). The whole toolkit lives with the editor by design:
   import the editor into a starter site and you can either leave it as a plain
   editing setup or do development on the editor and re-export, with no dependency
   on a particular pre-existing fixture being kept around. It is published to npm
   as `@wernerglinka/in-situ-editor`. Its editor surface and `export-editor.mjs`
   are *generated from a fixture*; its identity files (`package.json`,
   `README.md`, `LICENSE`, package-authored `docs/`) are hand-owned and kept
   across regenerations.

3. **A consuming site** — any starter-derived Metalsmith site (cloned from
   `metalsmith2025-structured-content-starter`). The editor is *vendored into* the
   site by the installer: the site owns and commits the copied editor files from
   the moment they land. That is the whole point of an "in-situ" editor — it is
   not a runtime dependency, it is copied in and becomes part of the site.

```
  in-situ-editor-dev            in-situ-editor                a consuming site
  (full Metalsmith site,        (zero-dep npm package,        (starter-derived
   private dev fixture)          editor surface + bin)         Metalsmith site)
        │                              │                              │
        │  npm run export -- <dir>     │   npx @wernerglinka/...       │
        ├─────────────────────────────►                              │
        │   materialize the package    │                              │
        │                              │  vendor the editor in        │
        │                              ├─────────────────────────────►
        │                              │   site owns the copy         │
   develop here                  publish here                   run here
```


## Why the split exists

The editor is developed inside a real site because there is no other honest way
to exercise it: it reads the site's emitted `components-schema.json`, mounts
against real rendered pages, and publishes through a real Netlify Function. A
full site is the test harness.

But the *thing people install* must be editor-only and zero-dependency. A site
running `npx @wernerglinka/in-situ-editor` must not drag in Metalsmith, Shiki,
sharp, or any of the fixture's build toolchain. So the publishable package is a
constant, minimal instance carved out of the fixture, not the fixture itself.

The split keeps both honest: the fixture can change freely as a development
environment, and the package stays a clean editor surface.


## The single source of truth for the surface: `editor-manifest.mjs`

`scripts/editor-manifest.mjs` exports `MANIFEST` — the list of paths that make up
the editor's distributable surface (the admin page and its `admin.njk` layout,
the editor JS tree and its vendored libraries, `admin-styles.css`, and the
Netlify publish backend). It also exports `NPM_DEPS` — the build plugins a
consuming site must install (`metalsmith-site-data`,
`metalsmith-bundled-components`) — and `SCRIPTS`, the distribution scripts the
package carries (the installer, this manifest, and the exporter). The exporter
folds `SCRIPTS` into the package payload; a `--dev` install copies the same set
into a site (see Flow 4).

Both the **exporter** (`export-editor.mjs`) and the **installer**
(`install-editor.mjs`, this package's `bin`) import this one file.
That is the mechanism that stops the two from drifting: the same paths that get
copied *out of* the fixture into the package are the paths the installer copies
*out of* the package into a site. Add a file to the editor and you add one line
to the manifest; both flows pick it up.


## Flow 1 — develop (in the fixture)

Editor code is written and tested in `in-situ-editor-dev`. Run the site's normal
Metalsmith build, open `/admin/?admin=true`, and the editor mounts against the
fixture's own emitted schema. Because the fixture is a complete site, every part
of the editor — form generation from manifests, hydration, the section builder,
AI-assisted fields, the publish path — can be exercised end to end before
anything is exported.

Two source-of-truth rules govern changes:

- **Editor frontend/backend code** changes in the fixture, then flows to the
  package by export. Never hand-edit the editor surface in this published repo;
  it will be overwritten on the next export. Change it in the fixture.
- **Component manifests / rendering** (the `fields`/`validation` contract a
  section exposes) change in the canonical `nunjucks-components` library first
  (the source of truth for components), then sync into the fixture.


## Flow 2 — export (fixture → package)

From the fixture: `npm run export -- <editor-only-dir>` (i.e.
`node scripts/export-editor.mjs <dir>`). This materializes the package. Precisely
what it does:

- **Copies the surface + installer scripts**, force-replacing each path
  (`rmSync` then `cpSync`). So edits *and deletions* in the fixture propagate to
  the package. The installer is re-marked executable after copy.
- **Refreshes `package.json`'s `files` whitelist** to match the manifest, but
  leaves every other field alone. A newly added surface path becomes publishable
  without touching the package's version, description, or release config.
- **Scaffolds identity files only if absent** — `package.json` (full scaffold),
  `LICENSE` (copied from the fixture), `README.md`, and `.gitignore`. Once they
  exist in the package, they are hand-owned and preserved.
- **Copies the consumer docs** — `docs/editor-guide.md` and `docs/validation.md`
  are force-copied from the fixture (they are maintained there). Other docs in
  this folder, including `theory-of-operations.md`, are package-authored and
  left untouched.

### What a re-export overwrites vs. preserves

| In the package repo                         | On re-export                          |
|---------------------------------------------|---------------------------------------|
| Editor surface (everything in `MANIFEST`)   | **Overwritten** (deletions propagate) |
| `install-editor.mjs`, `editor-manifest.mjs` | **Overwritten**                       |
| `package.json` — `files` array              | **Regenerated** from the manifest     |
| `package.json` — all other fields           | Preserved                             |
| `README.md`, `LICENSE`, `.gitignore`        | Preserved (only created if absent)    |
| `docs/editor-guide.md`, `docs/validation.md`| **Overwritten** (copied from fixture) |
| `docs/` (package-authored), `.git`, others  | Untouched                             |

Two consequences worth remembering: a hand-edit to the `files` array is the one
`package.json` change that does *not* survive (the manifest wins); and the export
never deletes orphans — if you remove a path from the manifest, the stale copy
already in the package lingers and must be deleted by hand (it just stops being
in `files`).


## Flow 3 — publish (the package)

Done in this repo, by hand, because the steps touch git remotes and npm:

```sh
git add -A && git commit -m "Editor surface <version>"
# remote points at github.com/wernerglinka/in-situ-editor
npm publish            # publishes @wernerglinka/in-situ-editor (zero-dependency)
```

The package owns its own version and release config; bump the version here, not
in the fixture. `publishConfig.access` is `public` because the name is scoped.

> Remote hygiene: the fixture and the package are *different* GitHub repos that
> have been crossed before. Verify `git remote -v` before any push —
> `in-situ-editor` is the published package, `in-situ-editor-dev` is the fixture.
> A push from the wrong working copy can overwrite the published package with
> fixture history.


## Flow 4 — install (package → consuming site)

Inside a freshly cloned starter-derived site:

```sh
npx @wernerglinka/in-situ-editor [--force] [--dev]
```

The installer (`install-editor.mjs`) copies the manifest surface into the same
relative paths in the site. Existing files are skipped unless `--force` is given,
so re-running to update means `--force`. The editor is now part of the site; the
site owns and commits it.

With `--dev`, the installer additionally copies the distribution scripts
(`SCRIPTS`) into the site's `scripts/`, turning it into a self-contained dev
fixture. This matters because the exporter derives its source root from its own
location: run from a site's `scripts/`, it exports *that site's* editor edits;
run from `node_modules`, it would only re-emit the pristine package. So a plain
content install stays free of editor tooling, and `--dev` is the one flag that
makes a site a place you can develop the editor and re-export from. This is how a
new fixture comes to exist — a starter site plus a `--dev` editor install — with
no dependence on any older fixture.

The one non-verbatim step: **chrome adaptation.** `admin.njk` is authored against
the fixture's own header/footer include convention, but a starter-derived site
renders its chrome differently. Copying `admin.njk` verbatim would make Nunjucks
throw on a missing include. So the installer reads the target site's own page
layout (`pages/default.njk`, falling back to `pages/sections.njk`) and rewrites
`admin.njk`'s header/footer includes to that site's convention.

The installer does **not** patch `metalsmith.js`, the site's `package.json`, or
any Netlify dashboard settings — those are too site-specific to touch safely. It
prints them instead. The manual wiring it prints:

1. `npm install metalsmith-site-data metalsmith-bundled-components`
2. Emit the editor schema from `metalsmith-bundled-components`
   (`schema: { enabled: true }`), and wire the two `metalsmith-site-data`
   exports into the pipeline: `pagesArtifact()` **before** `collections()`, and
   `dataArtifact()` **after** `collections()` and before `permalinks()`.
3. Load the site's data files into `metadata().data` before `dataArtifact()`
   runs (so the data-driven field pickers light up).
4. Set up Netlify Identity and the publish Function's GitHub PAT (the PAT lives
   only in the Function, never in the client).
5. Review the POC globals in `lib/layouts/admin.njk` (`window.AUTHORS`, locales).
6. Build, then open `/admin/?admin=true`, sign in, edit, and publish.


## How the editor runs at the site (briefly)

Once installed and wired, the editor is just part of a normal Metalsmith build.
`metalsmith-bundled-components` emits a `components-schema.json` describing each
section's editable fields; `metalsmith-site-data` emits build artifacts
(`pages.json`, `site-data.json`) that power "Open from site" and the data-driven
field pickers. The admin page loads the editor frontend, which generates forms
from the schema, hydrates them from existing page content, and serializes edits
back. Publishing posts through the Netlify Function, which commits to the site's
GitHub repo using the server-held PAT.

The contract that stays aligned across sites is the emitted
`components-schema.json`, not the copied files. A site is free to modify any
component's rendering and owns it from then on; if a structural change alters
which frontmatter fields a component consumes, the component's manifest
`fields`/`validation` must be updated so the editable surface stays honest.


## Quick reference

- Develop the editor: in `in-situ-editor-dev` (the fixture).
- Regenerate this package: `npm run export -- <dir>` from the fixture.
- Change the distributable file list: edit `scripts/editor-manifest.mjs`.
- Publish: `npm publish` from this repo, after bumping the version here.
- Install into a site: `npx @wernerglinka/in-situ-editor` (add `--force` to
  update).
- Never hand-edit the editor surface — or `docs/editor-guide.md` /
  `docs/validation.md` — in this repo; edit those in the fixture and re-export.
  `README.md`, `LICENSE`, `package.json` identity, and the package-authored docs
  (like this file) are the hand-owned parts.
