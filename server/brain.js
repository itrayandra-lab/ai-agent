// Company brain: markdown notes connected by [[wikilinks]]; lightweight keyword search.
import * as store from './store.js';
import { slug } from './seed.js';

export const linksOf = (content) => [...String(content).matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((m) => m[1].trim());

/** where a note came from decides whether agents may treat it as fact: owner/drive/system = verified, agent = draft, dummy = archived (never used) */
export const TRUST = { owner: 'terverifikasi · Owner', drive: 'terverifikasi · Google Drive', system: 'terverifikasi · Sistem', agent: 'draf hasil agen (belum diverifikasi)' };
export const isVerified = (n) => ['owner', 'drive', 'system'].includes(n?.kb);
const trustOf = (n) => TRUST[n.kb] || TRUST.agent;

export const canRead = (n, { employeeId, audience = 'internal' } = {}) => !!n && !n.archived && (n.visibility !== 'private' || (!!employeeId && n.authorId === employeeId && store.get().employees.find(e => e.id === employeeId)?.type === 'human')) && (audience !== 'public' || n.visibility === 'public');

const tokenize = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

export function search(query, { limit = 5, scopeEmployeeId, verifiedOnly = false, audience = 'internal' } = {}) {
  const q = tokenize(query);
  if (!q.length) return [];
  // archived demo notes are never searched; private notes never reach agents; a public-facing agent sees public notes only
  const notes = store.get().notes.filter((n) => canRead(n, { audience }) && (!verifiedOnly || isVerified(n)));
  return notes
    .map((n) => {
      const title = n.title.toLowerCase();
      const body = n.content.toLowerCase();
      let score = 0;
      for (const w of q) {
        if (title.includes(w)) score += 5;
        const hits = body.split(w).length - 1;
        score += Math.min(hits, 5);
        if (n.tags?.some((t) => t.includes(w))) score += 2;
      }
      if (scopeEmployeeId && n.folder === `Memori` && n.authorId === scopeEmployeeId) score += 2;
      if (n.folder === 'SOP' || n.folder === 'Company') score *= 1.2;
      if (isVerified(n)) score *= 1.6;   // facts from the Owner, Drive or the system rank above agent drafts
      return { n, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ n }) => ({ title: n.title, folder: n.folder, trust: trustOf(n), verified: isVerified(n), snippet: n.content.replace(/\s+/g, ' ').slice(0, 280) }));
}

export function findNote(title, { archived = false } = {}) {
  const s = slug(title);
  const notes = store.get().notes.filter((n) => archived || !n.archived);
  return notes.find((n) => n.id === s) || notes.find((n) => n.title.toLowerCase() === String(title).toLowerCase());
}

export function writeNote({ title, content, folder = 'Notes', tags = [], authorId, append = false, kb, visibility }) {
  const author = store.get().employees.find((e) => e.id === authorId);
  kb = kb || (author?.type === 'human' ? 'owner' : authorId === 'system' ? 'system' : 'agent');
  title = String(title).replace(/[[\]|#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Tanpa judul'; // keep titles wikilink-safe
  const existing = findNote(title);
  const t = Date.now();
  if (existing) {
    if (author?.type === 'ai' && (isVerified(existing) || existing.visibility === 'private')) throw new Error('Agen tidak boleh menimpa catatan terverifikasi atau pribadi. Buat draf dengan judul baru.');
    existing.content = append ? `${existing.content}\n\n${content}` : content;
    existing.tags = [...new Set([...(existing.tags || []), ...tags])];
    existing.updatedAt = t;
    existing.lastEditorId = authorId;
    if (kb === 'owner' || kb === 'drive') existing.kb = kb;   // a human edit makes the note a verified fact; an agent edit never downgrades one
    return store.upsert('notes', existing);
  }
  let id = slug(title);
  while (store.get().notes.some((n) => n.id === id)) id += '-' + Math.random().toString(36).slice(2, 4);
  return store.upsert('notes', { id, title, folder, content, tags, authorId, kb, visibility: visibility || 'internal', pinned: false, createdAt: t, updatedAt: t });
}

export function remember(employee, text) {
  const title = `Memori ${employee.name}`;
  const line = `- ${new Date().toLocaleString('id-ID')}: ${text}`;
  const existing = findNote(title);
  if (existing) {
    const lines = existing.content.split('\n');
    // keep memory compact: header + last 40 entries
    const head = lines.slice(0, 2);
    const items = lines.slice(2).filter(Boolean).concat(line).slice(-40);
    existing.content = [...head, ...items].join('\n');
    existing.updatedAt = Date.now();
    return store.upsert('notes', existing);
  }
  return writeNote({ title, folder: 'Memori', authorId: employee.id, tags: ['memory'], content: `# Memori ${employee.name}\nCatatan kerja pribadi ${employee.name} (${employee.title}). Terhubung: [[Struktur Organisasi]]\n${line}` });
}
