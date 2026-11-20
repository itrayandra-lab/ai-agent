// n8n tiruan untuk pengujian: REST API (alur, aktifkan, eksekusi, kredensial) + penjalan webhook sederhana
// (webhook → set → code → if). Cukup untuk membuktikan ekspresi dan alur templat; BUKAN pengganti n8n asli.
import http from 'node:http';

export function startMockN8n({ key = 'test-key-123' } = {}) {
  const state = { workflows: new Map(), credentials: new Map(), tables: new Map(), rows: [], executions: [], static: new Map(), seq: 1, log: [], reject: null };
  const send = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(data === undefined ? '' : JSON.stringify(data)); };
  const readBody = async (req) => { let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
  const evalExpr = (v, ctx) => {
    if (typeof v !== 'string' || !v.startsWith('=')) return v;
    const m = v.slice(1).trim().match(/^\{\{([\s\S]*)\}\}$/); if (!m) return v.slice(1);
    return new Function('$json', '$', `return (${m[1]});`)(ctx.json, (name) => ({ item: { json: ctx.byName[name] || {} } }));
  };
  function run(wf, body) {
    const byName = {}, nodes = new Map(wf.nodes.map((n) => [n.name, n]));
    const trig = wf.nodes.find((n) => /webhook$/i.test(n.type)); let cur = trig.name, json = { body, headers: {}, query: {} }; byName[cur] = json;
    const sd = state.static.get(wf.id) || {}; state.static.set(wf.id, sd);
    for (let guard = 0; guard < 30 && cur; guard++) {
      const n = nodes.get(cur); let next = wf.connections[cur]?.main?.[0]?.[0]?.node;
      const ctx = { json, byName };
      if (/\.set$/.test(n.type)) { const out = { ...json }; for (const a of n.parameters.assignments.assignments) out[a.name] = evalExpr(a.value, ctx); json = out; }
      else if (/\.code$/.test(n.type)) { const fn = new Function('$json', '$getWorkflowStaticData', n.parameters.jsCode); json = fn(json, () => sd)[0].json; }
      else if (/\.if$/.test(n.type)) { const c = n.parameters.conditions.conditions[0]; const ok = evalExpr(c.leftValue, ctx) === c.rightValue; next = ok ? wf.connections[cur]?.main?.[0]?.[0]?.node : wf.connections[cur]?.main?.[1]?.[0]?.node; }
      else if (/dataTable$/.test(n.type)) { state.rows.push({ tenant: n.parameters.columns.value.tenant, otomasi: n.parameters.columns.value.otomasi, waktu: new Date().toISOString(), isi: JSON.stringify(body) }); }
      else if (/noOp$/.test(n.type)) { /* ujung */ }
      else if (/webhook$/.test(n.type)) { /* pemicu */ }
      else if (/httpRequest|emailSend/.test(n.type)) throw new Error(`Simpul "${n.name}" tidak boleh dijalankan saat uji (efek keluar).`);
      byName[cur] = json; cur = next;
    }
    return json;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'), p = url.pathname;
    try {
      if (p === '/healthz') return send(res, 200, { status: 'ok' });
      if (p.startsWith('/webhook/')) {
        const wf = [...state.workflows.values()].find((w) => w.active && w.nodes.some((n) => /webhook$/.test(n.type) && '/webhook/' + n.parameters.path === p));
        if (!wf) return send(res, 404, { code: 404, message: 'webhook tidak terdaftar' });
        const body = await readBody(req); state.log.push({ webhook: p });
        try { const out = run(wf, body); state.executions.push({ id: String(state.seq++), workflowId: wf.id, status: 'success', startedAt: new Date().toISOString() }); return send(res, 200, out); }
        catch (err) { state.executions.push({ id: String(state.seq++), workflowId: wf.id, status: 'error', startedAt: new Date().toISOString(), data: { resultData: { error: { message: err.message } } } }); return send(res, 500, { message: err.message }); }
      }
      if (!p.startsWith('/api/v1/')) return send(res, 404);
      if (req.headers['x-n8n-api-key'] !== key) return send(res, 401, { message: 'unauthorized' });
      if (state.reject) return send(res, 400, { message: state.reject });
      const seg = p.slice(8).split('/');
      if (seg[0] === 'workflows') {
        if (!seg[1]) {
          if (req.method === 'GET') return send(res, 200, { data: [...state.workflows.values()].map(({ nodes, connections, ...w }) => w) });
          if (req.method === 'POST') { const b = await readBody(req); const id = 'wf' + state.seq++; const extra = Object.keys(b).filter((k) => !['name', 'nodes', 'connections', 'settings'].includes(k)); if (extra.length) return send(res, 400, { message: 'request/body must NOT have additional properties' }); state.workflows.set(id, { id, active: false, ...b }); return send(res, 200, state.workflows.get(id)); }
        }
        const w = state.workflows.get(seg[1]); if (!w) return send(res, 404, { message: 'Not found' });
        if (seg[2] === 'activate') { w.active = true; return send(res, 200, w); }
        if (seg[2] === 'deactivate') { w.active = false; return send(res, 200, w); }
        if (req.method === 'GET') return send(res, 200, w);
        if (req.method === 'DELETE') { state.workflows.delete(seg[1]); return send(res, 200, w); }
        if (req.method === 'PUT') { Object.assign(w, await readBody(req)); return send(res, 200, w); }
      }
      if (seg[0] === 'executions') {
        if (seg[1]) return send(res, 200, state.executions.find((e) => e.id === seg[1]) || null);
        const wid = url.searchParams.get('workflowId'); return send(res, 200, { data: state.executions.filter((e) => !wid || e.workflowId === wid).reverse() });
      }
      if (seg[0] === 'data-tables') {
        if (!seg[1]) { if (req.method === 'GET') return send(res, 200, { data: [...state.tables.values()] }); const b = await readBody(req); const id = 'tb' + state.seq++; state.tables.set(id, { id, ...b }); return send(res, 200, state.tables.get(id)); }
        if (!state.tables.has(seg[1])) return send(res, 404, { message: 'tidak ada' });
        if (seg[2] === 'rows') { const f = JSON.parse(url.searchParams.get('filter') || '{}'); const ok = (r) => (f.filters || []).every((x) => r[x.columnName] === x.value); return send(res, 200, { data: state.rows.filter(ok), nextCursor: null }); }
        return send(res, 200, state.tables.get(seg[1]));
      }
      if (seg[0] === 'credentials') {
        if (req.method === 'POST') { const b = await readBody(req); const id = 'cr' + state.seq++; state.credentials.set(id, { id, ...b }); return send(res, 200, { id, name: b.name, type: b.type }); }
        if (req.method === 'DELETE') { state.credentials.delete(seg[1]); return send(res, 200, {}); }
      }
      return send(res, 404, { message: 'tidak ada' });
    } catch (err) { send(res, 500, { message: err.message }); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ state, port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) })));
}
