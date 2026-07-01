/**
 * POST /.netlify/functions/preview
 *
 * Renders a draft's frontmatter to a full HTML page using the SAME Nunjucks
 * templates and filters the Metalsmith build uses, so the admin can show the
 * author a faithful preview of the page publishing will produce. Read-only: it
 * takes the draft the client already holds and returns HTML, touching no repo
 * state and holding no secrets, so unlike publish it needs no auth.
 *
 * Body: { frontmatter: { sections, bodyMode, bodyClasses, ... } }
 * Response: text/html — the rendered document.
 */

import { renderPage } from './lib/render-page.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let frontmatter;
  try {
    ({ frontmatter } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }
  if (!frontmatter || typeof frontmatter !== 'object') {
    return { statusCode: 400, body: 'Missing frontmatter' };
  }

  try {
    const html = renderPage(frontmatter);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html
    };
  } catch (err) {
    // A malformed section shouldn't blank the preview; surface the reason so
    // the pane can show it instead of failing silently.
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: `Preview render failed: ${err.message}`
    };
  }
};
