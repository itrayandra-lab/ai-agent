# Peta kode chat, goal, rapat

## Server (`server/engine.js`, `server/index.js`)
- `POST /api/orchestrate {text,userId,to[],mode}` memanggil `engine.orchestrate`: mode auto = goal bila terdengar kerja dan tanpa penerima; selain itu obrolan (1 agen = DM `dm-a--b`, dua atau lebih = grup `grp-...`, kind `group`).
- `POST /api/messages` memanggil `postMessage` lalu `onHumanMessage` (perutean DM/grup/kanal/broadcast/rapat), lalu `replyAs` (LLM atau simulasi).
- `POST /api/goals` memanggil `submitGoal` (tugas `kind:'goal'` untuk PA, turun lewat delegasi).
- `POST /api/meetings` memanggil `collab.runMeeting` (berjalan di latar; kemajuan lewat SSE `/api/stream`).
- Grup: `ensureGroup`; balasan bergiliran (maks 4); `@nama` mempersempit penjawab; `chatBusy` mencegah status "chatting" dipulihkan terlalu dini.
- `WORK_RE`, `TASK_RE`, `broadcastScope`: regex penentu perilaku, sumber salah tebak.

## Klien (`public/js/views.js`, `office3d.js`, `css/glass.css`)
- `OfficeView.dock`, `dockInit`, `dockSend`, `dockRender`, `dockPick`, `orchestrator()`.
- `office.spotlight(ids)`, `office.setInset(px)`, `office.startChase(id)`, `office.following()`.
- Tombol lama `#goalq`, `#meetgo`, `#goalgo` dipertahankan di dalam dock.
- Play: kartu `#ptalk` (`renderTalk`, `talkTo`) untuk bicara dengan agen di dekat karakter (tekan E); Enter membuka dock.
