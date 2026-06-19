/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import { cleanupOrphanedImages } from '../utils/db-storage.js';

/**
 * Collects every image filename a draft's sections could reference. Schema
 * sections store an uploaded image by filename in an image field (image.src,
 * slides[].image.src, video.tn, containerFields.background.image, ...), so
 * this walks all section values and records each string by basename. Pulling
 * in non-image strings (titles and the like) is harmless: the set is only
 * used to decide which uploaded files to keep, and keeping a file is the safe
 * outcome. Deleting one that is still referenced is not.
 * @param {Array<Object>} sections - The draft's sections.
 * @return {Set<string>} Referenced image basenames.
 */
function collectImageNames(sections) {
  const names = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (v) {
        names.add(v.split('/').pop());
      }
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  sections.forEach(walk);
  return names;
}

/**
 * Performs housekeeping on drafts by cleaning up orphaned images and
 * ensuring only referenced images are kept in the draft metadata.
 * @param {Array<Object>} drafts - The list of drafts.
 * @param {Function} saveDraftsFn - Function to save drafts to storage.
 */
export async function performHousekeeping(drafts, saveDraftsFn) {
  const allValidImageIds = [];
  drafts.forEach((draft) => {
    if (!draft.imageFiles || draft.imageFiles.length === 0) {
      return;
    }
    // An uploaded file is live if a section references its name, or the
    // legacy markdown body referenced it as ./<name>.
    const referenced = collectImageNames(draft.sections || []);
    draft.imageFiles = draft.imageFiles.filter((img) => {
      const isReferenced = referenced.has(img.name) || (draft.content || '').includes(`./${img.name}`);
      if (isReferenced) {
        allValidImageIds.push(img.id);
      }
      return isReferenced;
    });
  });
  saveDraftsFn();
  await cleanupOrphanedImages(allValidImageIds);
}
