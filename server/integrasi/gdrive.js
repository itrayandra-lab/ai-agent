// Google Drive as the Brain's real home. Scope drive.file only: the app sees the files it created or that the user picked.
// Folder decides visibility: Perusahaan = internal, Publik = public, Pribadi = private, Hasil Agen = agent drafts.
import * as store from '../penyimpanan/store.js';
import * as auth from '../keamanan/auth.js';
import * as brain from '../pengetahuan/brain.js';

const API = () => process.env.GOOGLE_API_BASE || 'https://www.googleapis.com';
const FOLDER = 'application/vnd.google-apps.folder', DOC = 'application/vnd.google-apps.document', SHEET = 'application/vnd.google-apps.spreadsheet';
export const LAYOUT = { owner: ['Perusahaan', 'Publik', 'Pribadi', 'Hasil Agen'], member: ['Pribadi', 'Hasil Agen'] };
const VIS = { Perusahaan: 'internal', Publik: 'public', Pribadi: 'private', 'Hasil Agen': 'internal' };
const db = () => store.get();

async function g(userId, url, opts = {}, raw = false) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await auth.accessToken(userId);
    const r = await fetch(url.startsWith('http') ? url : API() + url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
    if (r.status === 401 && attempt === 0) { const u = auth.userById(userId); if (u) u.accessExp = 0; continue; }   // stale token: refresh once
    if (!r.ok) { const t = await r.text(); throw Object.assign(new Error(`Drive ${r.status}: ${t.slice(0, 200)}`), { status: r.status }); }
    return raw ? r.text() : r.json();
  }
}
const q = (s) => encodeURIComponent(s);

/** RAIVERSE/ and its sub-folders in THIS user's Drive (found again by appProperties, created when missing) */
export async function ensureFolders(userId) {
  const u = auth.userById(userId); if (!u) throw new Error('Pengguna tidak ada');
  const find = async (tag, parent) => (await g(userId, `/drive/v3/files?q=${q(`appProperties has { key='raiverse' and value='${tag}' } and trashed=false${parent ? ` and '${parent}' in parents` : ''}`)}&fields=files(id,name)`)).files?.[0];
  const make = (name, tag, parent) => g(userId, '/drive/v3/files?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, appProperties: { raiverse: tag }, ...(parent ? { parents: [parent] } : {}) }) });
  const root = (await find('root')) || (await make('RAIVERSE', 'root'));
  const folders = {};
  for (const name of LAYOUT.owner) folders[name] = ((await find(name, root.id)) || (await make(name, name, root.id))).id;
  auth.setDrive(userId, { root: root.id, folders, readyAt: Date.now() });
  return { root: root.id, folders };
}

// Drive is used only by the OWNER of the workspace (the API checks it), so every user gets the full layout in their own Drive
const folderFor = (n) => n.kb === 'agent' ? 'Hasil Agen' : n.visibility === 'public' ? 'Publik' : n.visibility === 'private' ? 'Pribadi' : 'Perusahaan';

/** Brain -> Drive: verified notes become Google Docs in the right folder, agent drafts go to "Hasil Agen". Unchanged notes are skipped. */
export async function push(userId) {
  const u = auth.userById(userId); if (!u) throw new Error('Pengguna tidak ada');
  const drive = u.drive?.folders ? u.drive : await ensureFolders(userId);
  const notes = db().notes.filter((n) => !n.archived && n.kb !== 'dummy' && n.kb !== 'drive' && !/^Memori\b/.test(n.folder || ''));
  let created = 0, updated = 0, skipped = 0;
  for (const n of notes) {
    const link = (n.drive || {})[u.id];
    if (link && link.pushedAt >= (n.updatedAt || 0)) { skipped++; continue; }
    const folder = drive.folders[folderFor(n)];
    const meta = { name: n.title, mimeType: DOC, appProperties: { raiverse: 'note', noteId: n.id }, ...(link ? {} : { parents: [folder] }) };
    const boundary = 'rv' + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${n.content}\r\n--${boundary}--`;
    const url = link ? `/upload/drive/v3/files/${link.fileId}?uploadType=multipart&fields=id,modifiedTime` : '/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
    const f = await g(userId, url, { method: link ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    n.drive = { ...(n.drive || {}), [u.id]: { fileId: f.id, pushedAt: Date.now(), modifiedTime: f.modifiedTime } };
    store.upsert('notes', n);
    link ? updated++ : created++;
  }
  return { created, updated, skipped };
}

function csvToTable(csv, maxRows = 200) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQ) { if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') inQ = false; else cell += ch; }
    else if (ch === '"') inQ = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const body = rows.filter((r) => r.some((c) => c.trim())).slice(0, maxRows + 1);
  if (!body.length) return '(sheet kosong)';
  const w = Math.max(...body.map((r) => r.length));
  const line = (r) => '| ' + Array.from({ length: w }, (_, i) => String(r[i] ?? '').replace(/\|/g, '/').trim()).join(' | ') + ' |';
  return [line(body[0]), '|' + ' --- |'.repeat(w), ...body.slice(1).map(line)].join('\n') + (rows.length > maxRows + 1 ? `\n\n_(${rows.length - maxRows - 1} baris lagi tidak ditampilkan)_` : '');
}
async function readFile(userId, f) {
  if (f.mimeType === DOC) return g(userId, `/drive/v3/files/${f.id}/export?mimeType=${q('text/markdown')}`, {}, true).catch(() => g(userId, `/drive/v3/files/${f.id}/export?mimeType=${q('text/plain')}`, {}, true));
  if (f.mimeType === SHEET) return csvToTable(await g(userId, `/drive/v3/files/${f.id}/export?mimeType=${q('text/csv')}`, {}, true));
  if (/^text\/|markdown|json|csv/.test(f.mimeType || '')) return g(userId, `/drive/v3/files/${f.id}?alt=media`, {}, true);
  return null;   // binaries (PDF, images) are listed, not read
}

/** every file under a Drive folder, sub-folders included (paged), with its folder path */
async function listTree(userId, folderId, prefix, out, depth = 0) {
  if (depth > 8) return out;
  let pageToken = '';
  do {
    const r = await g(userId, `/drive/v3/files?q=${q(`'${folderId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,parents,appProperties)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const f of r.files || []) {
      if (f.mimeType === FOLDER) await listTree(userId, f.id, `${prefix}/${f.name}`, out, depth + 1);
      else out.push({ ...f, _path: prefix });
    }
    pageToken = r.nextPageToken || '';
  } while (pageToken);
  return out;
}

/** Drive -> Brain: what the Owner wrote or picked in Drive becomes a VERIFIED note (kb "drive"); the TOP folder decides visibility, sub-folders become the Brain folder path */
export async function pull(userId, onlyIds = null, progress = null) {
  const u = auth.userById(userId); if (!u) throw new Error('Pengguna tidak ada');
  const drive = u.drive?.folders ? u.drive : await ensureFolders(userId);
  let files = [];
  if (onlyIds) for (const id of onlyIds) files.push({ ...(await g(userId, `/drive/v3/files/${id}?fields=id,name,mimeType,modifiedTime,parents,appProperties`)), _path: 'Dipilih' });
  else for (const [name, id] of Object.entries(drive.folders)) {
    if (name === 'Hasil Agen') continue;   // agent drafts stay drafts until the Owner approves them in the app
    await listTree(userId, id, name, files);
  }
  for (const pid of (u.drive?.picked || [])) if (!onlyIds && !files.some((f) => f.id === pid)) { try { files.push({ ...(await g(userId, `/drive/v3/files/${pid}?fields=id,name,mimeType,modifiedTime,parents,appProperties`)), _path: 'Dipilih' }); } catch { /* access removed */ } }
  const res = { added: 0, changed: 0, same: 0, skipped: 0, failed: 0, files: files.length };
  if (progress) Object.assign(progress, { total: files.length, done: 0 });
  const one = async (f) => {
    const top = f._path.split('/')[0];
    const known = db().notes.find((n) => n.id === f.appProperties?.noteId || n.drive?.[u.id]?.fileId === f.id);
    const link = known?.drive?.[u.id];
    if (known && link?.modifiedTime === f.modifiedTime) { res.same++; return; }   // nothing new since we last wrote/read it
    const text = await readFile(userId, f);
    if (text == null) { res.skipped++; return; }
    const visibility = VIS[top] || 'internal';
    if (known) {
      Object.assign(known, { content: String(text).slice(0, 60000), kb: 'drive', visibility, updatedAt: Date.now(), lastEditorId: 'owner', archived: false });
      known.drive = { ...(known.drive || {}), [u.id]: { fileId: f.id, pushedAt: Date.now(), modifiedTime: f.modifiedTime } };
      store.upsert('notes', known); res.changed++; return;
    }
    // many files share a name (README, INTERNAL-KB…): a title that is already taken gets its folder path, so nothing is overwritten
    const base = String(f.name).replace(/\.(md|markdown|txt)$/i, '').replace(/[[\]|#]/g, ' ').trim() || 'Tanpa judul';
    let title = base;
    if (brain.findNote(title)) title = `${base} (${f._path.split('/').slice(-1)[0]})`;
    if (brain.findNote(title)) title = `${base} (${f._path.split('/').slice(1).join(' › ') || top})`.slice(0, 140);
    let i = 2; while (brain.findNote(title)) title = `${base} (${i++})`;
    const n = brain.writeNote({ title, content: String(text).slice(0, 60000), folder: `Drive/${f._path}`.slice(0, 160), authorId: 'owner', kb: 'drive', visibility, tags: ['drive'] });
    n.drive = { [u.id]: { fileId: f.id, pushedAt: Date.now(), modifiedTime: f.modifiedTime } };
    store.upsert('notes', n); res.added++;
  };
  // 4 files at a time: fast enough for hundreds of files, gentle on Drive quotas
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < files.length) {
      const f = files[next++];
      try { await one(f); } catch (err) { res.failed++; console.warn('[drive] gagal membaca', f.name, err.message); }
      if (progress) progress.done++;
    }
  }));
  return res;
}

/** a big import runs in the background; the page asks for progress instead of holding one long request open */
const pullJobs = new Map();   // workspace:user -> { running, total, done, result, error, startedAt }
export function startPull(userId) {
  const key = store.current() + ':' + userId;
  const cur = pullJobs.get(key);
  if (cur?.running) return cur;
  const job = { running: true, total: 0, done: 0, result: null, error: null, startedAt: Date.now() };
  pullJobs.set(key, job);
  pull(userId, null, job).then((r) => { job.result = r; }).catch((err) => { job.error = err.message; }).finally(() => { job.running = false; });
  return job;
}
export const pullStatus = (userId) => pullJobs.get(store.current() + ':' + userId) || null;

/** files chosen in the Google Picker: remember them (drive.file grants access per picked file) and read them in */
export async function addPicked(userId, ids = []) {
  ids = [...new Set((ids || []).map(String).filter((x) => /^[\w-]{10,}$/.test(x)))].slice(0, 50);
  const u = auth.userById(userId); if (!u) throw new Error('Pengguna tidak ada');
  auth.setDrive(userId, { picked: [...new Set([...(u.drive?.picked || []), ...ids])] });
  return pull(userId, ids);
}
