/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { fileSave } from 'browser-fs-access';
import { getImage } from '../utils/db-storage.js';
import { generateMarkdown } from '../utils/markdown-utils.js';

/**
 * Generates and downloads a ZIP archive containing the post Markdown and images.
 * @param {Object} draft - The draft object.
 * @param {string} title - The post title.
 * @param {string} description - The post description.
 * @param {string} date - The post date.
 * @param {string} tagsValue - Comma-separated tags string.
 * @param {string} content - The post content.
 * @param {Array<Object>} [classifierResults=[]] - AI classifier results.
 * @return {Promise<void>}
 */
export async function downloadZIP(
  draft,
  title,
  description,
  date,
  tagsValue,
  content,
  classifierResults = [],
) {
  if (!draft) {
    throw new Error('No draft data provided for ZIP export.');
  }
  const slug = (title || 'untitled')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
  const md = generateMarkdown(
    draft,
    title,
    description,
    date,
    tagsValue,
    content,
    classifierResults,
  );

  // Mirror this repo's layout so the archive can be unzipped at the repo
  // root: the post at src/blog/<slug>.md, images where the emitted
  // /assets/images/blog/<slug>/ URLs and the publish Function expect them.
  const zip = new JSZip();
  zip.file(`src/blog/${slug}.md`, md);

  if (draft.imageFiles && draft.imageFiles.length > 0) {
    const imageFolder = zip.folder(`src/assets/images/blog/${slug}`);
    for (const img of draft.imageFiles) {
      const data = await getImage(img.id);
      if (data) {
        imageFolder.file(img.name, data);
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  await fileSave(blob, {
    fileName: `${slug}.zip`,
    extensions: ['.zip'],
    description: 'Blog ZIP Archive',
  });
}
