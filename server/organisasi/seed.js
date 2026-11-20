// Initial company: divisions, AI + human employees, knowledge brain, routines, channels.
import { knowledgeNotes, attachKnowledge } from '../knowledge/index.js';
import { SEED_SKILLS, ensureEmployeeConfig, autoActivate } from '../otak/catalog.js';
import { TEAMS } from './roster-teams.js';
import { install as installPower, REV as POWER_REV } from '../pengetahuan/skills-power.js';
import { DIVISIONS, ROSTER, rosterEmployees, personalAssistant } from './roster.js';
import { SCHEMA_VERSION, normalizeOrg, flattenMasterBoss } from './org-rules.js';
import { inferGender } from '../../public/js/tts.js';
const now = () => Date.now();

export { DIVISIONS };

export function buildSeed() {
  const t = now();
  const employees = rosterEmployees(t);
  employees.unshift({
    id: 'owner', name: 'Anda (Owner)', type: 'human', divisionId: 'exec', title: 'Founder & CEO',
    persona: 'Manusia pemilik perusahaan. Memberi goal, menyetujui keputusan penting.', skills: ['visi', 'keputusan'],
    isLead: true, reportsTo: null, status: 'idle', statusText: 'Online', currentTaskId: null, avatar: 'human',
    autonomy: 'auto', model: '', stats: { tasksDone: 0, tokensIn: 0, tokensOut: 0, cost: 0, lastActiveAt: t }, createdAt: t,
  });

  employees.push(personalAssistant(employees.find((e) => e.id === 'owner'), t));

  const notes = [];
  const note = (title, folder, content, tags = [], authorId = 'aria') =>
    notes.push({ id: slug(title), title, folder, content: content.trim(), tags, authorId, pinned: false, createdAt: t, updatedAt: t });

  note('Profil Perusahaan', 'Company', `
# Profil Perusahaan
**Ray Group** adalah grup usaha yang dijalankan bersama oleh tim manusia dan karyawan AI, dengan dua lini bisnis:
1. **RayFlow** — SaaS otomasi workflow untuk UMKM (lihat [[Produk & Layanan]])
2. **Ray Beauty** — brand skincare lokal dengan pabrik sendiri bersertifikat CPKB (lihat [[Produk Ray Beauty]])

- Visi & arah: lihat [[Visi & Misi]]
- Cara kerja: [[Nilai Perusahaan]] dan [[Cara Kerja AI + Manusia]]
- Struktur: [[Struktur Organisasi]]
- Produk: [[Produk & Layanan]]
- Target pasar: [[Ideal Customer Profile]]
- Target kuartal: [[OKR Kuartal Ini]]
`, ['company', 'pinned']);
  note('Visi & Misi', 'Company', `
# Visi & Misi
**Visi:** Menjadi perusahaan paling efisien di Asia Tenggara dengan memadukan talenta manusia dan AI.

**Misi:**
1. Memberi nilai nyata ke pelanggan dengan cepat (lihat [[Produk & Layanan]]).
2. Mengotomasi pekerjaan rutin agar manusia fokus pada keputusan dan kreativitas.
3. Menjaga kepercayaan lewat transparansi ([[Nilai Perusahaan]]).
`, ['company']);
  note('Nilai Perusahaan', 'Company', `
# Nilai Perusahaan
1. **Customer first** — setiap output harus membantu pelanggan.
2. **Bias to action** — kerjakan, ukur, perbaiki.
3. **Transparan** — semua kerja tercatat di Brain dan bisa diaudit.
4. **Human in the loop** — keputusan berisiko (uang, legal, publikasi) wajib persetujuan manusia. Lihat [[Kebijakan Persetujuan]].
5. **Hemat** — gunakan sumber daya secukupnya ([[SOP Finance - Budget & Invoice]]).
`, ['company', 'culture']);
  note('Cara Kerja AI + Manusia', 'Company', `
# Cara Kerja AI + Manusia
- Goal dari Owner masuk ke **Aria (AI Chief of Staff)**, dipecah menjadi tugas per divisi.
- Head divisi memecah lagi ke anggota tim (AI atau manusia).
- Setiap tugas punya log jejak kerja (observability) dan output yang disimpan ke Brain folder **Deliverables**.
- Tugas yang menyentuh [[Kebijakan Persetujuan]] berhenti di kolom **Review** sampai disetujui manusia.
- Pengetahuan baru ditulis ke Brain dengan [[wikilink]] agar terhubung.
- Lihat juga [[Struktur Organisasi]].
`, ['company', 'process']);
  note('Kebijakan Persetujuan', 'Company', `
# Kebijakan Persetujuan (Human-in-the-loop)
Wajib minta persetujuan manusia sebelum:
- Mengeluarkan atau menjanjikan uang > Rp 5.000.000
- Mempublikasikan konten atas nama brand
- Mengirim kontrak/penawaran resmi ke pihak luar
- Mengubah kebijakan HR atau data pribadi
Terkait: [[Nilai Perusahaan]], [[SOP Legal - Review Kontrak]].
`, ['policy']);
  note('Struktur Organisasi', 'Company', `# Struktur Organisasi\n- **Executive Office**: Owner (manusia), ${ROSTER.filter((r) => r.div === 'exec').map((r) => `${r.name} (${r.title})`).join(', ')}\n${DIVISIONS.filter((d) => d.id !== 'exec').map((d) => `- **${d.name}**: ${ROSTER.filter((r) => r.div === d.id).map((r) => `${r.name}${r.lead ? ' (Head)' : ''}`).join(', ')}`).join('\n')}\n\nCara kerja: [[Cara Kerja AI + Manusia]]`, ['org']);
  note('Produk & Layanan', 'Company', `
# Produk & Layanan
1. **RayFlow** — SaaS otomasi workflow untuk UMKM (Rp 299rb/bulan). Lihat [[Pricing]].
2. **RayAssist** — chatbot customer service berbasis AI.
3. **Jasa implementasi** — setup & training untuk klien enterprise.
Target: [[Ideal Customer Profile]]. Kompetitor: [[Analisis Kompetitor]].
`, ['product']);
  note('Pricing', 'Company', `
# Pricing
| Paket | Harga/bulan | Fitur |
|---|---|---|
| Starter | Rp 299.000 | 3 workflow, 1 user |
| Growth | Rp 899.000 | 20 workflow, 5 user, RayAssist |
| Enterprise | Custom | Unlimited, SLA, implementasi |
Diskon tahunan 20%. Terkait [[Produk & Layanan]].
`, ['product', 'sales']);
  note('Ideal Customer Profile', 'Company', `
# Ideal Customer Profile
- UMKM & mid-market (10–200 karyawan) di Indonesia
- Industri: retail, F&B, distribusi, jasa profesional
- Masalah: banyak proses manual di WhatsApp & spreadsheet
- Pengambil keputusan: owner / ops manager
Dipakai oleh [[SOP Sales - Kualifikasi Lead]] dan [[SOP Marketing - Content Pipeline]].
`, ['market']);
  note('Analisis Kompetitor', 'Data & Research/Research', `
# Analisis Kompetitor
| Kompetitor | Kekuatan | Kelemahan |
|---|---|---|
| Zapier | Integrasi banyak | Mahal, bahasa Inggris |
| Make | Fleksibel | Kurva belajar tinggi |
| Lokal X | Harga murah | Fitur terbatas |
Peluang: lokal, bahasa Indonesia, integrasi WhatsApp. Lihat [[Ideal Customer Profile]].
`, ['research'], 'bayu');
  note('OKR Kuartal Ini', 'Company', `
# OKR Kuartal Ini
**O1: Tumbuhkan revenue**
- KR1: 120 pelanggan berbayar baru
- KR2: MRR Rp 150 juta
**O2: Pelanggan bahagia**
- KR1: NPS ≥ 50, KR2: churn < 3%
**O3: Efisiensi**
- KR1: 70% pekerjaan rutin dikerjakan AI
Dipantau lewat [[SOP Data - Laporan KPI]].
`, ['okr', 'pinned']);
  note('Brand Guidelines', 'Marketing/Strategy', `
# Brand Guidelines
- Tone: ramah, percaya diri, tanpa jargon berlebihan
- Bahasa: Indonesia santai-profesional, sapaan "kamu"
- Warna: biru #5B8CFF, aksen kuning #FFD166
- Tagline: "Kerja lebih ringan, bisnis lebih kencang."
Dipakai di [[SOP Marketing - Content Pipeline]].
`, ['marketing', 'brand'], 'maya');
  const sop = (title, folder, owner, steps, links) =>
    note(title, folder, `# ${title}\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nTerkait: ${links.map((l) => `[[${l}]]`).join(', ')}`, ['sop'], owner);
  sop('SOP Marketing - Content Pipeline', 'SOP', 'maya', ['Riset topik dari pain point ICP', 'Buat outline & hook', 'Tulis draft sesuai brand voice', 'Review oleh Head of Marketing', 'Publikasi setelah persetujuan manusia', 'Ukur performa 7 hari'], ['Brand Guidelines', 'Ideal Customer Profile', 'Kebijakan Persetujuan']);
  sop('SOP Sales - Kualifikasi Lead', 'SOP', 'bima', ['Cocokkan lead dengan ICP', 'Skor BANT (Budget, Authority, Need, Timing)', 'Lead skor ≥ 3 dijadwalkan demo', 'Kirim proposal dengan pricing standar', 'Diskon > 20% perlu persetujuan CFO'], ['Ideal Customer Profile', 'Pricing']);
  sop('SOP Engineering - Rilis Fitur', 'SOP', 'nara', ['PRD disetujui PM', 'Desain teknis & estimasi', 'Implementasi + unit test', 'QA test plan & regresi', 'Rilis bertahap + monitoring', 'Release notes ke CS'], ['Produk & Layanan', 'SOP CS - Penanganan Tiket']);
  sop('SOP CS - Penanganan Tiket', 'SOP', 'putri', ['Respons pertama < 15 menit', 'Kategorikan: bug / pertanyaan / permintaan fitur', 'Bug → eskalasi ke Engineering', 'Tutup tiket dengan konfirmasi pelanggan', 'Update FAQ bila pertanyaan berulang'], ['SOP Engineering - Rilis Fitur', 'Produk & Layanan']);
  sop('SOP Finance - Budget & Invoice', 'SOP', 'hendra', ['Setiap pengeluaran punya pemilik budget', 'Invoice diterbitkan H+1 setelah closing', 'Rekonsiliasi mingguan', 'Pengeluaran > Rp 5 juta butuh persetujuan', 'Laporan bulanan ke Owner'], ['Kebijakan Persetujuan', 'OKR Kuartal Ini']);
  sop('SOP HR - Rekrutmen', 'SOP', 'sari', ['Head divisi mengajukan kebutuhan', 'Recruiter menyusun job description', 'Screening & interview terstruktur', 'Offer disetujui Owner', 'Onboarding 30-60-90 hari'], ['Nilai Perusahaan', 'Struktur Organisasi']);
  sop('SOP Ops - Pengadaan Vendor', 'SOP', 'adi', ['Definisikan kebutuhan & budget', 'Bandingkan minimal 3 vendor', 'Cek legal & kontrak', 'Persetujuan sesuai nilai', 'Evaluasi vendor tiap kuartal'], ['SOP Legal - Review Kontrak', 'SOP Finance - Budget & Invoice']);
  sop('SOP Legal - Review Kontrak', 'SOP', 'rudi', ['Identifikasi pihak & nilai kontrak', 'Cek klausul risiko: liabilitas, terminasi, data pribadi (UU PDP)', 'Beri redline & catatan', 'Kontrak final ditandatangani setelah persetujuan Owner'], ['Kebijakan Persetujuan']);
  sop('SOP Data - Laporan KPI', 'SOP', 'lintang', ['Tarik data penjualan, marketing, CS', 'Bandingkan dengan target OKR', 'Tulis 3 insight + 3 rekomendasi', 'Publikasikan ke Brain folder Reports'], ['OKR Kuartal Ini']);
  sop('SOP Design - Design Review', 'SOP', 'alya', ['Brief desain disetujui (tujuan, audiens, deliverable)', 'Eksplorasi 2-3 arah konsep', 'Review heuristik UX & aksesibilitas', 'Konsistensi dengan design system & Brand Guidelines', 'Handoff ke Engineering/Marketing dengan spesifikasi lengkap'], ['Brand Guidelines', 'Persona Pelanggan UMKM']);
  sop('SOP IT - Akses & Insiden Keamanan', 'SOP', 'bagas', ['Akses diberikan dengan prinsip least privilege dan disetujui atasan', 'Wajib MFA untuk semua sistem inti', 'Insiden: lapor < 1 jam ke Head of IT, containment, lalu pemulihan', 'Insiden data pribadi dilaporkan ke Owner & Legal (UU PDP)', 'Post-mortem tertulis dalam 3 hari kerja'], ['Kebijakan Keamanan Data', 'Kebijakan Persetujuan']);
  note('Kebijakan Keamanan Data', 'Company', `
# Kebijakan Keamanan Data
- Klasifikasi data: **Publik**, **Internal**, **Rahasia** (data pelanggan, keuangan, HR).
- Data Rahasia tidak boleh dibagikan ke luar tanpa persetujuan Owner.
- Kepatuhan **UU PDP**: kumpulkan data seperlunya, simpan sesuai retensi, hapus bila diminta.
- Semua sistem memakai MFA dan akses berbasis peran.
- Insiden ditangani sesuai [[SOP IT - Akses & Insiden Keamanan]].
`, ['policy', 'security'], 'bagas');
  note('Persona Pelanggan UMKM', 'Marketing/Strategy', `
# Persona Pelanggan UMKM
## 1. Bu Rina — Owner toko retail (3 cabang)
- Masalah: rekap stok & penjualan manual via WhatsApp dan Excel
- Tujuan: tahu omzet harian tanpa menunggu laporan
- Keberatan: "takut ribet", harga
## 2. Pak Dedi — Ops Manager distributor
- Masalah: order tercecer, salah kirim
- Tujuan: alur order-to-delivery yang rapi
- Keberatan: integrasi dengan sistem lama
## 3. Mbak Sasa — Founder F&B
- Masalah: promosi & pesanan online tidak terpantau
- Tujuan: naikkan repeat order
Terkait: [[Ideal Customer Profile]], [[Pricing]]
`, ['market', 'persona'], 'kirana');
  note('KPI Dictionary', 'Company', `
# KPI Dictionary
| KPI | Definisi | Rumus | Pemilik |
|---|---|---|---|
| MRR | Pendapatan berulang bulanan | Σ langganan aktif × harga | Finance |
| CAC | Biaya akuisisi pelanggan | Biaya S&M / pelanggan baru | Marketing |
| LTV | Nilai seumur hidup pelanggan | ARPU × margin / churn | Finance |
| Churn | Pelanggan berhenti | Pelanggan hilang / awal bulan | CS |
| NPS | Loyalitas | %Promoter − %Detractor | CS |
| Win rate | Konversi deal | Deal menang / deal ditutup | Sales |
| Aktivasi 7 hari | Pelanggan mencapai aha moment | Aktif D7 / pendaftar | Product |
Dipakai di [[SOP Data - Laporan KPI]] dan [[OKR Kuartal Ini]].
`, ['kpi', 'data'], 'lintang');
  note('Template Laporan Mingguan', 'Company', `
# Template Laporan Mingguan
1. **Ringkasan** (3 kalimat): kondisi, pencapaian utama, perhatian utama
2. **KPI** vs target (tabel dengan status 🟢🟡🔴)
3. **Yang selesai** minggu ini
4. **Hambatan** & bantuan yang dibutuhkan
5. **Rencana** minggu depan (aksi · pemilik · tenggat)
Lihat [[KPI Dictionary]].
`, ['template'], 'aria');
  note('Roadmap Produk', 'Company', `
# Roadmap Produk
| Kuartal | Tema | Fitur |
|---|---|---|
| Q4 | Integrasi | Integrasi WhatsApp Business, webhook, laporan otomatis |
| Q1 | Skala | Multi-cabang, role & permission, audit log |
| Q2 | Kecerdasan | Rekomendasi AI, prediksi stok |
Detail teknis mengikuti [[SOP Engineering - Rilis Fitur]].
`, ['product', 'roadmap'], 'fajar');
  note('Playbook Onboarding Pelanggan', 'SOP', `
# Playbook Onboarding Pelanggan
- **Aha moment**: workflow pertama berjalan otomatis
- **D0** sambutan + setup akun · **D1** workflow pertama (template) · **D3** undang tim · **D7** cek aktivasi · **D14** review hasil
- Pelanggan tidak aktif D3 → telepon/DM oleh CS
- Metrik: [[KPI Dictionary]] (Aktivasi 7 hari)
Terkait [[SOP CS - Penanganan Tiket]].
`, ['sop', 'cs'], 'putri');
  sop('SOP R&D - Formulasi & Uji Stabilitas', 'SOP', 'anisa', ['Brief produk dari NPD (target klaim, tipe kulit, harga target)', 'Formula prototipe dengan INCI & persentase', 'Uji stabilitas dipercepat 3 bulan + kompatibilitas kemasan', 'Uji keamanan (HRIPT/patch test) dan efikasi bila klaim membutuhkan', 'Review gate oleh Head of R&D, Regulatory, QA', 'Transfer teknologi ke Manufacturing'], ['Produk Ray Beauty', 'Pedoman Klaim Kosmetik']);
  sop('SOP Produksi - CPKB', 'SOP', 'wahyu', ['Jadwal produksi dari PPIC', 'Line clearance & sanitasi area', 'Penimbangan bahan dengan verifikasi ganda', 'Proses sesuai batch record dan parameter kritis', 'IPC (in-process control) oleh QC', 'Filling, packing, rekonsiliasi kemasan', 'Karantina produk jadi sampai release QA'], ['SOP QC - Pengujian & Release Batch', 'Produk Ray Beauty']);
  sop('SOP QC - Pengujian & Release Batch', 'SOP', 'lestari', ['Sampling bahan baku saat datang (CoA + uji identitas)', 'Uji ruahan: pH, viskositas, organoleptik', 'Uji produk jadi: mikroba, berat/volume, kebocoran', 'OOS → investigasi & CAPA', 'Release oleh QA Manager; sampel pertinggal disimpan'], ['SOP Produksi - CPKB']);
  sop('SOP Regulasi - Notifikasi BPOM & Halal', 'SOP', 'melati', ['Cek bahan terhadap daftar larangan/batasan', 'Siapkan DIP/PIF, formula, CoA, desain label', 'Review klaim sesuai Pedoman Klaim Kosmetik', 'Ajukan notifikasi BPOM; pantau status', 'Sertifikasi halal lewat BPJPH bila diwajibkan', 'Produk tidak boleh dijual sebelum nomor notifikasi terbit'], ['Pedoman Klaim Kosmetik', 'Kebijakan Persetujuan']);
  sop('SOP Gudang - FEFO & Stock Opname', 'SOP', 'rini', ['Penerimaan barang dengan pengecekan dokumen & kondisi', 'Penyimpanan sesuai suhu & kelembapan', 'Pengeluaran FEFO (first expired first out)', 'Stock opname bulanan & cycle count mingguan untuk SKU A', 'Produk < 6 bulan kedaluwarsa dilaporkan ke Sales/E-commerce'], ['Produk Ray Beauty']);
  sop('SOP Marketplace - Listing & Kampanye', 'SOP', 'jessica', ['Listing wajib: judul ber-keyword, 9 foto, video, deskripsi patuh klaim', 'Harga & voucher mengikuti batas margin Finance', 'Kalender kampanye tanggal kembar disusun H-30', 'Stok dikunci dengan Demand Planner sebelum kampanye', 'Evaluasi ROAS & GMV H+3 setelah kampanye'], ['Kalender Kampanye E-commerce', 'Pedoman Klaim Kosmetik']);
  note('Produk Ray Beauty', 'Company', `
# Produk Ray Beauty
| SKU | Produk | Ukuran | Harga | Bahan kunci |
|---|---|---|---|---|
| RB-SR01 | Bright Serum Niacinamide 5% | 30 ml | Rp 129.000 | Niacinamide, alpha arbutin |
| RB-SS02 | Daily Sunscreen SPF 50 PA++++ | 50 ml | Rp 99.000 | Filter UV hybrid, ceramide |
| RB-MS03 | Barrier Moisturizer Ceramide | 50 g | Rp 89.000 | Ceramide, panthenol |
| RB-CL04 | Gentle Low-pH Cleanser | 100 ml | Rp 69.000 | Amino acid surfactant |
- Target: perempuan & laki-laki 18-35, kulit berminyak/kombinasi, iklim tropis
- Kanal: Shopee, Tokopedia, TikTok Shop, website, reseller
- Diproduksi di pabrik sendiri sesuai [[SOP Produksi - CPKB]]; klaim mengikuti [[Pedoman Klaim Kosmetik]]
`, ['product', 'beauty'], 'nadia');
  note('Pedoman Klaim Kosmetik', 'Company', `
# Pedoman Klaim Kosmetik
- Kosmetik **tidak boleh** mengklaim menyembuhkan/mengobati (mis. "menghilangkan jerawat permanen", "menyembuhkan flek")
- Klaim harus didukung data (uji in-vitro/in-vivo/konsumen) dan disimpan di Brain
- Hindari superlatif mutlak tanpa bukti ("paling", "100%", "nomor 1")
- Gunakan bahasa aman: "membantu", "tampak", "menjaga"
- Materi KOL & iklan direview oleh Claims & Labeling sebelum tayang
Terkait: [[SOP Regulasi - Notifikasi BPOM & Halal]]
`, ['policy', 'beauty'], 'kevin');
  note('Kalender Kampanye E-commerce', 'E-commerce & Marketplace/Plan', `
# Kalender Kampanye E-commerce
| Bulan | Momen | Catatan |
|---|---|---|
| Jan | Payday, New Year | bundling skincare routine |
| Mar–Apr | Ramadan & Lebaran | stok +40%, hampers |
| 9.9, 10.10, 11.11 | tanggal kembar | flash sale + live |
| 12.12 & Harbolnas | puncak tahunan | stok dikunci H-30 |
Lihat [[SOP Marketplace - Listing & Kampanye]].
`, ['marketing', 'ecommerce'], 'jessica');
  note('Glossary', 'Company', `
# Glossary
- **MRR**: Monthly Recurring Revenue
- **ICP**: [[Ideal Customer Profile]]
- **NPS**: Net Promoter Score
- **HITL**: Human-in-the-loop, lihat [[Kebijakan Persetujuan]]
`, ['company']);

  note('Panduan Taksonomi Brain', 'SOP', `
# Panduan Taksonomi Brain
Brain perusahaan disusun 2 level: **<Nama Divisi>/<Jenis>**. Semua hasil kerja agen otomatis diklasifikasikan saat disimpan; tim Knowledge & AI Ops (Arsa, Widya — lihat [[Struktur Organisasi]]) merapikan sisanya setiap hari.

| Jenis | Isi |
|---|---|
| Research | riset pasar, kompetitor, literatur, benchmark |
| Strategy | strategi, OKR, SWOT, positioning, business case |
| Plan | rencana, timeline, kalender, forecast |
| Report | laporan rutin, KPI, ringkasan status |
| SOP | prosedur, checklist, panduan kerja |
| Policy | kebijakan, regulasi, kepatuhan, kontrak |
| Content | copy, konten, kampanye, email |
| Design | brief visual, UI/UX, kemasan |
| Analysis | analisis, audit, evaluasi, perhitungan biaya |
| Data / Technical | skema data, arsitektur, integrasi |
| Meeting / Training | notulen rapat, materi & dataset pelatihan |

Folder sistem tetap di level atas: Company, SOP, Meetings, Playbooks, Memori, Archive.

**Penamaan:** judul deskriptif "<Topik> — <Jenis>" bila perlu, tanpa nama orang, tanpa tanda kutip, maks 80 karakter.
**Duplikat:** digabung ke catatan terlengkap; duplikat dipindah ke Archive dengan tautan.
Terkait: [[Cara Kerja AI + Manusia]]
`, ['sop', 'knowledge'], 'pustaka');

  // attach each division's SOP + company basics as default knowledge for its AI employees
  const SOP_OF = { mkt: 'SOP Marketing - Content Pipeline', sales: 'SOP Sales - Kualifikasi Lead', eng: 'SOP Engineering - Rilis Fitur', cs: 'SOP CS - Penanganan Tiket', fin: 'SOP Finance - Budget & Invoice', hr: 'SOP HR - Rekrutmen', ops: 'SOP Ops - Pengadaan Vendor', legal: 'SOP Legal - Review Kontrak', data: 'SOP Data - Laporan KPI', exec: 'OKR Kuartal Ini', design: 'SOP Design - Design Review', it: 'SOP IT - Akses & Insiden Keamanan', rnd: 'SOP R&D - Formulasi & Uji Stabilitas', mfg: 'SOP Produksi - CPKB', qa: 'SOP QC - Pengujian & Release Batch', reg: 'SOP Regulasi - Notifikasi BPOM & Halal', scm: 'SOP Gudang - FEFO & Stock Opname', ecom: 'SOP Marketplace - Listing & Kampanye', kms: 'Panduan Taksonomi Brain' };
  const EXTRA_KB = { mkt: ['Ideal Customer Profile', 'Brand Guidelines', 'Persona Pelanggan UMKM'], sales: ['Ideal Customer Profile', 'Pricing', 'Persona Pelanggan UMKM'], eng: ['Roadmap Produk', 'Kebijakan Keamanan Data'], design: ['Brand Guidelines', 'Persona Pelanggan UMKM'], cs: ['Playbook Onboarding Pelanggan', 'Produk & Layanan'], fin: ['Pricing', 'KPI Dictionary'], hr: ['Nilai Perusahaan'], ops: ['Cara Kerja AI + Manusia'], legal: ['Kebijakan Keamanan Data'], it: ['Kebijakan Keamanan Data'], data: ['KPI Dictionary', 'Template Laporan Mingguan'], exec: ['Template Laporan Mingguan', 'KPI Dictionary'], rnd: ['Produk Ray Beauty', 'Pedoman Klaim Kosmetik'], mfg: ['Produk Ray Beauty', 'SOP QC - Pengujian & Release Batch'], qa: ['Produk Ray Beauty', 'SOP Produksi - CPKB'], reg: ['Pedoman Klaim Kosmetik', 'Produk Ray Beauty'], scm: ['Produk Ray Beauty', 'Kalender Kampanye E-commerce'], ecom: ['Produk Ray Beauty', 'Kalender Kampanye E-commerce', 'Pedoman Klaim Kosmetik'], kms: ['Cara Kerja AI + Manusia', 'Struktur Organisasi'] };
  for (const e of employees) {
    ensureEmployeeConfig(e, SEED_SKILLS);
    autoActivate(e, SEED_SKILLS);
    if (e.type === 'ai') e.knowledgeIds = [...new Set([SOP_OF[e.divisionId], 'Kebijakan Persetujuan', ...(EXTRA_KB[e.divisionId] || [])].map(slug))].filter((id) => notes.some((n) => n.id === id));
  }

  notes.push(...knowledgeNotes(t)); attachKnowledge(employees, notes);
  const channels = [
    { id: 'general', name: 'general', kind: 'channel', divisionId: null, topic: 'Pengumuman & koordinasi seluruh perusahaan' },
    { id: 'standup', name: 'daily-standup', kind: 'channel', divisionId: null, topic: 'Update harian otomatis dari tim' },
    ...DIVISIONS.map((d) => ({ id: `div-${d.id}`, name: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), kind: 'channel', divisionId: d.id, topic: d.mission })),
  ];

  const routines = [
    { id: 'r-standup', employeeId: 'aria', title: 'Standup pagi lintas divisi', description: 'Gunakan company_status, rangkum progres, hambatan, dan prioritas hari ini. Post ringkas ke #standup lewat send_message. Jangan membuat tugas baru.', cron: '30 8 * * 1-5', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-kpi', employeeId: 'lintang', title: 'Laporan KPI mingguan', description: 'Susun laporan KPI vs OKR sesuai SOP Data - Laporan KPI dan Template Laporan Mingguan.', cron: '0 16 * * 5', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-social', employeeId: 'sinta', title: 'Ide konten sosial media', description: 'Buat 5 ide posting sesuai Brand Guidelines untuk RayFlow dan Ray Beauty.', cron: '0 9 * * 1,3,5', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-market', employeeId: 'putra', title: 'Pantau harga kompetitor marketplace', description: 'Riset harga & promo 5 kompetitor skincare di Shopee/Tokopedia (web_search), tulis ringkasan dan rekomendasi harga.', cron: '0 10 * * 1', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-reg', employeeId: 'melati', title: 'Pantau perubahan regulasi kosmetik', description: 'Riset perubahan regulasi BPOM/halal terbaru (web_search) dan perbarui catatan Brain bila ada.', cron: '0 9 * * 2', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-librarian', employeeId: 'arsa', title: 'Rapikan Brain harian', description: 'Jalankan organize_brain. Pindahkan catatan yang belum terklasifikasi ke folder <Divisi>/<Jenis> (move_note), perbaiki judul buruk (rename_note), dan gabungkan duplikat (merge_notes). Laporkan jumlah perubahan. Jangan membuat tugas baru.', cron: '0 17 * * 1-5', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-synth', employeeId: 'widya', title: 'Sintesis knowledge mingguan', description: 'Cari deliverable minggu ini (search_brain), pilih 1 topik dengan banyak catatan, tulis panduan evergreen yang menautkan sumbernya (write_note ke folder <Divisi>/Knowledge).', cron: '0 13 * * 3', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-dataset', employeeId: 'gita', title: 'Perbarui dataset training', description: 'Jalankan build_training_set untuk seluruh perusahaan (min_quality 7), lalu tulis catatan versi dataset (jumlah contoh, kriteria) ke folder Knowledge & AI Ops/Training.', cron: '0 14 * * 5', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-eval', employeeId: 'sekar', title: 'Evaluasi kualitas agen', description: 'Gunakan company_status dan catatan Playbook untuk menilai kualitas kerja minggu ini per divisi, lalu rekomendasikan agen yang perlu dilatih.', cron: '0 11 * * 4', everyMinutes: 0, enabled: true, lastRunAt: t },
    { id: 'r-faq', employeeId: 'wulan', title: 'Update FAQ pelanggan', description: 'Tinjau pertanyaan berulang dan perbarui FAQ di Brain.', cron: '0 15 * * 3', everyMinutes: 0, enabled: false, lastRunAt: t },
    ...DIVISIONS.map((d) => ({ id: `r-retro-${d.id}`, employeeId: ROSTER.find((x) => x.div === d.id && x.lead).id, title: `Retro & berbagi ilmu ${d.name}`, description: 'Baca Playbook divisimu dan pelajaran tim. Pilih 1 pelajaran terpenting: latih satu anggota (train_colleague) dan, bila metode skill perlu diperbaiki, perbarui skill (improve_skill). Tulis ringkasan retro singkat. Jangan membuat tugas baru.', cron: '0 15 * * 5', everyMinutes: 0, enabled: true, lastRunAt: t })),
    ...DIVISIONS.map((d, i) => ({ id: `r-execute-${d.id}`, employeeId: ROSTER.find((x) => x.div === d.id && x.lead).id, targetType: 'division', targetId: d.id, title: `Eksekusi nyata harian — ${d.name}`, description: 'Periksa tugas dan prioritas divisi. Pilih satu tindakan konkret bernilai tertinggi yang belum selesai, konsultasikan maksimal dua staf relevan, eksekusi memakai tool yang tersedia, lalu kirim hasil dan bukti ke channel divisi. Untuk Google/sistem eksternal, hasil hanya boleh disebut berhasil jika ada receipt ID/URL/range; bila konektor belum aktif tulis BELUM TEREKSEKUSI. Bagikan satu pelajaran untuk tim.', cron: `${(5 + i * 7) % 60} ${9 + Math.floor(i / 8)} * * 1-5`, everyMinutes: 0, enabled: true, lastRunAt: t, createdBy: 'system-v8' })),
  ];

  const out = {
    version: SCHEMA_VERSION,   // satu sumber dengan migrate() di store.js
    meetings: [],
    company: { name: 'Ray Group', tagline: 'Kerja lebih ringan, bisnis lebih kencang.', language: 'Bahasa Indonesia' },
    divisions: DIVISIONS.map((d) => ({ ...d, teams: (TEAMS[d.id] || []).map((x) => x.name), delegation: 'best_fit', leadId: ROSTER.find((r) => r.div === d.id && r.lead)?.id || null })),
    skills: SEED_SKILLS.map((s) => ({ ...s, createdAt: t })),
    employees, notes, channels, routines,
    tasks: [], messages: [], approvals: [], events: [],
    usage: { day: new Date().toISOString().slice(0, 10), costToday: 0, costTotal: 0, tokensIn: 0, tokensOut: 0, calls: 0 },
    settings: {
      apiKey: '', model: 'claude-opus-5-5', workerModel: 'claude-opus-5-5', effort: 'low',
      provider: 'auto', groqApiKey: '', groqModel: 'openai/gpt-oss-120b', groqWorkerModel: 'openai/gpt-oss-120b',
      autonomy: true, tickMs: 2500, maxConcurrent: 3, dailyBudgetUSD: 5, mode: 'auto', currentUserId: 'owner', autoActivate: true, autoOrganize: true,
      autoApprove: true, massDispatchSize: 20, googleAppsScript: { url: '', secret: '', enabled: false },
      staffModel: false,   // bendera P0: staf = workflow n8n; mati = perilaku lama (lihat docs/PAGAR-SINKRONISASI.md)
    },
  };
  flattenMasterBoss(out);   // master dan PA setara di bawah owner
  for (const e of out.employees) if (e.type === 'ai') e.voiceGender = inferGender(e.name || e.id);   // suara tersimpan sejak awal
  normalizeOrg(out);        // role, characterId, staffId, satu manajer per divisi, kontrak 3D
  installPower(out); out.powerRev = POWER_REV;   // paket skill super langsung terpasang ke agen yang relevan
  return out;
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 80) || 'note';
}
