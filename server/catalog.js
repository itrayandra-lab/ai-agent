// Skill library + capability (tool) catalog + employee config defaults.
// Skills are reusable know-how injected into prompts; capabilities are tools an employee may call.

import { EXTRA_SKILLS } from './skills-extra.js';
import { STUDIO_SKILLS } from './roster-studio.js';
import { DEEP_SKILLS } from './skills-deep.js';

export const SKILL_CATEGORIES = ['Communication', 'Creative', 'Analysis', 'Strategy', 'Technical', 'Management', 'Sales', 'Customer', 'Research', 'Finance', 'People', 'Legal'];

const S = (id, name, category, divisions, description, promptSnippet, usageGuide, example = '') => ({ id, name, category, divisions, description, promptSnippet, usageGuide, example, tags: [], builtIn: true });

export const SEED_SKILLS = [
  S('executive-summary', 'Executive Summary', 'Strategy', ['exec'], 'Menyusun ringkasan keputusan dengan Pyramid Principle.',
    'Mulai dari kesimpulan/rekomendasi utama dalam 1-2 kalimat. Lalu 3 argumen pendukung (masing-masing dengan data/bukti). Tutup dengan keputusan yang dibutuhkan, risiko, dan langkah berikutnya beserta pemilik dan tenggat. Maksimal 1 halaman.',
    'Gunakan untuk hasil akhir goal, laporan ke Owner, dan sintesis hasil tim.'),
  S('delegation-planning', 'Delegation Planning', 'Management', ['exec', 'mkt', 'sales', 'eng', 'cs', 'fin', 'hr', 'ops', 'legal', 'data'], 'Memecah pekerjaan besar menjadi subtugas yang jelas.',
    'Pecah goal menjadi 2-5 subtugas yang saling lepas (MECE). Setiap brief subtugas wajib berisi: tujuan, konteks, output yang diharapkan (format + panjang), kriteria selesai, batasan, dan tenggat. Pilih penerima berdasarkan keahlian, bukan urutan.',
    'Dipakai head divisi sebelum create_subtask.'),
  S('copywriting', 'Copywriting AIDA/PAS', 'Creative', ['mkt', 'sales'], 'Menulis copy persuasif dengan framework AIDA dan PAS.',
    'Tentukan satu audiens dan satu aksi. Tulis hook yang spesifik (angka, pain point, atau kontras). Struktur AIDA (Attention, Interest, Desire, Action) atau PAS (Problem, Agitate, Solution). Gunakan kalimat pendek, kata kerja aktif, dan CTA tunggal. Ikuti Brand Guidelines.',
    'Untuk iklan, caption, landing page, email.', 'Hook: "3 jam sehari habis buat rekap WhatsApp? Ini caranya jadi 5 menit."'),
  S('seo-research', 'SEO & Keyword Research', 'Research', ['mkt'], 'Riset keyword, intent, dan struktur artikel SEO.',
    'Kelompokkan keyword menurut intent (informational / commercial / transactional). Untuk tiap artikel: 1 keyword utama, 3-5 turunan, judul ≤ 60 karakter, meta description ≤ 155 karakter, outline H2/H3, dan internal link. Tandai volume sebagai estimasi jika tidak ada data.',
    'Untuk artikel blog dan strategi konten organik.'),
  S('content-calendar', 'Content Calendar', 'Creative', ['mkt'], 'Menyusun kalender konten multi-kanal.',
    'Buat tabel: tanggal, kanal, format, pilar konten, hook, CTA, PIC. Seimbangkan pilar (edukasi 40%, social proof 25%, promosi 20%, hiburan 15%). Sertakan ide visual singkat untuk tiap posting.',
    'Untuk rencana sosial media mingguan/bulanan.'),
  S('campaign-strategy', 'Campaign Strategy', 'Strategy', ['mkt', 'exec'], 'Merancang kampanye dari tujuan sampai KPI.',
    'Definisikan objektif SMART, audiens (ICP), pesan utama, kanal, timeline, budget per kanal, dan KPI per tahap funnel (awareness → consideration → conversion). Sertakan rencana uji A/B dan kriteria stop/scale.',
    'Untuk peluncuran produk, promo, dan kampanye musiman.'),
  S('lead-qualification', 'Lead Qualification (BANT)', 'Sales', ['sales'], 'Menilai kualitas prospek dengan BANT.',
    'Nilai Budget, Authority, Need, Timing masing-masing 0-1, lalu jumlahkan. Skor ≥ 3 = siap demo. Catat bukti untuk setiap skor dan pertanyaan discovery yang masih terbuka.',
    'Untuk menyaring lead dan menyusun pipeline.'),
  S('cold-outreach', 'Cold Outreach', 'Sales', ['sales'], 'Menulis outreach personal yang dibalas.',
    'Personalisasi baris pertama (fakta tentang prospek). Satu masalah, satu bukti (angka/case), satu ajakan ringan (15 menit). Maksimal 90 kata. Siapkan 3 follow-up dengan sudut berbeda (value, social proof, breakup).',
    'Untuk email/WhatsApp ke prospek baru.'),
  S('proposal-writing', 'Proposal Writing', 'Sales', ['sales', 'exec'], 'Menyusun proposal penawaran.',
    'Struktur: ringkasan masalah klien, solusi, ruang lingkup, timeline, investasi (mengacu Pricing), ROI, syarat & ketentuan, langkah berikutnya. Diskon di atas 20% wajib persetujuan.',
    'Untuk penawaran resmi — selalu minta persetujuan sebelum dikirim.'),
  S('prd-writing', 'PRD & User Stories', 'Technical', ['eng'], 'Menulis Product Requirements Document.',
    'PRD: masalah, tujuan & metrik sukses, persona, user story ("Sebagai…, saya ingin…, agar…") dengan acceptance criteria Given/When/Then, non-goals, risiko, dan open questions. Prioritaskan dengan MoSCoW.',
    'Untuk fitur baru dan perubahan produk.'),
  S('technical-design', 'Technical Design', 'Technical', ['eng'], 'Merancang solusi teknis yang sederhana dan aman.',
    'Jelaskan arsitektur (komponen, data flow), model data, API (endpoint, request/response), keamanan (auth, validasi input, data pribadi), observability, rencana rilis bertahap, dan estimasi. Pilih opsi paling sederhana yang memenuhi kebutuhan; sebutkan trade-off.',
    'Untuk desain implementasi sebelum coding.'),
  S('test-planning', 'Test Planning', 'Technical', ['eng'], 'Menyusun test plan dan test case.',
    'Daftar skenario: happy path, edge case, error, keamanan, performa. Format test case: ID, prasyarat, langkah, hasil yang diharapkan, prioritas. Sertakan checklist regresi.',
    'Untuk QA sebelum rilis.'),
  S('customer-reply', 'Empathetic Customer Reply', 'Customer', ['cs'], 'Membalas pelanggan dengan metode HEARD.',
    'Hear (ulang masalah pelanggan), Empathize, Apologize bila perlu, Resolve (langkah konkret bernomor), Diagnose akar masalah untuk tim internal. Nada hangat, tanpa jargon, sapaan "Kak". Eskalasi bug ke Engineering.',
    'Untuk tiket support, komplain, dan FAQ.'),
  S('onboarding-playbook', 'Onboarding Playbook', 'Customer', ['cs'], 'Merancang onboarding pelanggan yang mengurangi churn.',
    'Tetapkan "aha moment", lalu urutan 3-5 langkah menuju ke sana, pesan per hari (D0, D1, D3, D7, D14), metrik aktivasi, dan pemicu intervensi manual.',
    'Untuk retensi dan aktivasi pelanggan baru.'),
  S('financial-forecast', 'Financial Forecast', 'Finance', ['fin', 'exec'], 'Proyeksi revenue, biaya, dan cashflow.',
    'Tulis asumsi secara eksplisit (pertumbuhan, churn, ARPU, biaya tetap/variabel). Buat 3 skenario (konservatif / dasar / optimis) dalam tabel bulanan, hitung runway dan break-even. Tandai semua angka sebagai proyeksi.',
    'Untuk perencanaan budget dan keputusan investasi.'),
  S('budget-control', 'Budget Control', 'Finance', ['fin', 'ops'], 'Mengelola dan memvalidasi pengeluaran.',
    'Untuk setiap pengeluaran: pemilik budget, pos anggaran, nilai, alternatif lebih murah, dampak bila ditunda. Pengeluaran > Rp 5 juta wajib persetujuan. Sajikan dalam tabel.',
    'Untuk pengajuan biaya dan review anggaran.'),
  S('job-description', 'Job Description & Hiring Kit', 'People', ['hr'], 'Menyusun JD dan kit interview terstruktur.',
    'JD: misi peran, 5 tanggung jawab utama, outcome 90 hari, kualifikasi wajib vs nilai plus, benefit. Interview kit: 6 pertanyaan perilaku (STAR) dengan rubrik skor 1-4 dan satu studi kasus.',
    'Untuk rekrutmen manusia maupun mendefinisikan karyawan AI baru.'),
  S('vendor-comparison', 'Vendor Comparison', 'Analysis', ['ops', 'fin'], 'Membandingkan vendor secara objektif.',
    'Tabel minimal 3 vendor dengan bobot kriteria (harga, kualitas, SLA, keamanan, dukungan). Hitung skor berbobot, rekomendasikan satu, dan sebutkan risiko serta klausul kontrak yang perlu dicek Legal.',
    'Untuk pengadaan dan pemilihan tools.'),
  S('process-automation', 'Process Automation', 'Strategy', ['ops'], 'Memetakan dan mengotomasi proses kerja.',
    'Petakan proses saat ini (langkah, pelaku, waktu, error). Tandai langkah repetitif. Usulkan otomasi (trigger → aksi), estimasi jam hemat per minggu, dan rencana implementasi bertahap.',
    'Untuk SOP baru dan efisiensi operasional.'),
  S('contract-review', 'Contract Review', 'Legal', ['legal'], 'Meninjau kontrak dan risiko hukum.',
    'Periksa: para pihak, ruang lingkup, nilai & pembayaran, liabilitas & ganti rugi, HKI, kerahasiaan, data pribadi (UU PDP), terminasi, penyelesaian sengketa. Beri tingkat risiko (rendah/sedang/tinggi) dan redline yang disarankan. Bukan nasihat hukum final.',
    'Untuk kontrak vendor, klien, dan kerja sama.'),
  S('kpi-analysis', 'KPI Analysis', 'Analysis', ['data', 'exec'], 'Menganalisis KPI terhadap target.',
    'Tabel metrik: aktual, target, selisih, tren, status (🟢🟡🔴). Lalu 3 insight (apa, mengapa, bukti) dan 3 rekomendasi (aksi, pemilik, dampak). Bedakan korelasi dan kausalitas; tandai data yang diasumsikan.',
    'Untuk laporan KPI dan evaluasi OKR.'),
  S('market-research', 'Market & Competitor Research', 'Research', ['data', 'mkt'], 'Riset pasar dan kompetitor.',
    'Definisikan pertanyaan riset. Ukur pasar (TAM/SAM/SOM dengan asumsi), segmen, dan tren. Bandingkan kompetitor (fitur, harga, positioning, kelemahan). Tutup dengan peluang dan implikasi strategi. Tandai sumber atau asumsi untuk setiap klaim.',
    'Untuk keputusan produk, harga, dan positioning.'),
];

SEED_SKILLS.push(
  S('okr-planning', 'OKR Planning', 'Strategy', ['exec', 'hr', 'ops', 'eng'], 'Menyusun Objective & Key Results yang terukur.',
    'Tulis 1-3 Objective kualitatif yang menginspirasi. Untuk tiap Objective, 2-4 Key Result kuantitatif (baseline → target, tenggat). Hubungkan KR ke inisiatif dan pemilik. Cek: apakah KR mengukur hasil, bukan aktivitas?',
    'Untuk perencanaan kuartal dan penyelarasan divisi.'),
  S('swot-analysis', 'SWOT & Strategic Analysis', 'Strategy', ['exec', 'data', 'mkt'], 'Analisis SWOT/Porter untuk keputusan strategis.',
    'Kumpulkan fakta internal (kekuatan, kelemahan) dan eksternal (peluang, ancaman) dengan bukti. Susun matriks SWOT lalu turunkan strategi SO/WO/ST/WT. Prioritaskan 3 aksi dengan dampak × kemudahan.',
    'Untuk evaluasi strategi, ekspansi, dan analisis kompetitor.'),
  S('meeting-minutes', 'Meeting Minutes', 'Communication', ['exec', 'cs'], 'Notulen rapat yang menghasilkan aksi.',
    'Format: tujuan rapat, peserta, keputusan (bernomor), diskusi penting singkat, action item (aksi · pemilik · tenggat), isu terbuka. Netral dan faktual.',
    'Untuk rapat internal, standup, dan rapat klien.'),
  S('professional-email', 'Professional Email', 'Communication', ['exec', 'sales', 'mkt'], 'Email bisnis yang jelas dan sopan.',
    'Subjek spesifik (≤ 8 kata). Paragraf pembuka: tujuan. Isi: konteks + permintaan jelas. Penutup: langkah berikutnya & tenggat. ≤ 150 kata, nada sesuai penerima.',
    'Untuk korespondensi internal maupun eksternal.'),
  S('pricing-strategy', 'Pricing Strategy', 'Finance', ['fin', 'sales', 'mkt', 'data'], 'Menentukan dan menguji strategi harga.',
    'Kumpulkan harga kompetitor (web_search), biaya per pengguna, dan willingness-to-pay. Bandingkan model (tiered, usage, per seat). Hitung dampak margin dan konversi dengan calculate. Rekomendasikan harga + rencana uji.',
    'Untuk penetapan paket, diskon, dan perubahan harga.'),
  S('brand-identity', 'Brand Identity', 'Creative', ['mkt', 'design'], 'Merumuskan identitas dan pesan merek.',
    'Definisikan: purpose, positioning statement (untuk [audiens] yang [kebutuhan], [brand] adalah [kategori] yang [manfaat] karena [alasan]), pilar pesan, tone of voice (lakukan/hindari), dan elemen visual inti.',
    'Untuk positioning, messaging, dan guideline brand.'),
  S('sales-forecast', 'Sales Forecasting', 'Sales', ['sales', 'fin'], 'Proyeksi revenue dari pipeline.',
    'Pipeline per tahap × probabilitas tahap = weighted pipeline. Bandingkan dengan target dan historis win rate. Sajikan commit / best case / pipeline, risiko deal besar, dan aksi penutupan gap.',
    'Untuk forecast mingguan dan perencanaan target.'),
  S('crm-hygiene', 'CRM & Pipeline Hygiene', 'Sales', ['sales'], 'Menjaga data pipeline tetap akurat.',
    'Definisikan tahap deal dengan kriteria masuk/keluar. Periksa deal tanpa aktivitas > 14 hari, tanggal close lewat, nilai kosong. Buat daftar perbaikan dan aturan input.',
    'Untuk audit pipeline dan standar kerja tim sales.'),
  S('security-review', 'Security Review', 'Technical', ['it', 'eng'], 'Menilai risiko keamanan sistem dan proses.',
    'Gunakan STRIDE untuk ancaman. Cek autentikasi, otorisasi (least privilege), validasi input, enkripsi data, logging, dan dependensi. Beri tingkat risiko (rendah/sedang/tinggi/kritis) dan mitigasi prioritas.',
    'Untuk review fitur baru, vendor, dan akses.'),
  S('incident-response', 'Incident Response', 'Technical', ['it', 'eng'], 'Menangani insiden secara terstruktur.',
    'Tahap: deteksi → triase (dampak, cakupan) → containment → eradikasi → pemulihan → post-mortem tanpa menyalahkan. Tulis timeline, akar masalah (5 Whys), dan aksi pencegahan dengan pemilik.',
    'Untuk insiden keamanan, downtime, atau gangguan layanan.'),
  S('devops-release', 'Release & DevOps', 'Technical', ['eng'], 'Rilis aman dan dapat dipulihkan.',
    'Rencana rilis: checklist pra-rilis, feature flag, rilis bertahap (canary), metrik pemantauan, kriteria rollback, dan komunikasi ke CS. Hitung biaya infrastruktur bila relevan.',
    'Untuk rilis fitur dan perubahan infrastruktur.'),
  S('ui-ux-review', 'UI/UX Review', 'Creative', ['design', 'eng'], 'Evaluasi pengalaman pengguna.',
    'Nilai dengan 10 heuristik Nielsen dan WCAG dasar (kontras, ukuran target, label). Untuk setiap temuan: lokasi, masalah, tingkat keparahan (1-4), rekomendasi. Sertakan state kosong, error, loading, dan mobile.',
    'Untuk review layar, alur, dan prototipe.'),
  S('design-brief', 'Design Brief', 'Creative', ['design', 'mkt'], 'Brief desain yang jelas untuk eksekusi.',
    'Isi: tujuan, audiens, pesan utama, deliverable & ukuran, mandatory (logo, CTA), referensi/moodboard, palet & tipografi, tenggat, dan kriteria penerimaan.',
    'Untuk konten visual, kampanye, dan aset produk.'),
  S('training-design', 'Training Design', 'People', ['hr', 'cs', 'it'], 'Merancang pelatihan yang efektif.',
    'Mulai dari tujuan belajar (Bloom). Susun modul pendek, aktivitas praktik, contoh nyata, dan kuis evaluasi. Ukur dengan Kirkpatrick level 1-3.',
    'Untuk onboarding, pelatihan pelanggan, dan awareness.'),
  S('compliance-audit', 'Compliance Audit', 'Legal', ['legal', 'fin', 'it'], 'Audit kepatuhan terhadap regulasi dan kebijakan.',
    'Daftar kewajiban (regulasi + kebijakan internal) → kontrol yang ada → bukti → status (patuh/sebagian/tidak) → risiko → rekomendasi dan tenggat. Cek regulasi terbaru via web_search.',
    'Untuk UU PDP, pajak, dan kebijakan internal.'),
  S('data-visualization', 'Data Visualization', 'Analysis', ['data'], 'Menyajikan data agar mudah diputuskan.',
    'Pilih bentuk sesuai pertanyaan (tren → garis, perbandingan → batang, komposisi → tabel persen). Satu pesan per grafik, judul berupa kesimpulan, label jelas. Untuk Markdown, sajikan tabel ringkas + interpretasi.',
    'Untuk dashboard, laporan KPI, dan presentasi data.'),
);

SEED_SKILLS.push(...EXTRA_SKILLS, ...DEEP_SKILLS, ...STUDIO_SKILLS);

// Capability catalog: the tools an employee can be granted. `guide` is injected so the model knows how to use each.
export const CAPABILITIES = [
  { id: 'recruit_agent', label: 'Rekrut agen AI', category: 'Organization', risk: 'medium', leadOnly: true, guide: 'Rancang & rekrut karyawan AI baru (1-5) dari brief peran bila timmu kekurangan keahlian. Jelaskan peran spesifik, bukan generik.' },
  { id: 'create_division', label: 'Bentuk divisi', category: 'Organization', risk: 'medium', paOnly: true, guide: 'Bentuk divisi baru beserta kepala dan anggotanya bila perusahaan butuh fungsi yang belum ada.' },
  { id: 'train_colleague', label: 'Latih rekan', category: 'Learning', risk: 'low', leadOnly: true, guide: 'Mentoring: ajarkan skill & pelajaran praktis ke rekan; proficiency mereka naik dan pelajaran masuk ke memorinya.' },
  { id: 'improve_skill', label: 'Tingkatkan skill library', category: 'Learning', risk: 'low', leadOnly: true, guide: 'Perbarui metode (prompt snippet) skill di library berdasarkan pelajaran nyata agar seluruh perusahaan ikut lebih pintar.' },
  { id: 'acquire_skill', label: 'Pelajari skill', category: 'Learning', risk: 'low', guide: 'Pelajari skill dari library yang kamu butuhkan untuk tugas ini.' },
  { id: 'ask_colleague', label: 'Konsultasi rekan', category: 'Collaboration', risk: 'low', guide: 'Tanya pendapat ahli dari divisi lain secara langsung sebelum memutuskan. Pertanyaan harus spesifik.' },
  { id: 'convene_meeting', label: 'Adakan rapat', category: 'Collaboration', risk: 'medium', leadOnly: true, guide: 'Untuk keputusan lintas peran: undang 2-7 peserta yang relevan, tulis agenda jelas. Notulen & action item jadi tugas otomatis.' },
  { id: 'schedule_job', label: 'Cron / jadwal', category: 'Automation', risk: 'medium', leadOnly: true, guide: 'Jadwalkan pekerjaan berulang (laporan, monitoring, follow-up). Gunakan interval wajar (≥ 10 menit) agar hemat biaya.' },
  { id: 'list_jobs', label: 'Lihat jadwal', category: 'Automation', risk: 'low', guide: 'Cek jadwal yang sudah ada sebelum membuat yang baru agar tidak duplikat.' },
  { id: 'visit_url', label: 'Buka situs', category: 'Research', risk: 'low', guide: 'Baca isi halaman web tertentu (pricing, dokumentasi, berita) bila URL sudah diketahui.' },
  { id: 'mcp', label: 'Tool MCP', category: 'Integration', risk: 'medium', leadOnly: true, guide: 'Gunakan tool dari server MCP yang terhubung (mcp__server__tool) untuk sistem eksternal.' },
  { id: 'google_sheets_append', label: 'Tulis Google Sheets', category: 'Integration', risk: 'medium', guide: 'Tulis data sungguhan melalui konektor Google Apps Script. Klaim berhasil hanya bila tool mengembalikan receipt spreadsheetId, range, dan URL.' },
  { id: 'google_drive_create', label: 'Buat file Google Drive', category: 'Integration', risk: 'medium', guide: 'Buat dokumen/file sungguhan di Drive. Klaim berhasil hanya bila tool mengembalikan fileId dan URL.' },
  { id: 'google_calendar_create', label: 'Buat Google Calendar event', category: 'Integration', risk: 'medium', guide: 'Buat acara sungguhan di Calendar. Klaim berhasil hanya bila tool mengembalikan eventId.' },
  { id: 'web_search', label: 'Riset web (live)', category: 'Research', risk: 'low', guide: 'Riset internet sungguhan lewat Groq Compound untuk data terbaru (pasar, kompetitor, harga, regulasi). Tulis query spesifik dan selalu cantumkan sumber di output.' },
  { id: 'calculate', label: 'Kalkulator', category: 'Analysis', risk: 'low', guide: 'Gunakan untuk setiap perhitungan angka agar akurat.' },
  { id: 'company_status', label: 'Status perusahaan', category: 'Collaboration', risk: 'low', guide: 'Sumber kebenaran live untuk jumlah, ID, nama, status, dan beban kerja seluruh agen/divisi. Wajib gunakan untuk audit roster atau cakupan agen; catatan Brain bisa usang.' },
  { id: 'search_brain', label: 'Cari Brain', category: 'Knowledge', risk: 'low', guide: 'Gunakan di awal tugas untuk menemukan SOP, kebijakan, dan deliverable terkait. Coba 2-3 kata kunci berbeda bila hasil kosong.' },
  { id: 'read_note', label: 'Baca catatan', category: 'Knowledge', risk: 'low', guide: 'Baca catatan lengkap setelah search_brain menemukan judul yang relevan.' },
  { id: 'write_note', label: 'Tulis ke Brain', category: 'Knowledge', risk: 'low', guide: 'Simpan pengetahuan jangka panjang (SOP baru, temuan riset, keputusan). Jangan simpan draf sementara. Tautkan dengan [[Judul]].' },
  { id: 'create_subtask', label: 'Delegasi tugas', category: 'Collaboration', risk: 'medium', guide: 'Delegasikan ke rekan yang paling cocok dengan brief lengkap. Tugas induk akan menunggu sampai semua subtugas selesai.' },
  { id: 'send_message', label: 'Kirim pesan', category: 'Collaboration', risk: 'low', guide: 'Koordinasi singkat ke channel atau DM. Jangan memakai pesan sebagai pengganti output tugas.' },
  { id: 'request_approval', label: 'Minta persetujuan', category: 'Governance', risk: 'low', guide: 'Wajib untuk publikasi, uang, kontrak, dan keputusan HR sesuai Kebijakan Persetujuan.' },
  { id: 'complete_task', label: 'Selesaikan tugas', category: 'Governance', risk: 'low', required: true, guide: 'Akhiri setiap tugas dengan output lengkap.' },
  { id: 'organize_brain', label: 'Audit kerapian Brain', category: 'Knowledge', risk: 'low', specialist: true, guide: 'Lihat struktur folder Brain, folder yang menumpuk, catatan tanpa klasifikasi, judul buruk, dan kandidat duplikat.' },
  { id: 'move_note', label: 'Pindah folder catatan', category: 'Knowledge', risk: 'low', specialist: true, guide: 'Pindahkan catatan ke folder "<Divisi>/<Jenis>" yang akurat.' },
  { id: 'rename_note', label: 'Ganti nama catatan', category: 'Knowledge', risk: 'low', specialist: true, guide: 'Ganti judul menjadi deskriptif & konsisten; wikilink lama ikut diperbarui otomatis.' },
  { id: 'merge_notes', label: 'Gabungkan duplikat', category: 'Knowledge', risk: 'medium', specialist: true, guide: 'Gabungkan catatan duplikat ke satu catatan utama; yang lain diarsipkan dengan tautan.' },
  { id: 'build_training_set', label: 'Bangun dataset training', category: 'AI', risk: 'low', specialist: true, guide: 'Ekspor dataset fine-tuning JSONL berkualitas (per divisi/agen) dan dokumentasikan versinya.' },
];
export const CAP_IDS = CAPABILITIES.map((c) => c.id);
/**
 * Every AI employee can discover and call every first-party capability. Runtime
 * policy still blocks unsafe uses (for example recurring jobs cannot recursively
 * recruit or delegate). Keeping one authoritative list prevents the prompt/tool
 * mismatch that makes strict providers reject an otherwise valid tool call.
 */
export const defaultTools = (e) => e?.type === 'ai' ? [...CAP_IDS] : [];

/** Grant the whole skill library while preserving an employee's specialist levels. */
export function grantUniversalSkills(e, skills = SEED_SKILLS) {
  if (e.type !== 'ai') return [];
  const refs = new Map((e.skillRefs || []).map((r) => [r.id, { ...r }]));
  const added = [];
  for (const s of skills) if (!refs.has(s.id)) {
    refs.set(s.id, { id: s.id, proficiency: 5 });
    added.push(s.id);
  }
  e.skillRefs = [...refs.values()];
  return added;
}

// Tools a skill needs when it does not declare them, inferred from its category.
const CATEGORY_TOOLS = { Research: ['web_search', 'visit_url'], Analysis: ['calculate'], Finance: ['calculate'], Data: ['calculate'], Knowledge: ['search_brain', 'read_note', 'write_note'], Automation: ['schedule_job', 'list_jobs'], Marketing: ['web_search'], Commerce: ['web_search', 'calculate'], Sales: ['calculate'], Strategy: ['web_search'] };
export const skillTools = (s) => (s?.tools?.length ? s.tools : CATEGORY_TOOLS[s?.category] || []);

/** Auto-activation: grant the default tools for the role plus every tool the agent's skills need. Returns the tools added. */
export function autoActivate(e, skills) {
  if (e.type !== 'ai') return [];
  const before = new Set(e.tools || []);
  const want = new Set([...before, ...defaultTools(e)]);
  for (const r of e.skillRefs || []) for (const t of skillTools(skills.find((s) => s.id === r.id))) if (CAP_IDS.includes(t)) want.add(t);
  e.tools = [...want];
  return e.tools.filter((t) => !before.has(t));
}

const DIV_SKILL_HINTS = {
  exec: ['executive-summary', 'delegation-planning', 'campaign-strategy', 'kpi-analysis'],
  mkt: ['campaign-strategy', 'copywriting', 'content-calendar', 'seo-research', 'market-research'],
  sales: ['lead-qualification', 'cold-outreach', 'proposal-writing', 'copywriting'],
  eng: ['prd-writing', 'technical-design', 'test-planning'],
  cs: ['customer-reply', 'onboarding-playbook'],
  fin: ['financial-forecast', 'budget-control'],
  hr: ['job-description'],
  ops: ['process-automation', 'vendor-comparison', 'budget-control'],
  legal: ['contract-review'],
  data: ['kpi-analysis', 'market-research', 'data-visualization'],
  design: ['ui-ux-review', 'design-brief', 'brand-identity'],
  it: ['security-review', 'incident-response'],
  kms: ['knowledge-curation', 'taxonomy-design', 'training-data-curation'],
};
const KEYWORD_SKILL = [
  [/copy|konten|content|artikel|caption|writer/i, 'copywriting'], [/seo|ads|keyword/i, 'seo-research'], [/social|kalender|instagram|tiktok/i, 'content-calendar'],
  [/prospect|sdr|outreach|cold/i, 'cold-outreach'], [/proposal|account|closing|demo/i, 'proposal-writing'], [/prd|product manager|user story/i, 'prd-writing'],
  [/engineer|backend|frontend|cto|arsitektur/i, 'technical-design'], [/qa|test/i, 'test-planning'], [/support|tiket|faq/i, 'customer-reply'],
  [/onboarding|retensi|success/i, 'onboarding-playbook'], [/cfo|forecast|unit economics/i, 'financial-forecast'], [/account|invoice|budget|anggaran/i, 'budget-control'],
  [/recruit|rekrut|talent|people/i, 'job-description'], [/vendor|procure|pengadaan/i, 'vendor-comparison'], [/coo|sop|otomasi|proses/i, 'process-automation'],
  [/legal|kontrak|compliance/i, 'contract-review'], [/data|kpi|dashboard|analis/i, 'kpi-analysis'], [/research|riset|kompetitor|market/i, 'market-research'],
];

/** Pick skills for an employee from its division and role text, leads get the delegation skill. */
export function suggestSkills(e, skills = SEED_SKILLS) {
  const text = `${e.title} ${e.persona || ''} ${(e.skills || []).join(' ')}`;
  const ids = new Set();
  for (const [re, id] of KEYWORD_SKILL) if (re.test(text)) ids.add(id);
  for (const id of DIV_SKILL_HINTS[e.divisionId] || []) if (ids.size < 3 || e.isLead) ids.add(id);
  if (e.isLead) ids.add('delegation-planning');
  const known = new Set(skills.map((s) => s.id));
  return [...ids].filter((id) => known.has(id)).slice(0, 6).map((id, i) => ({ id, proficiency: i < 2 ? 9 : 7 }));
}

/** Fill config fields that older data or quick-created employees lack. */
export const SOP_OF = { mkt: 'sop-marketing---content-pipeline', sales: 'sop-sales---kualifikasi-lead', eng: 'sop-engineering---rilis-fitur', cs: 'sop-cs---penanganan-tiket', fin: 'sop-finance---budget-invoice', hr: 'sop-hr---rekrutmen', ops: 'sop-ops---pengadaan-vendor', legal: 'sop-legal---review-kontrak', data: 'sop-data---laporan-kpi', exec: 'okr-kuartal-ini', design: 'sop-design---design-review', it: 'sop-it---akses-insiden-keamanan', rnd: 'sop-rd---formulasi-uji-stabilitas', mfg: 'sop-produksi---cpkb', qa: 'sop-qc---pengujian-release-batch', reg: 'sop-regulasi---notifikasi-bpom-halal', scm: 'sop-gudang---fefo-stock-opname', ecom: 'sop-marketplace---listing-kampanye', kms: 'panduan-taksonomi-brain' };

export function ensureEmployeeConfig(e, skills, notes = []) {
  if (e.type !== 'ai') return e;
  e.about ??= e.persona || '';
  if (!String(e.title || '').trim()) e.title = e.type === 'human' ? 'Karyawan' : `Staf ${String(e.divisionId || 'umum').toUpperCase()}`;
  if (/pekerjaan undefined /.test(e.taskAndFunction || '')) e.taskAndFunction = undefined;
  e.taskAndFunction ??= `Bertanggung jawab atas pekerjaan ${e.title} di divisi ${e.divisionId}${(e.skills || []).length ? ': ' + e.skills.join(', ') : ''}.`;
  e.instructions ??= '';
  e.escalation ??= 'Eskalasi ke atasan atau minta persetujuan manusia bila menyangkut uang, publikasi, kontrak, data pribadi, atau bila informasi tidak cukup untuk menyelesaikan tugas dengan benar.';
  e.outputFormat ??= 'markdown';
  e.effort ??= '';
  e.skillRefs ??= suggestSkills(e, skills);
  e.tools ??= defaultTools(e);
  grantUniversalSkills(e, skills);
  e.tools = [...CAP_IDS];
  e.knowledgeIds ??= [SOP_OF[e.divisionId], 'kebijakan-persetujuan'].filter((id) => notes.some((n) => n.id === id));
  e.starters ??= [];
  e.reasoning ??= null;
  return e;
}
