# @wernerglinka/in-situ-editor

The in-situ editor: an in-site, section-builder admin for Metalsmith
structured-content sites, with Chrome built-in AI and
Netlify Identity publishing.

[![npm: version][npm-badge]][npm-url]
[![license: MIT][license-badge]][license-url]

This package is the editor's published, editor-only instance. It is generated
from the editor's dev fixture by `export-editor.mjs`; do not hand-edit the
copied surface here — change it in the fixture and re-export.

## Install

Inside a freshly cloned starter-derived site:

```sh
npx @wernerglinka/in-situ-editor
```

This vendors the editor into your site (you own and commit the copied files —
that is the point of an in-situ editor) and prints the remaining wiring:

1. `npm install metalsmith-site-data metalsmith-bundled-components`
2. Wire the plugins into `metalsmith.js` (emit the editor schema from
   `metalsmith-bundled-components` with `schema: { enabled: true }`; place
   `pagesArtifact()` before `collections()` and `dataArtifact()` after it,
   before `permalinks()`).
3. Make sure the site loads its data files into `metadata().data` before
   `dataArtifact()` runs.
4. Set up Netlify Identity + the publish Function's GitHub PAT (the PAT lives
   only in the Function, never the client).
5. Review the POC globals in `lib/layouts/admin.njk` (`window.AUTHORS`, locales).
6. Build, then open `/admin/?admin=true`. Sign in to edit and publish.

Re-run with `--force` to overwrite an existing install.

Add `--dev` to also copy the distribution scripts into the site, turning it into
a self-contained dev fixture you can develop the editor in and re-export from
(`node scripts/export-editor.mjs <dir>`). A plain content install omits it.

## Author

[werner@glinka.co](https://github.com/wernerglinka)

## License

[MIT](LICENSE)


[npm-badge]: https://img.shields.io/npm/v/@wernerglinka/in-situ-editor.svg
[npm-url]: https://www.npmjs.com/package/@wernerglinka/in-situ-editor
[license-badge]: https://img.shields.io/npm/l/@wernerglinka/in-situ-editor.svg
[license-url]: LICENSE