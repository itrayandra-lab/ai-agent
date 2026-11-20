// Natural, varied Indonesian small talk for the 3D office. Nothing here touches the network: lines are picked locally,
// avoiding the most recent ones, and filled with names / time of day. Add lines freely; the engine only needs the pools.
const R = (a) => a[(Math.random() * a.length) | 0];
const recent = [];
const fresh = (pool, fill) => {
  let s = ''; for (let i = 0; i < 6; i++) { s = fill(R(pool)); if (!recent.includes(s)) break; }
  recent.push(s); if (recent.length > 60) recent.shift(); return s;
};
export const periodOf = (h) => (h >= 4.5 && h < 11 ? 'pagi' : h >= 11 && h < 15 ? 'siang' : h >= 15 && h < 18.5 ? 'sore' : 'malam');

const GREET = {
  pagi: ['Pagi, {o}! ☀️', 'Eh {o}, udah sarapan?', 'Selamat pagi {o}, semangat ya!', 'Pagi {o}! Kopi dulu yuk ☕', '{o}! Pagi-pagi udah rapi aja 😄'],
  siang: ['Siang {o}! Udah makan?', 'Hai {o}, panas ya hari ini 😅', 'Eh {o}, lagi istirahat juga?', '{o}! Pas banget ketemu di sini', 'Halo {o}, makan siang apa nih?'],
  sore: ['Sore {o}! Hampir kelar nih 😌', 'Eh {o}, sore-sore begini enaknya ngopi', 'Hai {o}, langitnya bagus ya sore ini 🌇', '{o}! Capek ya hari ini?', 'Sore {o}, tinggal sedikit lagi!'],
  malam: ['Malam {o}, masih semangat? 🌙', 'Eh {o}, bintangnya cantik banget malam ini ✨', 'Hai {o}, lembur juga?', '{o}! Sepi ya kalau malam gini', 'Malam {o}, jangan lupa istirahat ya'],
};
const GREET_BACK = ['Halo juga {o}!', 'Eh iya, apa kabar?', 'Hai! Lama nggak ngobrol 😄', 'Wah kebetulan banget!', 'Baik! Kamu gimana?', 'Hehe iya {o}, kebetulan lewat', 'Hai {o}! Baru aja mau nyapa'];

// topics: opener (A) → reply (B) → follow-up (A) → reply (B)
const TOPICS = {
  kerja: {
    open: ['Kerjaan hari ini lumayan padat ya?', 'Eh, progres tugas kamu udah sampai mana?', 'Aku lagi mentok di satu bagian nih, ada ide?', 'Target minggu ini kayaknya bisa kekejar sih', 'Tadi aku baca brief barunya, menarik juga', 'Kamu ikut rapat tadi? Keputusannya apa?'],
    reply: ['Lumayan, tapi masih aman kok', 'Hampir selesai, tinggal rapi-rapi', 'Coba pecah jadi langkah kecil dulu deh', 'Iya nih, aku juga lagi ngejar deadline', 'Nanti aku bantu cek ya', 'Ikut. Intinya kita fokus ke prioritas yang paling berdampak'],
    follow: ['Kalau gitu nanti aku kirim draft-nya ya', 'Oke, kita sinkron habis ini', 'Makasih ya, jadi lebih jelas', 'Siap, nanti aku tanya tim juga', 'Mantap, aku catat di Catatan biar nggak lupa 🧠'],
    back: ['Sama-sama, santai aja', 'Kapan pun, tinggal panggil', 'Nanti kabari ya hasilnya', 'Gas! 💪', 'Sip, semangat!'],
  },
  makan: {
    open: ['Kamu udah coba kopi di kios taman? Enak lho ☕', 'Laper nih… ada rekomendasi makan?', 'Tadi aku nyobain es kopi susu, juara!', 'Kantin hari ini menunya apa ya?', 'Aku lagi pengen camilan manis 🍪', 'Kopi atau teh? Aku tim kopi sih'],
    reply: ['Wah mau dong, nanti aku ikut!', 'Aku sih tim teh hangat 🍵', 'Coba deh yang karamel, enak banget', 'Hahaha, kamu nggak pernah kenyang ya', 'Boleh, aku traktir minuman nanti', 'Setuju, jam segini emang waktunya ngemil'],
    follow: ['Yuk ke kios bareng habis ini', 'Nanti aku bawain satu ya', 'Kita kumpulin yang lain biar rame', 'Oke deal, jangan lupa ya!'],
    back: ['Siap, ditunggu!', 'Hehe, jangan kelamaan', 'Sampai ketemu di kios ☕', 'Yes, asik!'],
  },
  hobi: {
    open: ['Weekend kemarin kamu ngapain aja?', 'Lagi ada series bagus nggak buat ditonton?', 'Aku lagi belajar main gitar, jarinya sakit 😅', 'Kamu suka lari pagi nggak? Aku baru mulai', 'Aku lagi nyoba bikin proyek kecil sendiri', 'Ada rekomendasi buku seru?'],
    reply: ['Santai aja di rumah, tidur banyak 😴', 'Ada! Judulnya bikin susah berhenti nonton', 'Hahaha semangat, nanti mainin satu lagu buat aku', 'Wah keren, aku masih males-malesan', 'Proyek apa? Ceritain dong!', 'Aku lagi baca soal kebiasaan kecil, bagus banget'],
    follow: ['Nanti aku kirim judulnya', 'Kapan-kapan kita jam session ya 🎸', 'Boleh gabung kalau udah jadi?', 'Aku jadi pengen coba juga deh'],
    back: ['Siap, aku tunggu!', 'Hehe, jadi semangat nih', 'Ayo, kapan-kapan bareng', 'Seru banget kayaknya!'],
  },
  langit: {
    open: ['Lihat deh kubahnya, cantik banget ya', 'Awan hari ini lucu bentuknya ☁️', 'Kadang aku lupa kita ada di stasiun luar angkasa 😂', 'Burung-burung itu dari mana ya? Bagus banget', 'Lihat bintang jatuh tadi nggak? ✨', 'Kota melayang di luar itu keren ya dari sini'],
    reply: ['Iya, tiap hari kelihatan beda', 'Hahaha betul, suka kelupaan', 'Aku sampai berhenti jalan tadi saking bagusnya', 'Kayaknya itu dari taman atas deh', 'Nggak lihat! Yah, ketinggalan', 'Dari Sky Deck pemandangannya lebih keren lho'],
    follow: ['Nanti kita naik ke Sky Deck bareng yuk', 'Aku mau foto ah, buat kenang-kenangan 📸', 'Rasanya tenang ya lihat begini', 'Bikin semangat kerja lagi sih'],
    back: ['Ayo, mumpung belum gelap', 'Setuju banget', 'Hehe, jadi pengen rebahan di rumput', 'Iya, bikin adem 🌿'],
  },
  kantor: {
    open: ['Kamu udah lihat plaza yang baru? Ada air mancurnya 😍', 'Catatan tadi menyala terang banget, ada yang baru belajar kali ya', 'Katanya bakal ada demo di panggung nanti', 'Kamu tahu nggak, Sky Deck sekarang bisa dinaiki', 'Aku suka suasana kantor ini, hidup banget', 'Tadi ada drone lewat di atas kepala, lucu ya'],
    reply: ['Udah! Aku sempat duduk di bangkunya', 'Iya, aku juga lihat. Jadi penasaran', 'Wah jam berapa? Aku mau nonton', 'Udah dong, tangganya panjang tapi worth it', 'Setuju, nggak monoton', 'Hahaha, kayak di film ya'],
    follow: ['Kita nonton bareng ya', 'Nanti aku ajak yang lain', 'Besok aku mau coba kios kopinya juga', 'Pokoknya betah banget di sini'],
    back: ['Sip, jangan lupa kabari', 'Ayo ayo!', 'Hehe, kantor impian 😄', 'Setuju!'],
  },
  curhat: {
    open: ['Jujur aku agak capek hari ini 😮‍💨', 'Kadang aku ragu sama keputusan tadi', 'Aku lagi coba atur waktu lebih baik, susah juga', 'Deadline numpuk, kepala rasanya penuh', 'Aku kangen libur panjang deh 😅', 'Ada waktu bentar? Mau cerita sedikit'],
    reply: ['Wajar kok, istirahat sebentar aja dulu', 'Kamu udah hebat banget, serius', 'Coba satu hal dulu yang paling penting', 'Aku juga pernah di posisi itu, pasti lewat', 'Ayo duduk dulu, aku dengerin', 'Mau aku bantu bagi tugasnya?'],
    follow: ['Makasih ya, jadi lebih lega', 'Iya, aku coba tarik napas dulu 🧘', 'Aku beruntung punya rekan kayak kamu', 'Oke, kita beresin satu-satu'],
    back: ['Kapan pun kamu butuh, bilang ya', 'Kita bareng-bareng kok 🤝', 'Pelan-pelan aja, nggak apa-apa', 'Semangat, aku di sini'],
  },
  teknologi: {
    open: ['Kamu udah coba fitur baru buat pembantu?', 'Aku penasaran gimana Catatan nyimpan semua pengetahuan itu', 'Kayaknya otomatisasi bisa hemat banyak waktu kita', 'Tadi aku lihat grafik kinerjanya, naik terus lho', 'Otak yang kita pakai makin cepat ya', 'Aku lagi eksperimen cara bertanya yang baru, hasilnya lucu'],
    reply: ['Udah, lumayan ngebantu', 'Katanya dia bikin graf dari catatan kita 🧠', 'Betul, tapi tetap perlu dicek manusia', 'Wah mantap, tim kita makin solid', 'Iya, responsnya hampir instan', 'Coba tunjukin dong hasilnya'],
    follow: ['Nanti aku tulis di catatan biar yang lain tahu', 'Kita bikin demo kecil di panggung yuk', 'Ada yang bisa kita otomatisasi lagi kayaknya', 'Seru ya jadi bagian dari ini semua'],
    back: ['Setuju banget', 'Boleh, atur jadwalnya', 'Hehe, masa depan banget', 'Gas eksperimennya!'],
  },
  lucu: {
    open: ['Tadi aku salah masuk ruangan, malu banget 😂', 'Kamu tahu nggak, kursiku bunyinya lucu kalau digeser', 'Ada yang ngelihat aku kepleset di plaza tadi? Hahaha', 'Aku hampir ngetik pesan ke orang yang salah 🙈', 'Pernah nggak sih kamu ngomong sendiri terus ketahuan?', 'Ada burung yang berani banget nyamperin kursiku'],
    reply: ['Hahaha, aku bayangin mukamu!', 'Serius? Aku harus coba deh', 'Nggak lihat, tapi aku yakin gayanya mantap 😂', 'Duh, relatable banget', 'Haha itu mah kejadian tiap hari', 'Ya ampun, pasti seru banget lihatnya'],
    follow: ['Udahlah, ketawa aja', 'Hari ini rasanya ringan gara-gara ini', 'Besok kita lanjut cerita lagi ya', 'Aku sampai sakit perut ketawa'],
    back: ['Hahaha iya', 'Jangan diulang ya 😂', 'Cerita lagi dong!', 'Seru banget kamu'],
  },
};
const CLOSE = ['Oke, aku lanjut dulu ya. Sampai nanti!', 'Seru ngobrol sama kamu, nanti lagi ya', 'Aku balik dulu, dadah 👋', 'Ya udah, semangat ya!', 'Dah ya, nanti kita sambung', 'Sampai ketemu lagi di plaza 🌿', 'Aku pamit dulu, jangan lupa istirahat'];

// profession lines: said out loud while someone does their job somewhere in the open
const PROF = {
  content: ['Halo guys, balik lagi di channel aku! 🎬', 'Jangan lupa like, share, dan subscribe ya!', 'Take dua, tadi suaranya kurang jelas', 'Hari ini aku mau bahas fitur terbaru kita 📸', 'Oke kamera… 3, 2, 1, action!', 'Pencahayaannya udah pas belum?', 'Caption-nya mau yang lucu atau yang serius?', 'Ini konten buat besok jam tujuh pagi, jadwalkan ya', 'Wah, view-nya naik terus nih 📈', 'Cut! Kita ulang bagian pembukaan'],
  sketch: ['Warna ini terlalu pucat, tambah sedikit kontras', 'Aku coba layout yang lebih lega ya', 'Tipografinya kayaknya perlu diganti 🎨', 'Nah, begini baru enak dilihat', 'Sketsa kasar dulu, rapi-rapinya belakangan', 'Pakai grid delapan titik biar rapi'],
  pitch: ['Paket ini cuma berlaku sampai akhir minggu! 🤝', 'Coba dulu, nggak puas kami ganti', 'Pelanggan kemarin bilang hasilnya luar biasa', 'Kalau ambil dua, ada bonus spesial lho', 'Boleh aku jelaskan manfaatnya dalam satu menit?', 'Terima kasih sudah mampir, ini kartu namaku'],
  demo: ['Hasil uji stabilitas lolos ✅', 'Sampel nomor tujuh menunjukkan hasil bagus 🔬', 'Kita ulangi sekali lagi buat memastikan', 'Catat suhunya, jangan sampai lupa', 'Datanya konsisten, aman buat lanjut', 'Hati-hati, reaksinya sensitif'],
  wellness: ['Tarik napas… hembuskan pelan 🧘', 'Regangkan bahu, sudah lama duduk', 'Sepuluh menit gerak saja bikin segar', 'Fokus ke napas, lepaskan beban hari ini', 'Peregangan leher dulu, pelan-pelan'],
  stage: ['Kuartal ini kita naik delapan belas persen 📈', 'Ini peta jalan kita ke depan ✨', 'Kita uji A/B dulu sebelum rilis', 'Brand baru siap tayang 🚀', 'Pelanggan kita makin senang 😊', 'Ada pertanyaan sebelum lanjut?'],
  deck: ['Dari atas sini kelihatan semua alurnya', 'Kita petakan dependensinya di sini ya', 'Idenya kita tulis dulu, nanti dirapikan', 'Pemandangannya bikin otak lebih jernih'],
  fountain: ['Gemericik airnya bikin tenang 🌿', 'Duduk sebentar di sini enak banget', 'Aku suka suara air mancur'],
  kiosk: ['Satu kopi susu, kurang manis ya ☕', 'Kue hari ini apa saja?', 'Aroma kopinya bikin semangat'],
  patrol: ['Area plaza aman terkendali 🛡️', 'Semua pintu terkunci dan lampu menyala', 'Tidak ada yang mencurigakan, lanjut keliling', 'Sensor aktif, semua normal'],
  brain: ['Catatan menyala terang, ada yang baru belajar', 'Rasanya pengetahuan kita tumbuh tiap hari 🧠', 'Kalau ragu, tanya Catatan saja'],
  audience: ['Bagus presentasinya! 👏', 'Boleh aku tanya soal angkanya?', 'Catat, ini penting', 'Setuju dengan poin tadi'],
};
// what a person says while doing their normal job at the desk, by division
const WORK = {
  mkt: ['Lagi susun kalender konten bulan depan 📅', 'Copy iklannya perlu dipertajam', 'Angka jangkauan kampanye naik lagi 📈', 'Aku ukur performa tiap kanal dulu'],
  sales: ['Follow-up klien yang kemarin dulu ya', 'Pipeline minggu ini kelihatan sehat 💼', 'Lagi siapin proposal penawaran', 'Satu prospek siap closing!'],
  eng: ['Bug-nya ketemu, tinggal diperbaiki 🐞', 'Lagi memeriksa perubahan kode nih', 'Kompilasinya lama banget ya', 'Tes semuanya hijau, aman 💻'],
  design: ['Lagi rapikan komponen di pustaka desain 🎨', 'Palet warnanya aku ubah sedikit', 'Mockup halaman depan hampir kelar', 'Revisi dari tim aku kerjakan sekarang'],
  cs: ['Pelanggan ini butuh balasan cepat 💬', 'Aku catat keluhan ini buat tim produk', 'Tiket hari ini hampir kosong 🙌', 'Terima kasih sudah sabar menunggu ya'],
  fin: ['Rekonsiliasi akunnya sedikit selisih 🧾', 'Laporan arus kas hampir selesai', 'Cek ulang angka sebelum dikirim', 'Anggaran kuartal ini aman'],
  hr: ['Lagi jadwalkan wawancara kandidat 🌱', 'Survei kepuasan tim hasilnya bagus', 'Menyusun program belajar bulan ini', 'Ada pegawai baru, siapin onboarding'],
  ops: ['Cek ulang prosedur operasional ⚙️', 'Semua proses berjalan lancar', 'Aku pantau metrik harian dulu', 'Ada bottleneck kecil, aku urai'],
  legal: ['Lagi baca klausul kontrak ini ⚖️', 'Perlu tambahan pasal soal data', 'Dokumen ini harus ditinjau dua kali', 'Kepatuhan aman, tinggal tanda tangan'],
  it: ['Patch keamanan terpasang 🛡️', 'Log server kelihatan normal', 'Ada percobaan login aneh, aku blok', 'Cadangan malam ini berhasil'],
  data: ['Data baru selesai dibersihkan 📊', 'Hasil hitungannya naik dua poin', 'Aku bikin dasbor buat tim', 'Ada pola menarik di data pelanggan'],
  reg: ['Memeriksa dokumen registrasi produk 📜', 'Tenggat pengajuan minggu depan', 'Aturan baru perlu kita pelajari'],
  ecom: ['Katalog produk baru diunggah 🛒', 'Stok toko online aku sinkronkan', 'Foto produknya cantik banget', 'Promo kilat siap tayang'],
  kms: ['Merapikan catatan 🗂️', 'Aku tautkan dua catatan yang terkait', 'Pengetahuan baru masuk indeks', 'Sumber ini layak disimpan'],
  exec: ['Meninjau ringkasan performa perusahaan 🧭', 'Prioritas kuartal ini harus tajam', 'Aku butuh laporan singkat dari semua divisi'],
  bizdev: ['Menjajaki kemitraan baru 🤝', 'Draf kerja sama hampir siap', 'Peta pasar ini menarik juga'],
  retail: ['Cek tata letak display toko 🛍️', 'Penjualan akhir pekan naik', 'Stok rak depan perlu diisi'],
  mfg: ['Lini produksi berjalan stabil 🏭', 'Cek mutu batch ini dulu', 'Mesin pengisi perlu kalibrasi'],
  scm: ['Mengatur pengiriman minggu ini 🚚', 'Stok gudang aku hitung ulang', 'Pemasok baru sudah merespons'],
  rnd: ['Formula versi tiga lebih stabil 🧪', 'Percobaan malam ini mau dilanjut', 'Hasil laboratorium menjanjikan'],
  qa: ['Menguji batch sebelum rilis ✅', 'Temuan cacat kecil, aku laporkan', 'Standar mutu terpenuhi'],
};
const SOLO = {
  pagi: ['Udara pagi di sini segar banget 🌿', 'Pagi yang cerah, waktunya semangat!', 'Kopi pertama hari ini, mantap ☕'],
  siang: ['Panas juga ya siang ini', 'Waktunya cari tempat teduh', 'Perut mulai bunyi nih'],
  sore: ['Langit sore ini cantik 🌇', 'Sebentar lagi lampu-lampu menyala', 'Tinggal satu rapat lagi, kuat!'],
  malam: ['Bintangnya banyak banget malam ini ✨', 'Suasana malam di sini tenang 🌙', 'Lampu-lampu kotanya indah ya'],
  any: ['Hmm, apa lagi ya yang harus dikerjakan…', 'Jalan sebentar bikin pikiran segar', 'Aku suka tempat ini', 'Wah, ada yang baru di plaza 👀', 'Pasti ada yang menarik di sana'],
};

const nameOf = (a) => (a?.e?.name || 'kamu').split(' ')[0];
export const chat = {
  period: periodOf,
  greet: (b, h) => fresh(GREET[periodOf(h)] || GREET.siang, (s) => s.replace('{o}', nameOf(b))),
  greetBack: (a) => fresh(GREET_BACK, (s) => s.replace('{o}', nameOf(a))),
  topic(a, b, h) {
    const p = periodOf(h), same = a?.desk?.room?.div?.id && a.desk.room.div.id === b?.desk?.room?.div?.id;
    const pool = ['kerja', 'kantor', 'langit', 'lucu', 'hobi', 'teknologi', 'curhat'];
    if (p === 'siang' || p === 'sore') pool.push('makan', 'makan');
    if (p === 'malam') pool.push('langit', 'langit');
    if (same) pool.push('kerja', 'kerja', 'teknologi');
    return R(pool);
  },
  open: (t) => fresh(TOPICS[t].open, (s) => s),
  reply: (t) => fresh(TOPICS[t].reply, (s) => s),
  follow: (t) => fresh(TOPICS[t].follow, (s) => s),
  back: (t) => fresh(TOPICS[t].back, (s) => s),
  close: () => fresh(CLOSE, (s) => s),
  prof: (tag) => (PROF[tag] ? fresh(PROF[tag], (s) => s) : null),
  work: (div) => (WORK[div] ? fresh(WORK[div], (s) => s) : null),
  solo: (h) => fresh([...(SOLO[periodOf(h)] || []), ...SOLO.any], (s) => s),
};
