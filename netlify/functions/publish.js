/**
 * POST /.netlify/functions/publish
 *
 * Publishes a draft from the admin to the GitHub repo backing the site.
 * The PAT lives in env vars; clients never see it. Identity is supplied
 * by Netlify Identity (Bearer JWT). Role checked here, not in the UI,
 * so an editor cannot bypass the check by toggling DOM.
 *
 * Body:
 *   {
 *     mode: 'pr' | 'direct',
 *     slug: 'my-post',
 *     markdown: '---\n...frontmatter...\n---\n\nbody',
 *     images?: [{ name, base64 }]
 *   }
 *
 * Response: { url } — PR url for mode='pr', commit url for mode='direct'.
 */

const GH_API = 'https://api.github.com';

/**
 * Allowlisted publish destinations per page type. The directories are fixed
 * here, never taken from the client, so a crafted payload cannot redirect a
 * write outside these roots. A blog post lives under src/blog/; a page at the
 * top level. Combined with the strict slug check, the only writable paths are
 * <dir>/<slug>.md and <imageDir>/<slug>/<image-name>.
 */
const PAGE_DEST = {
  post: { dir: 'src/blog', imageDir: 'src/assets/images/blog' },
  page: { dir: 'src', imageDir: 'src/assets/images' }
};

/**
 * @param {number} status
 * @param {object} body
 */
const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Thin wrapper around fetch() that throws with the GitHub error message.
 */
async function gh(repo, path, init = {}) {
  const method = init.method || 'GET';
  const url = path.startsWith('https://') ? path : `${GH_API}/repos/${repo}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    let msg;
    try {
      msg = JSON.parse(txt).message;
    } catch {
      msg = txt;
    }
    // Include the failing operation so a 403/404 points at the exact call
    // (and thus which PAT permission is short, e.g. POST /pulls).
    throw new Error(`GitHub ${res.status} on ${method} ${path}: ${msg || res.statusText}`);
  }
  return res.json();
}

/**
 * Look up the SHA of a file on a given ref, or undefined if it doesn't exist.
 */
async function getSha(repo, path, ref) {
  try {
    const file = await gh(repo, `/contents/${path}?ref=${encodeURIComponent(ref)}`);
    return file.sha;
  } catch {
    return undefined;
  }
}

async function putContent(repo, branch, path, base64Content, message) {
  const sha = await getSha(repo, path, branch);
  return gh(repo, `/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: base64Content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return json(401, { error: 'Not signed in' });
  }
  const roles = (user.app_metadata && user.app_metadata.roles) || [];

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { mode, slug, markdown, images } = payload;
  const pageType = payload.pageType || 'post';
  if (!mode || !slug || !markdown) {
    return json(400, { error: 'Missing required fields: mode, slug, markdown' });
  }
  if (mode !== 'pr' && mode !== 'direct') {
    return json(400, { error: 'mode must be "pr" or "direct"' });
  }
  const dest = PAGE_DEST[pageType];
  if (!dest) {
    return json(400, { error: `pageType must be one of: ${Object.keys(PAGE_DEST).join(', ')}` });
  }
  // slug and image names become Git paths; validate before any path is built
  // so a crafted payload cannot write outside the allowlisted destination and
  // its image folder (e.g. .github/workflows/ on a PR branch).
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) {
    return json(400, { error: 'slug must be 1-100 lowercase letters, digits, or hyphens' });
  }
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img && img.name && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/.test(img.name)) {
        return json(400, { error: `Invalid image name: ${String(img.name).slice(0, 100)}` });
      }
    }
  }
  if (mode === 'direct' && !roles.includes('admin')) {
    return json(403, { error: 'Direct commit requires admin role' });
  }

  const repo = process.env.GITHUB_REPO;
  if (!repo || !process.env.GITHUB_PAT) {
    return json(500, { error: 'Server is missing GITHUB_REPO or GITHUB_PAT' });
  }

  try {
    const repoInfo = await gh(repo, '');
    const baseBranch = repoInfo.default_branch;

    const targetBranch =
      mode === 'direct' ? baseBranch : `post-${slug}-${Date.now()}`;

    if (mode === 'pr') {
      const branchInfo = await gh(repo, `/branches/${baseBranch}`);
      await gh(repo, '/git/refs', {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: branchInfo.commit.sha,
        }),
      });
    }

    const postPath = `${dest.dir}/${slug}.md`;
    const markdownBase64 = Buffer.from(markdown, 'utf8').toString('base64');
    const existingSha = await getSha(repo, postPath, targetBranch);
    const commitMessage = `${existingSha ? 'Update' : 'Add'} ${pageType} ${slug}`;

    const commit = await putContent(
      repo,
      targetBranch,
      postPath,
      markdownBase64,
      commitMessage,
    );

    if (Array.isArray(images)) {
      for (const img of images) {
        if (!img || !img.name || !img.base64) continue;
        const imgPath = `${dest.imageDir}/${slug}/${img.name}`;
        await putContent(
          repo,
          targetBranch,
          imgPath,
          img.base64,
          `${(await getSha(repo, imgPath, targetBranch)) ? 'Update' : 'Add'} image ${img.name}`,
        );
      }
    }

    if (mode === 'pr') {
      const pr = await gh(repo, '/pulls', {
        method: 'POST',
        body: JSON.stringify({
          title: `${existingSha ? 'Update' : 'Post'}: ${slug}`,
          head: targetBranch,
          base: baseBranch,
          body: `Submitted by ${user.email || 'editor'} via the in-situ-editor admin.`,
        }),
      });
      return json(200, { mode: 'pr', url: pr.html_url, number: pr.number });
    }

    return json(200, {
      mode: 'direct',
      url: commit.commit && commit.commit.html_url,
      sha: commit.commit && commit.commit.sha,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message || String(err) });
  }
};
