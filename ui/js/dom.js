// Small DOM helpers shared by every view.
//
// All rendering goes through h(), which builds elements and text nodes
// directly. Nothing is ever assigned to innerHTML, so text typed by the user
// (instructions, comments, task titles) can never be interpreted as HTML.

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [props]  class, dataset, on<Event> handlers, or plain attributes
 * @param {...any} children Nodes, strings, numbers, arrays; null/false are skipped
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** A titled card, the basic panel used throughout the layout. */
export function card(title, body, { actions = null, className = '' } = {}) {
  return h('section', { class: `card ${className}`.trim() },
    h('header', { class: 'card__head' },
      h('h2', { class: 'card__title' }, title),
      actions),
    body);
}

/** Coloured status pill, e.g. "In Progress", "Completed". */
export function pill(text, tone = 'neutral') {
  return h('span', { class: `pill pill--${tone}` }, text);
}

/** Two-column definition list from [label, value] pairs. */
export function keyValues(rows) {
  return h('dl', { class: 'kv' },
    rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

/** Current local time as "YYYY-MM-DD HH:MM", the format used in mock data. */
export function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
