// Penjaga integrasi Robot Mascot V4.2.  Jalankan dari folder aplikasi:   node docs/mascot-v4-2/verify-v42.mjs
// Exit code 0 = semua perubahan V4.2 masih utuh. Exit code 1 = ada yang hilang/rusak (daftar ditampilkan).
// Skrip ini hanya MEMBACA; tidak mengubah apa pun.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const problems = [], okays = [];
const check = (name, cond, hint) => (cond ? okays.push(name) : problems.push(`${name}${hint ? '  ->  ' + hint : ''}`));

const IDS = ['kiko', 'kiko_ocean', 'kiko_coral', 'azure', 'azure_ocean', 'azure_coral', 'charcoal', 'charcoal_ocean', 'charcoal_coral', 'branch', 'branch_ocean', 'branch_coral'];
const OLD = ['terra', 'mallow', 'blueprint', 'sprout', 'clover', 'sage'];

// ---------- assets3d.js ----------
const a3 = read('public/js/assets3d.js');
const m = a3.match(/CHIBI = \{[^}]*ids: \[([^\]]*)\]/);
const listed = m ? m[1].replace(/['\s]/g, '').split(',').filter(Boolean) : [];
check('assets3d.js: CHIBI.ids berisi tepat 12 id V4.2', JSON.stringify(listed) === JSON.stringify(IDS), `ditemukan: ${listed.join(',')}`);
check('assets3d.js: tidak ada id karakter lama di CHIBI.ids', !OLD.some((o) => listed.includes(o)));
check('assets3d.js: Face pada LOD diberi faceSheet', /materialsOf\(lodRoot\)\.forEach\(\(m\) => \{ if \(String\(m\.name\)\.split\('\|'\)\[0\] === 'Face'\) m\.userData\.faceSheet = true;/.test(a3), 'tanpa ini LOD1 menampilkan seluruh atlas 16 ekspresi');
check('assets3d.js: lebar badan chibi tidak dikalikan ap.build', a3.includes('scale * (chibi ? 1 : ap.build)'), 'robot jadi gepeng/melebar bila dikembalikan');
check('assets3d.js: SIT_CLIPS (Sitting/Type/Read)', /const SIT_CLIPS = new Set\(\['Sitting', 'Type', 'Read'\]\)/.test(a3));
check('assets3d.js: sitting memakai SIT_CLIPS', a3.includes('const sitting = SIT_CLIPS.has(name);'));
check("assets3d.js: lengan digerakkan klip (clipDriven, kecuali 'Type')", a3.includes("const clipDriven = !!acts[name] && name !== 'Type';"), 'jika armIK dipaksa lagi, lengan kiri diam & ayunan jalan hilang');
check('assets3d.js: stateOf memakai klip Type/Talk/HoldR/Read dan fidget', ['acts.Type', 'acts.HoldR', 'acts.Talk', 'a.fidgetAt'].every((k) => a3.includes(k)));
check('assets3d.js: kecepatan siklus jalan/lari diselaraskan (GAIT)', a3.includes("v = name === 'Run' ? GAIT.run : GAIT.walk") && a3.includes('Math.min(2.2, Math.max(0.5, v / nat))'), 'tanpa ini kaki meluncur');
check('assets3d.js: export GAIT (jalan santai 1.25 / lari 3.9)', /export const GAIT = \{ walk: 1\.25, run: 3\.9 \}/.test(a3), 'kecepatan agen harus kira-kira kecepatan alami klip');
check('assets3d.js: peran warna V4 (V4_ROLE) + palet unik per agen', a3.includes('const V4_ROLE =') && a3.includes('pickMascotLook(') && a3.includes('function heroMatsFor'), 'tanpa ini ratusan agen terlihat kembar');
check('assets3d.js: uniform roleColors[8] dan uji Face memakai abs(roleId - 5.0)', a3.includes('uniform vec3 roleColors[8];') && a3.includes('abs(roleId - 5.0) < 0.5'), 'peran 6 tidak boleh dianggap Face');
check('assets3d.js: napas Torso', a3.includes('bones.Torso.scale.set(2 - br, br, 2 - br)'));
check('assets3d.js: AGENT_V ada', /const AGENT_V = '[^']+'/.test(a3));
check('assets3d.js: tidak ada kode debug (dbg/dbg2) tersisa', !/\bdbg2?\s*\(\)\s*\{/.test(a3));

// ---------- office3d.js ----------
const o3 = read('public/js/office3d.js');
check('office3d.js: updateFace kaya (reaksi status + mikro-ekspresi)', o3.includes('idle micro-expressions') && o3.includes('a.react') && o3.includes('a.micro'));
check('office3d.js: sinematik pembuka (cinematicIntro/stepIntro/endIntro)', ['function cinematicIntro', 'function stepIntro', 'function endIntro'].every((k) => o3.includes(k)));
check('office3d.js: loop memanggil stepIntro', o3.includes('if (intro) stepIntro(realDt);'));
check('office3d.js: API cinematicIntro/hasAvatar/introActive diekspor', o3.includes('cinematicIntro, hasAvatar: (id) => avatars.has(id), introActive'));
check('office3d.js: FOV Mode Play dibatasi (PLAY_FOV)', o3.includes('const PLAY_FOV = 38;') && o3.includes('Math.min(V.fov, PLAY_FOV)'), 'FOV 65 meregangkan objek di tepi layar (+32%)');
check('office3d.js: exitPlayer mengembalikan FOV', /function exitPlayer\(\) \{\s*camera\.fov = V\.fov;/.test(o3));
check('office3d.js: tanpa kode uji (TEST ONLY)', !o3.includes('TEST ONLY'));
check('office3d.js: kecepatan NPC/pemain memakai GAIT; NPC berjalan santai; hanya perjalanan mendesak sedang yang berlari (a.runTrip)', o3.includes('GAIT } from') && o3.includes('(a.running ? GAIT.run : GAIT.walk) * realDt') && o3.includes('(a.running ? GAIT.run : GAIT.walk) * dt') && o3.includes('a.running = !!a.runTrip'), 'kecepatan lama 2.6/2.8/5.2 membuat langkah terlalu cepat');
check('office3d.js: keluar Mode Play = tarik-mundur halus (bukan overview jauh)', o3.includes('function softPullBack') && o3.includes('} else softPullBack(a);') && o3.includes('else if (pull) stepPull(realDt);'), 'fitCamera(iso) melempar kamera ke pandangan seluruh kampus');

// ---------- mascot-palettes.js ----------
let pal = ''; try { pal = read('public/js/mascot-palettes.js'); } catch { /* */ }
check('mascot-palettes.js ada dan mengekspor pickMascotLook/MASCOT_PALETTES', pal.includes('export function pickMascotLook') && pal.includes('export const MASCOT_PALETTES'), 'berkas hilang -> assets3d.js gagal diimpor');

// ---------- views.js ----------
const vw = read('public/js/views.js');
check('views.js: pemicu intro pada SETIAP muat halaman (bukan sekali per tab)', vw.includes('!window.__rayIntroPlayed') && vw.includes('office.cinematicIntro(') && !vw.includes('rayIntroDone'), 'flag sessionStorage membuat refresh tidak memutar sinematik');

// ---------- aset ----------
const dir = 'public/assets/characters/agents/';
let idx = null; try { idx = JSON.parse(read(dir + 'index.json')); } catch { /* handled below */ }
check('index.json: ids sama persis dengan CHIBI.ids', !!idx && JSON.stringify(idx.ids) === JSON.stringify(IDS));
check('index.html: glass.css dimuat + berkasnya ada', read('public/index.html').includes('/css/glass.css') && fs.existsSync(path.join(root, 'public/css/glass.css')), 'UI glassmorph hilang (docs/mascot-v4-2/07)');
check('office3d.js: plaza relayout (BRAIN_K/FOUNT_K)', read('public/js/office3d.js').includes('BRAIN_K = 0.95, FOUNT_K = 0.62'), 'Brain/air mancur kembali besar (docs/mascot-v4-2/07)');
check('views.js: Esc mengembalikan tombol PLAY + sinematik masuk Play lagi', read('public/js/views.js').includes('left Play with Esc') && read('public/js/views.js').includes('togglePlayer(noCinematic = false)'), 'bug tombol EXIT kembali (docs/mascot-v4-2/07)');
check('office3d.js: FXAA sebelum grade + grade.needsSwap=false', read('public/js/office3d.js').includes('grade.needsSwap = false; composer.addPass(grade)') && read('public/js/office3d.js').includes('composer.addPass(fxaa)'), 'tepi bergerigi / layar hitam (docs 07 D)');
check('office3d.js: applyVisual menjaga lensa saat Play', read('public/js/office3d.js').includes('let lens = V.fov'), 'slider visual membuat zoom in/out (docs 07 D)');
check('server: orchestrate + grup bergiliran', read('server/engine.js').includes('export function orchestrate') && read('server/engine.js').includes('export function ensureGroup') && read('server/index.js').includes('/api/orchestrate'), 'dock orkestrator rusak (docs 07 E)');
check('views.js: dock orkestrator + sorotan agen', read('public/js/views.js').includes('dockSend()') && read('public/js/office3d.js').includes('function spotlight') && read('public/js/office3d.js').includes('function applyInset'), 'dock/sorotan hilang (docs 07 E)');
for (const id of IDS) {
  const files =[`${id}.glb`, `lod/${id}.glb`, `${id}.face.png`, `${id}.json`];
  const missing = files.filter((f) => !fs.existsSync(path.join(root, dir, f)));
  check(`aset ${id}: 4 berkas ada`, !missing.length, `hilang: ${missing.join(', ')}`);
  if (!missing.length) {
    let man = null; try { man = JSON.parse(read(dir + `${id}.json`)); } catch { /* */ }
    check(`aset ${id}: manifest valid & dalam anggaran`, !!man && man.id === id && man.tris.lod0 <= 8000 && man.tris.lod1 <= 4000 && Array.isArray(man.clips) && man.clips.length >= 20,
      man ? `id=${man.id} tris=${JSON.stringify(man.tris)} klip=${man.clips && man.clips.length}` : 'manifest tidak terbaca');
    const sz = fs.statSync(path.join(root, dir, `${id}.glb`)).size;
    check(`aset ${id}: ukuran GLB wajar (0.3-2.5 MB)`, sz > 3e5 && sz < 2.5e6, `${(sz / 1e6).toFixed(2)} MB`);
  }
}
// gelombang 13: DOF tidak boleh kehilangan buffer kedalaman, dan delegasi/rapat harus tahan galat
check('office3d.js: FXAA tidak menghapus kedalaman (DOF)', read('public/js/office3d.js').includes('fxRender') && read('public/js/office3d.js').includes('r.autoClearDepth = false'), 'FXAA menghapus buffer kedalaman: seluruh layar buram (docs 07 F)');
check('governor.js: subtugas bukan duplikat induknya', read('server/governor.js').includes('ancestors') && read('server/governor.js').includes('x.assigneeId === assigneeId'), 'delegasi goal selalu ditolak: goal macet (docs 07 F)');
check('engine.js: goal yatim/blokir tidak menggantung + looksLikeWork', read('server/engine.js').includes('noDelegate') && read('server/engine.js').includes('export function looksLikeWork') && read('server/engine.js').includes('failStreak') === false && read('server/collab.js').includes('failStreak'), 'goal/rapat bisa menggantung (docs 07 F)');
check('index.js: penangan galat global + rapat basi', read('server/index.js').includes('unhandledRejection') && read('server/index.js').includes('Terputus karena server dimulai ulang'), 'proses bisa mati oleh promise tak tertangani (docs 07 F)');
// gelombang 14: kamera rendah, bubble terbaca, bukit, kabut mimpi, preset bawaan Owner
check('office3d.js: kamera Play boleh menunduk di bawah kepala + tidak menembus tanah', read('public/js/office3d.js').includes('player.fp ? -1.4 : -0.85') && read('public/js/office3d.js').includes('never into the ground'), 'kamera orbit bawah hilang (docs 07 G)');
check('office3d.js: bubble menulis kedalaman (tidak buram oleh DOF)', read('public/js/office3d.js').includes('depthWrite: true, alphaTest: o.glass ? 0.14'), 'bubble ucapan buram lagi (docs 07 G)');
check('office3d.js: bukit padang rumput + surfaceAt mengikuti', read('public/js/office3d.js').includes('terrainH = (x, z)') && read('public/js/office3d.js').includes('const th = terrainH(x, z)'), 'terrain berbukit hilang (docs 07 G)');
check('life.js + VDEF ver 4: kabut mimpi & preset Owner', read('public/js/life.js').includes('const setDream') && read('public/js/office3d.js').includes('ver: 4, dof: 0.3, fov: 50') && read('public/js/views.js').includes("'Foggy Dreams'"), 'ambience/preset bawaan hilang (docs 07 G)');
// gelombang 15: SFX seimbang, tiang pylon dibuang, haze berdasar skala dunia, kabut mimpi ringan
check('sfx.js: efek jauh di bawah musik', read('public/js/sfx.js').includes('S.fx ? 0.4 : 0') && read('public/js/sfx.js').includes('level * 0.025'), 'SFX menutupi musik latar lagi (docs 07 H)');
check('office3d.js: tiang pylon hitam Brain dibuang', read('public/js/office3d.js').includes('dark pylon posts were removed') && !read('public/js/office3d.js').includes('BoxGeometry(0.2, 4.6, 0.2)'), 'tiang hitam muncul lagi (docs 07 H)');
check('environment.js: haze memakai skala dunia (bukan fokus Play)', read('public/js/environment.js').includes('float hf = max(uFocus, 48.0)'), 'dunia memutih di Play (docs 07 H)');
check('life.js: kabut mimpi hemat fill-rate', read('public/js/life.js').includes('sp.visible = o > 0.006') && read('public/js/life.js').includes('setDreamLite'), 'sprite kabut membebani GPU (docs 07 H)');
// gelombang 16: build() tidak boleh berhenti di tengah; resolusi dijaga, efek dikorbankan dulu
check('office3d.js: blok bukit memakai Math.PI (bukan PI di luar cakupan)', read('public/js/office3d.js').includes('tg.rotateX(-Math.PI / 2); const pa') && !read('public/js/office3d.js').includes('tg.rotateX(-PI'), 'build() melempar ReferenceError: semua agen dan detail dunia hilang (docs 07 I)');
check('office3d.js: resolusi tidak jatuh di bawah RES_FLOOR 0.8', read('public/js/office3d.js').includes("let RES_FLOOR = gfx === 'eco' ? 0.6 : 0.8") && read('public/js/office3d.js').includes('perf: () =>'), 'resolusi turun ke 0.55 = tepi bergerigi (docs 07 I)');
// gelombang 17: rapat dari chat nyata + hemat token
check('collab.js: rapat hemat token (1 panggilan) + batal + onStart', read('server/collab.js').includes('async function meetingScript') && read('server/collab.js').includes('export function cancelMeeting') && read('server/collab.js').includes('onStart'), 'rapat kembali boros/tidak bisa dibatalkan (docs 07 J)');
check('engine.js: niat rapat dari chat + balasan nol token', read('server/engine.js').includes('export function meetingIntent') && read('server/engine.js').includes('export function startChatMeeting') && read('server/engine.js').includes('function quickReply'), 'chat hanya mengaku mengadakan rapat (docs 07 J)');
check('engine.js: chat tidak lagi memberi model tool convene_meeting', !read('server/engine.js').includes("'ask_colleague', 'convene_meeting', 'schedule_job'"), 'model kembali berhalusinasi rapat (docs 07 J)');
// gelombang 18: rapat interaktif, chat dipagari status nyata, kamera Play di tangga
check('collab.js: rapat live (Owner di ruangan) menjawab tiap pesan', read('server/collab.js').includes('export function ownerSpeaks') && read('server/collab.js').includes('async function liveTurn') && read('server/collab.js').includes('export const isMeetingEnd'), 'rapat kembali diam menunggu kata "selesai" (docs 07 K)');
check('engine.js: chat memakai prompt ringkas berbasis status nyata', read('server/engine.js').includes('function chatSystem') && read('server/engine.js').includes('system: chatSystem(e)') && read('server/engine.js').includes('export const activeLiveMeeting'), 'agen mengarang pekerjaan / chat boros token (docs 07 K)');
check('office3d.js: clampCamera tidak menyeret kamera Play ke bawah', read('public/js/office3d.js').includes('(camera "stuck below")'), 'kamera Play tertahan di bawah saat naik tangga/deck (docs 07 K)');
// gelombang 19: optimasi terukur (draw call, idle, panel beban aplikasi)
check('office3d.js: material Standard identik digabung (draw call)', read('public/js/office3d.js').includes('function matKey(mat)') && read('public/js/office3d.js').includes('(kind || matKey(m.material))'), 'ribuan mesh satu-material kembali (docs 07 L)');
check('office3d.js: tingkat idle 30/20/10/5 fps + agen jauh dijarangkan', read('public/js/office3d.js').includes('idle > 120000 ? 200') && read('public/js/office3d.js').includes('const farIdle'), 'beban idle kembali penuh (docs 07 L)');
check('views.js + index.js: panel menampilkan beban aplikasi sendiri', read('public/js/views.js').includes('Aplikasi ini') && read('server/index.js').includes('procCpu'), 'panel hanya menunjukkan beban seluruh PC (docs 07 L)');
// gelombang 20: batas agen idle yang berkeliling
check('office3d.js: agen idle berkeliling dibatasi (V.crowd) + slider', read('public/js/office3d.js').includes('crowdNow < crowdCap()') && read('public/js/office3d.js').includes('crowd: 14') && read('public/js/views.js').includes("'crowd'"), 'seratus lebih agen berkeliling bersamaan lagi (docs 07 M)');
// gelombang 21: mode Ringan otomatis untuk laptop sederhana
check('office3d.js: deteksi perangkat sederhana -> mode Ringan', read('public/js/office3d.js').includes('function weakDevice()') && read('public/js/office3d.js').includes("mode Ringan") && read('public/js/office3d.js').includes('lambat: beralih ke mode Ringan'), 'laptop lemah tidak otomatis memakai mode ringan (docs 07 N)');
check('office3d.js: batching eco (vertex color, sel, detail jauh disembunyikan)', read('public/js/office3d.js').includes('const vcBasicEligible') && read('public/js/office3d.js').includes('const ecoDetail = []') && read('public/js/office3d.js').includes('const far = d > 55'), 'draw call/segitiga mode Ringan kembali tinggi (docs 07 N)');
// gelombang 22: tata letak HUD tidak saling menimpa
check('glass.css: banner "Kamu berada di" di atas-tengah, dock di atas chip pemain', read('public/css/glass.css').includes('@keyframes l3drop'), 'banner lokasi menimpa dock Orkestrator (docs 07 O)');
// gelombang 23: kunang-kunang plaza + bubble dialog terbaca
check('life.js: kunang-kunang plaza (Points shader, jumlah per mode)', read('public/js/life.js').includes('const setFireflies') && read('public/js/life.js').includes('Math.hypot(camera.position.x - center.x') && read('public/js/office3d.js').includes('life?.setFireflies?.(gfx'), 'kunang-kunang hilang / tak tampil (docs 07 P)');
check('office3d.js: bubble kaca pekat + halo putih + tekstur tajam', read('public/js/office3d.js').includes('glass: true, halo: true') && read('public/js/office3d.js').includes('const Q = o.glass ? 3 : 2'), 'dialog sulit dibaca lagi (docs 07 P)');
// gelombang 24: chat tidak lagi membalas teks tetap yang sama
check('engine.js: balasan cepat sadar riwayat (tak mengulang) + ingatan pribadi di chat', read('server/engine.js').includes('function quickReply(e, msg, ch)') && read('server/engine.js').includes('never repeat what was just said') && read('server/engine.js').includes('# INGATANMU') && read('server/engine.js').includes('berkata kepadaku'), 'agen membalas teks yang sama terus / tanpa ingatan (docs 07 Q)');
// gelombang 25: kaki saat duduk tidak menembus dudukan
check('assets3d.js: kaki duduk chibi = paha ke depan + betis menggantung di depan tepi', read('public/js/assets3d.js').includes('thigh almost horizontal over the seat') && read('public/js/assets3d.js').includes('0.275 - thighLen') && read('public/js/assets3d.js').includes('seatFwdApplied'), 'kaki agen menembus bangku/kursi lagi (docs 07 R)');
// gelombang 26: agen NPC berjalan di atas bukit
check('office3d.js: tinggi agen NPC mengikuti bukit (terrainH)', read('public/js/office3d.js').includes('a.onHill') && read('public/js/office3d.js').includes('NPCs follow the lawn hills too'), 'agen tertanam di bukit saat mode Exit (docs 07 S)');
// gelombang 27: monitor agen hidup (konten ambien + judul tugas)
check('office3d.js: monitor meja hidup (konten video/wave/dash/feed/mail/cal, judul tugas)', read('public/js/office3d.js').includes("kind === 'video'") && read('public/js/office3d.js').includes('const AMBIENT') && read('public/js/office3d.js').includes('function deskTitle(a, d)') && read('public/js/office3d.js').includes("'deskscreen2'"), 'monitor kembali gelap/biru polos (docs 07 T)');
check('office3d.js: layar hidup berada di DEPAN panel layar bawaan meja', read('public/js/office3d.js').includes('/ 2 + 0.224, g, { cast: false });'), 'monitor tampak biru polos karena layar hidup tertutup panel meja (docs 07 T)');
// gelombang 28: teleport / lari agen
check('office3d.js: perjalanan mendesak = teleport (jauh) / lari (sedang) / jalan (dekat)', read('public/js/office3d.js').includes('function teleStep(a, now)') && read('public/js/office3d.js').includes('a.runTrip') && read('public/js/office3d.js').includes('function applyWantInner') && read('public/js/office3d.js').includes('onTeleport?.('), 'agen berjalan lambat ke rapat lagi (docs 07 U)');
check('views.js + glass.css + sfx.js: chip teleport, slider, suara pelan', read('public/js/views.js').includes('teleportChip(i)') && read('public/js/views.js').includes("['tele'") && read('public/css/glass.css').includes('.tele3') && read('public/js/sfx.js').includes('tele: () =>'), 'UI teleport hilang (docs 07 U)');
// gelombang 29: teleport pemain (menu V / tombol ⚡)
check('office3d.js: teleport pemain (teleTargets/teleportTo, tombol V di Play dan kamera bebas)', read('public/js/office3d.js').includes('function teleportTo(id)') && read('public/js/office3d.js').includes('function teleTargets()') && read('public/js/office3d.js').includes("e.code === 'KeyV'") && read('public/js/office3d.js').includes('onTeleportMenu?.()'), 'pemain tidak bisa teleport (docs 07 V)');
check('views.js + glass.css: menu teleport (cari, lepas mouse, kunci ulang)', read('public/js/views.js').includes('teleportMenu()') && read('public/js/views.js').includes('office.relock?.()') && read('public/css/glass.css').includes('.tpm-card'), 'menu teleport hilang (docs 07 V)');
const stray = OLD.filter((o) => fs.existsSync(path.join(root, dir, `${o}.glb`)));
check('karakter lama tidak ada di characters/agents/', !stray.length, `masih ada: ${stray.join(', ')} (cadangan ada di "3D karakter/_backup_agents_v3_20261117/")`);

console.log(`\nVerifikasi Robot Mascot V4.2: ${okays.length} lolos, ${problems.length} masalah\n`);
if (problems.length) { for (const p of problems) console.log('  GAGAL  ' + p); console.log('\nBaca docs/mascot-v4-2/README.md dan 02-DAFTAR-PERUBAHAN-KODE.md sebelum memperbaiki. Jangan membuang perubahan V4.2.'); process.exit(1); }
console.log('Semua perubahan V4.2 utuh.');
