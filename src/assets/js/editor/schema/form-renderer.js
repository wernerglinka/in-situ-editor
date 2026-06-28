/**
 * Generic schema-driven form renderer. Walks a resolved field tree and a
 * live values object in parallel, building a control per leaf bound to its
 * value. Groups render as nested field groups; `containerFields` becomes a
 * collapsible disclosure pane; `widget: array` becomes a repeatable list of
 * subforms. Editing mutates the values object in place and calls onChange.
 *
 * This is the rendering half of the manifest-driven editor (see
 * docs/manifest-driven-editor.md). It carries no per-type knowledge: any
 * section whose field tree the build artifact describes renders here.
 */

import { isLeaf, isArrayField, isGroup, materializeDefaults } from './field-utils.js';
import { getDataArray, getCollectionNames } from './site-data-loader.js';
import { attachMarkdownOverlay } from '../markdown-overlay.js';

/**
 * The { value, label } options for a select/multiselect. A `source` resolves
 * options from the loaded site data (a `data` namespace array keyed by field,
 * or the collection names); otherwise the static `enum` is used.
 * @param {Object} node - The field definition.
 * @return {Array<{value: string, label: string}>} The options.
 */
function fieldOptions(node) {
  if (node.source && node.source.data) {
    const valueKey = node.source.valueKey || 'name';
    const labelKey = node.source.labelKey || valueKey;
    return getDataArray(node.source.data).map((item) => ({
      value: item[valueKey],
      label: item[labelKey] ?? item[valueKey]
    }));
  }
  if (node.source && node.source.collections) {
    return getCollectionNames().map((name) => ({ value: name, label: name }));
  }
  return (node.enum || []).map((value) => ({ value, label: value }));
}

/** Human headings for group keys that need more than a capitalized key. */
const GROUP_LABELS = {
  containerFields: 'Container settings',
  ctas: 'Call-to-action buttons'
};

/** @param {string} key @return {string} A heading for a group with no label. */
function groupLabel(key) {
  return GROUP_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
}

/**
 * Builds the labeled control for one leaf field, bound to obj[key].
 * @param {Object} node - The leaf field definition.
 * @param {Object} obj - The parent values object.
 * @param {string} key - The property on obj this control binds to.
 * @param {Function} onChange - Called after every edit.
 * @param {Object} ctx - Editor context (image picker callbacks).
 * @return {HTMLElement} The form-group element.
 */
function renderLeaf(node, obj, key, onChange, ctx) {
  // Widgets that build their own full layout return early; the rest produce a
  // single labelled control via INPUT_BUILDERS.
  if (node.widget === 'image' && ctx && typeof ctx.processFile === 'function') {
    return renderImage(node, obj, key, onChange, ctx);
  }
  if (node.widget === 'checkbox') {
    return renderCheckbox(node, obj, key, onChange);
  }
  if (node.widget === 'multiselect') {
    return renderMultiselect(node, obj, key, onChange);
  }

  const group = document.createElement('div');
  group.className = 'form-group section-field';

  const labelEl = document.createElement('label');
  labelEl.textContent = node.label || key;

  const build = INPUT_BUILDERS[node.widget] || INPUT_BUILDERS.text;
  group.append(labelEl, build(node, obj, key, onChange));
  if (node.help) {
    group.append(hint(node.help));
  }
  return group;
}

/**
 * Builders for the widgets that render as one control bound to obj[key].
 * Each returns the wired element; renderLeaf wraps it in the labelled group.
 * Widgets with their own layout (image, checkbox, multiselect) are not here.
 */
const INPUT_BUILDERS = {
  /** Multiline markdown/prose, with an Expand button into the overlay editor. */
  markdown(node, obj, key, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'markdown-field';
    const input = document.createElement('textarea');
    input.rows = 6;
    input.value = obj[key] ?? '';
    input.oninput = () => {
      obj[key] = input.value;
      onChange();
    };
    wrap.append(input);
    // The overlay writes back by dispatching `input` on the textarea, so the
    // oninput above is what commits the value either way.
    attachMarkdownOverlay(input, node.label || key);
    return wrap;
  },
  /** Single choice from node.enum, or from node.source (site data). */
  select(node, obj, key, onChange) {
    const input = document.createElement('select');
    if (node.source) {
      // A source-backed select starts unselected so an unset field is visible
      // rather than silently taking the first option's value.
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Select —';
      input.append(placeholder);
    }
    for (const opt of fieldOptions(node)) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      input.append(o);
    }
    input.value = obj[key] ?? node.default ?? '';
    input.onchange = () => {
      obj[key] = input.value;
      onChange();
    };
    return input;
  },
  /** Numeric input that keeps the bound value a real number. */
  number(node, obj, key, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    if (node.step !== undefined) {
      input.step = node.step;
    }
    if (node.min !== undefined) {
      input.min = node.min;
    }
    if (node.max !== undefined) {
      input.max = node.max;
    }
    input.value = obj[key] ?? '';
    input.oninput = () => {
      // An empty box stays '' (unset) rather than becoming 0.
      obj[key] = input.value === '' ? '' : Number(input.value);
      onChange();
    };
    return input;
  },
  /** Plain text; also the fallback for any not-yet-specialized widget. */
  text(node, obj, key, onChange) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = obj[key] ?? '';
    input.oninput = () => {
      obj[key] = input.value;
      onChange();
    };
    return input;
  }
};

/**
 * Builds a checkbox control, rendered label-after-control for readability.
 * @param {Object} node - The checkbox field definition.
 * @param {Object} obj - The parent values object.
 * @param {string} key - The property on obj.
 * @param {Function} onChange - Called after every edit.
 * @return {HTMLElement} The form-group element.
 */
function renderCheckbox(node, obj, key, onChange) {
  const group = document.createElement('div');
  group.className = 'form-group section-field section-field-checkbox';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(obj[key]);
  input.onchange = () => {
    obj[key] = input.checked;
    onChange();
  };
  const inline = document.createElement('label');
  inline.className = 'checkbox-label';
  inline.append(input, document.createTextNode(` ${node.label || key}`));
  group.append(inline);
  if (node.help) {
    group.append(hint(node.help));
  }
  return group;
}

/**
 * Builds a multi-select widget: one checkbox per `enum` value, binding an
 * array of the selected values in enum order. For closed sets like
 * social-shares platforms, where the section wants an array of known strings.
 * @param {Object} node - The multiselect field definition (has `enum`).
 * @param {Object} obj - The parent values object.
 * @param {string} key - The property on obj (an array).
 * @param {Function} onChange - Called after every edit.
 * @return {HTMLElement} The form-group element.
 */
function renderMultiselect(node, obj, key, onChange) {
  const group = document.createElement('div');
  group.className = 'form-group section-field section-field-multiselect';
  const labelEl = document.createElement('label');
  labelEl.textContent = node.label || key;
  group.append(labelEl);

  if (!Array.isArray(obj[key])) {
    obj[key] = Array.isArray(node.default) ? [ ...node.default ] : [];
  }
  const options = document.createElement('div');
  options.className = 'multiselect-options';
  for (const opt of node.enum || []) {
    const optLabel = document.createElement('label');
    optLabel.className = 'checkbox-label';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = obj[key].includes(opt);
    box.onchange = () => {
      const set = new Set(obj[key]);
      if (box.checked) {
        set.add(opt);
      } else {
        set.delete(opt);
      }
      // Keep enum order so the serialized array is stable and predictable.
      obj[key] = (node.enum || []).filter((v) => set.has(v));
      onChange();
    };
    optLabel.append(box, document.createTextNode(` ${opt}`));
    options.append(optLabel);
  }
  group.append(options);
  if (node.help) {
    group.append(hint(node.help));
  }
  return group;
}

/**
 * Builds the image widget: a text input (for URLs and hydrated values), a
 * file picker that uploads through the editor's image pipeline and stores
 * the filename, and a thumbnail. On upload it fills empty sibling alt and
 * caption fields, matching the legacy image section's convenience.
 * @param {Object} node - The image field definition.
 * @param {Object} obj - The parent group (e.g. the `image` group).
 * @param {string} key - The image property (e.g. `src`).
 * @param {Function} onChange - Called after every edit.
 * @param {Object} ctx - { processFile(file), resolveThumb(value) }.
 * @return {HTMLElement} The form-group element.
 */
function renderImage(node, obj, key, onChange, ctx) {
  const group = document.createElement('div');
  group.className = 'form-group section-field section-image-field';

  const labelEl = document.createElement('label');
  labelEl.textContent = node.label || key;

  const thumb = document.createElement('img');
  thumb.className = 'section-thumb';
  thumb.alt = '';
  thumb.hidden = true;
  // A hydrated path that doesn't resolve (e.g. an image not in this draft)
  // should not leave a broken-image icon.
  thumb.onerror = () => {
    thumb.hidden = true;
  };

  const refreshThumb = () => {
    const value = obj[key];
    if (!value) {
      thumb.hidden = true;
      return;
    }
    Promise.resolve(ctx.resolveThumb ? ctx.resolveThumb(value) : null).then((url) => {
      const src = url || (/^(https?:|\/|data:)/i.test(value) ? value : null);
      thumb.hidden = !src;
      if (src) {
        thumb.src = src;
      }
    });
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.value = obj[key] ?? '';
  input.placeholder = 'Filename or URL';
  input.oninput = () => {
    obj[key] = input.value;
    refreshThumb();
    onChange();
  };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Choose image';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Processing...';
    try {
      const info = await ctx.processFile(file);
      if (info && info.name) {
        obj[key] = info.name;
        input.value = info.name;
        if ('alt' in obj && !obj.alt && info.alt) {
          obj.alt = info.alt;
        }
        if ('caption' in obj && !obj.caption && info.caption) {
          obj.caption = info.caption;
        }
        onChange();
        // Re-render so auto-filled alt/caption inputs reflect the new
        // values; fall back to just refreshing the thumbnail.
        if (typeof ctx.rerender === 'function') {
          ctx.rerender();
        } else {
          refreshThumb();
        }
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Choose image';
    }
  };
  btn.onclick = () => fileInput.click();

  const picker = document.createElement('div');
  picker.className = 'section-image-picker';
  picker.append(thumb, btn, fileInput);

  group.append(labelEl, input, picker);
  if (node.help) {
    group.append(hint(node.help));
  }
  refreshThumb();
  return group;
}

/** @param {string} text @return {HTMLElement} A field hint paragraph. */
function hint(text) {
  const p = document.createElement('p');
  p.className = 'field-hint';
  p.textContent = text;
  return p;
}

/**
 * Renders a repeatable array field: one subform per entry with move/remove
 * controls, plus an add button. Structural edits re-render this widget in
 * place so the rest of the form is undisturbed.
 * @param {Object} node - The array field definition (has `items`).
 * @param {Object} obj - The parent values object.
 * @param {string} key - The array property on obj.
 * @param {Function} onChange - Called after every edit.
 * @param {Object} ctx - Editor context, threaded to nested fields.
 * @return {HTMLElement} The array widget element.
 */
function renderArray(node, obj, key, onChange, ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'section-array';

  const heading = document.createElement('div');
  heading.className = 'section-array-label';
  heading.textContent = node.label || groupLabel(key);
  wrap.append(heading);

  const list = document.createElement('div');
  list.className = 'section-array-items';
  wrap.append(list);

  if (!Array.isArray(obj[key])) {
    obj[key] = [];
  }

  const renderItems = () => {
    list.replaceChildren();
    obj[key].forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'section-array-item';

      const controls = document.createElement('div');
      controls.className = 'section-array-item-controls';
      for (const [ act, symbol, title ] of [
        [ 'up', '↑', 'Move up' ],
        [ 'down', '↓', 'Move down' ],
        [ 'remove', '✕', 'Remove' ]
      ]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn section-card-control';
        b.textContent = symbol;
        b.title = title;
        b.disabled = (act === 'up' && index === 0) || (act === 'down' && index === obj[key].length - 1);
        b.onclick = () => {
          if (act === 'remove') {
            obj[key].splice(index, 1);
          } else {
            const to = act === 'up' ? index - 1 : index + 1;
            [ obj[key][index], obj[key][to] ] = [ obj[key][to], obj[key][index] ];
          }
          renderItems();
          onChange();
        };
        controls.append(b);
      }
      itemEl.append(controls);
      itemEl.append(renderFields(node.items, item, onChange, ctx));
      list.append(itemEl);
    });
  };
  renderItems();

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn section-array-add';
  addBtn.textContent = `+ Add ${(node.label || key).replace(/s$/, '')}`;
  addBtn.onclick = () => {
    obj[key].push(materializeDefaults(node.items));
    renderItems();
    onChange();
  };
  wrap.append(addBtn);
  return wrap;
}

/**
 * Renders a field tree into a fragment, binding controls to the values
 * object. The recursive core of the form generator.
 * @param {Object} fields - The field tree.
 * @param {Object} values - The values object to bind to (mutated in place).
 * @param {Function} onChange - Called after every edit.
 * @param {Object} [ctx] - Editor context (image picker callbacks), threaded
 *   to every nested control.
 * @return {DocumentFragment} The rendered controls.
 */
export function renderFields(fields, values, onChange, ctx = {}) {
  const frag = document.createDocumentFragment();
  const discriminator = findDiscriminator(fields);
  for (const [ key, node ] of Object.entries(fields)) {
    // A discriminator's variant groups are mutually exclusive: show only the
    // one the discriminator currently selects (e.g. multi-media's mediaType
    // picks image / video / audio / icon / lottie).
    if (discriminator && discriminator.variants.has(key) && key !== values[discriminator.key]) {
      continue;
    }
    if (isArrayField(node)) {
      frag.append(renderArray(node, values, key, onChange, ctx));
    } else if (isLeaf(node)) {
      // Changing the discriminator re-renders the card so the shown variant
      // follows the selection.
      const leafOnChange =
        discriminator && key === discriminator.key && typeof ctx.rerender === 'function'
          ? () => {
              onChange();
              ctx.rerender();
            }
          : onChange;
      frag.append(renderLeaf(node, values, key, leafOnChange, ctx));
    } else if (isGroup(node)) {
      if (!values[key] || typeof values[key] !== 'object') {
        values[key] = materializeDefaults(node);
      }
      frag.append(renderGroup(key, node, values[key], onChange, ctx));
    }
  }
  return frag;
}

/**
 * Detects a discriminator field: a `select` whose enum values name sibling
 * groups, so the groups are variants of one another and only the selected
 * one should show. Returns the discriminator key and its variant group keys,
 * or null when the tree has no such field.
 * @param {Object} fields - The field tree.
 * @return {{ key: string, variants: Set<string> }|null}
 */
function findDiscriminator(fields) {
  for (const [ key, node ] of Object.entries(fields)) {
    if (!isLeaf(node) || node.widget !== 'select' || !Array.isArray(node.enum)) {
      continue;
    }
    const present = node.enum.filter((value) => fields[value] !== undefined);
    const variants = new Set(present.filter((value) => isGroup(fields[value])));
    // Treat it as a discriminator only when its options cleanly map onto
    // sibling groups (every present option is a group, at least two of them),
    // so ordinary selects like titleTag are never misread.
    if (variants.size >= 2 && variants.size === present.length) {
      return { key, variants };
    }
  }
  return null;
}

/**
 * Renders a group of nested fields. `containerFields` collapses into a
 * <details> disclosure; other groups render as a titled field group.
 * @param {string} key - The group's key.
 * @param {Object} node - The group's field tree.
 * @param {Object} groupValues - The group's values object.
 * @param {Function} onChange - Called after every edit.
 * @param {Object} ctx - Editor context, threaded to nested fields.
 * @return {HTMLElement} The group element.
 */
function renderGroup(key, node, groupValues, onChange, ctx) {
  if (key === 'containerFields') {
    const details = document.createElement('details');
    details.className = 'section-container-settings';
    const summary = document.createElement('summary');
    summary.textContent = groupLabel(key);
    details.append(summary);
    details.append(renderFields(node, groupValues, onChange, ctx));
    return details;
  }

  const fieldset = document.createElement('div');
  fieldset.className = 'section-field-group';
  const title = document.createElement('div');
  title.className = 'section-field-group-label';
  title.textContent = groupLabel(key);
  fieldset.append(title);
  fieldset.append(renderFields(node, groupValues, onChange, ctx));
  return fieldset;
}
