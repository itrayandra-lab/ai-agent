// Keeps the interface icon language consistent: emoji used as UI ornaments become the same line icons
// as the rest of the app. Agent-written content (.md), avatars and form fields are never rewritten.
import { icon, EMOJI_ICON } from './icons.js';

const PICTO = /(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)/gu;
const SKIP = '.md, .ava, .keep-emoji, textarea, input, option, select, script, style, svg, [contenteditable="true"]';

function convert(node) {
  const text = node.nodeValue;
  PICTO.lastIndex = 0;
  if (!text || !PICTO.test(text)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  PICTO.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0; let m;
  while ((m = PICTO.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const name = EMOJI_ICON[m[0].replace(/️/g, '')];
    if (name) {
      const s = document.createElement('span');
      s.className = 'emi'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = icon(name, '1.1em');
      frag.append(s);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

function sweep(root) {
  if (root.nodeType === Node.TEXT_NODE) return convert(root);
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest?.(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(convert);
}

export function startIconizer(target = document.body) {
  sweep(target);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') convert(m.target);
      else m.addedNodes.forEach(sweep);
    }
  }).observe(target, { childList: true, subtree: true, characterData: true });
}
