// Tiny JSON-file database with change broadcasting. Single process, debounced writes.
import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from './seed.js';
import { SEED_SKILLS, ensureEmployeeConfig, defaultTools, autoActivate } from './catalog.js';
import { personalAssistant } from './roster.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LIMITS = { events: 600, messages: 3000 };

const listeners = new Set();
let db;
let saveTimer = null;

export function load({ reset = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!reset && fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Merge new default settings keys introduced by later versions.
      db.settings = { ...buildSeed().settings, ...db.settings };
      // v2 migration: skill library + layered employee config
      db.skills ??= SEED_SKILLS.map((s) => ({ ...s, createdAt: Date.now() }));
      for (const d of db.divisions) d.delegation ??= 'best_fit';
      for (const e of db.employees) ensureEmployeeConfig(e, db.skills, db.notes);
      // v3 migration: meetings, personal assistants, master orchestrator, new capabilities
      db.meetings ??= [];
      if ((db.version || 1) < 3) {
        for (const e of db.employees) if (e.type === 'ai') e.tools = [...new Set([...(e.tools || []), ...defaultTools(e)])];
        const master = db.employees.find((e) => e.id === 'aria');
        if (master) Object.assign(master, { isMaster: true, title: 'AI Master Orchestrator' });
        for (const h of db.employees.filter((e) => e.type === 'human')) if (!db.employees.some((e) => e.isPA && e.ownerId === h.id)) db.employees.push(ensureEmployeeConfig(personalAssistant(h), db.skills, db.notes));
        if (master) master.reportsTo = 'pa-owner';
      }
      // v4 migration: Ray Beauty divisions, specialist roles, extra skills/knowledge, cron routines
      if ((db.version || 1) < 4) {
        const seed = buildSeed();
        for (const coll of ['skills', 'divisions', 'notes', 'routines', 'channels']) for (const x of seed[coll]) if (!db[coll].some((y) => y.id === x.id)) db[coll].push(x);
        for (const x of seed.employees) if (!db.employees.some((y) => y.id === x.id)) db.employees.push(x);
      }
      // v5 migration: teams, Knowledge & AI Ops, deep skills, auto-activated tools, Brain re-filing (done in index.js)
      if ((db.version || 1) < 5) {
        const seed = buildSeed();
        for (const coll of ['skills', 'divisions', 'notes', 'routines', 'channels']) for (const x of seed[coll]) if (!db[coll].some((y) => y.id === x.id)) db[coll].push(x);
        for (const x of seed.employees) if (!db.employees.some((y) => y.id === x.id)) db.employees.push(x);
        for (const d of db.divisions) d.teams ??= seed.divisions.find((s) => s.id === d.id)?.teams || [];
        for (const e of db.employees) { const s = seed.employees.find((x) => x.id === e.id); if (s?.team && !e.team) e.team = s.team; if (e.type === 'ai') autoActivate(e, db.skills); }
        db.needsOrganize = true;
      }
      db.version = 5;
      // Agents that were mid-task when the server stopped resume from todo.
      for (const e of db.employees) if (e.status !== 'offline') Object.assign(e, { status: 'idle', statusText: 'Siap bekerja', currentTaskId: null });
      for (const t of db.tasks) if (t.status === 'in_progress' && isAI(t.assigneeId)) t.status = 'todo';
      return db;
    } catch (err) {
      console.error('db.json rusak, membuat ulang:', err.message);
      fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now());
    }
  }
  db = buildSeed();
  saveNow();
  return db;
}

export const get = () => db;
export const isAI = (id) => db.employees.find((e) => e.id === id)?.type === 'ai';

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
export function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function broadcast(msg) { for (const fn of listeners) fn(msg); }

export function upsert(coll, item) {
  const arr = db[coll];
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  const limit = LIMITS[coll];
  if (limit && arr.length > limit) arr.splice(0, arr.length - limit);
  save();
  broadcast({ kind: 'upsert', coll, item: coll === 'settings' ? publicSettings() : item });
  return item;
}

export function patch(coll, id, changes) {
  const item = db[coll].find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, changes, { updatedAt: Date.now() });
  return upsert(coll, item);
}

export function remove(coll, id) {
  const i = db[coll].findIndex((x) => x.id === id);
  if (i < 0) return false;
  db[coll].splice(i, 1);
  save();
  broadcast({ kind: 'remove', coll, id });
  return true;
}

export function setRoot(key, value) {
  db[key] = value;
  save();
  broadcast({ kind: 'root', key, value: key === 'settings' ? publicSettings() : value });
}

export function publicSettings() {
  const s = { ...db.settings };
  s.hasApiKey = !!(s.apiKey || process.env.ANTHROPIC_API_KEY);
  s.apiKey = s.apiKey ? '••••' + s.apiKey.slice(-4) : '';
  s.hasGroqKey = !!(s.groqApiKey || process.env.GROQ_API_KEY);
  s.groqApiKey = s.groqApiKey ? '••••' + s.groqApiKey.slice(-4) : '';
  return s;
}

export function snapshot() {
  return { ...db, settings: publicSettings() };
}

let seq = 0;
export const uid = (p = 'x') => `${p}-${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
