// Beauty science & operations knowledge: skin science, actives, formulation, CPKB manufacturing, QC, regulatory and supply chain for Ray Beauty.
const K = (title, audience, tags, content) => ({ title, audience, tags, content: content.trim() });
export default [
  K('Biologi Kulit, Skin Barrier & Tipe Kulit', { divisions: ['rnd', 'qa', 'reg', 'mkt', 'retail', 'cs'], roles: ['formula', 'chemist', 'r&d', 'beauty advisor', 'claims'] }, ['skin-biology', 'skin-barrier', 'skin-type'], `
# Biologi Kulit, Skin Barrier & Tipe Kulit

Pemahaman dasar kulit menentukan pemilihan bahan aktif, klaim yang wajar, dan rekomendasi produk. Kosmetik bekerja terutama di lapisan terluar kulit; bila sebuah klaim menyiratkan perubahan struktur atau fungsi di lapisan dalam, cek kembali batas klaim kosmetik di [[Klaim Kosmetik - Boleh & Tidak Boleh]].

## Lapisan kulit
1. **Epidermis** (tanpa pembuluh darah). Dari dalam ke luar: stratum basale (sel punca keratinosit, melanosit), spinosum, granulosum, dan **stratum corneum** (SC). Pergantian epidermis pada orang dewasa berlangsung beberapa minggu.
2. **Dermis**: kolagen (dominan tipe I dan III), elastin, glikosaminoglikan (termasuk asam hialuronat), fibroblas, pembuluh darah, kelenjar sebasea dan keringat, folikel rambut.
3. **Hipodermis/subkutis**: jaringan lemak dan bantalan.

## Skin barrier
- Model "batu bata dan semen": korneosit (bata) dikelilingi lipid lamelar (semen) yang tersusun dari **ceramide, kolesterol, dan asam lemak bebas** dengan rasio mendekati ekuimolar.
- **NMF (Natural Moisturizing Factor)**: asam amino, PCA, laktat, urea, garam; hasil degradasi filaggrin. Menjaga hidrasi SC.
- **Acid mantle**: pH permukaan kulit umumnya sedikit asam (kisaran sekitar 4,5 sampai 5,5). pH ini mendukung enzim pembentuk lipid dan mikrobiom sehat.
- Indikator fungsi barrier: **TEWL** (transepidermal water loss) naik bila barrier rusak; hidrasi SC diukur dengan corneometer.
- Perusak barrier: surfaktan keras (misalnya SLS konsentrasi tinggi), eksfoliasi berlebihan, pH produk ekstrem, paparan UV, udara kering ber-AC.

## Tipe kulit (kategori praktis)
| Tipe | Ciri | Arah formulasi |
|---|---|---|
| Normal | seimbang | pemeliharaan, antioksidan, sunscreen |
| Kering | kasar, ketat, TEWL tinggi | emolien, oklusif, ceramide, humektan |
| Berminyak | sebum tinggi, pori tampak | tekstur ringan, niacinamide, BHA |
| Kombinasi | T-zone berminyak | gel-cream, produk berbeda per area |
| Sensitif | mudah perih/kemerahan | bebas pewangi, aktif minimal, uji iritasi |

## Masalah kulit umum di pasar Indonesia
- **Hiperpigmentasi & kulit kusam**: dipicu UV, inflamasi (PIH pasca-jerawat), hormon. Aktif umum: niacinamide, turunan vitamin C, alpha arbutin, dengan sunscreen sebagai pondasi.
- **Kulit berjerawat (acne-prone)**: sebum, hiperkeratinisasi folikel, bakteri C. acnes, inflamasi. Kosmetik boleh membantu "merawat kulit berjerawat"; mengobati jerawat adalah ranah obat.
- **Dehidrasi** (kurang air, bisa terjadi juga pada kulit berminyak).
- **Penuaan**: intrinsik (usia) dan ekstrinsik (photoaging, kontributor terbesar di iklim tropis).

## Checklist untuk R&D dan Beauty Advisor
- Tentukan tipe dan masalah kulit target sebelum memilih aktif.
- Jaga pH produk leave-on wajah tetap ramah kulit kecuali ada alasan teknis (mis. eksfolian).
- Selalu padukan rekomendasi aktif pencerah/anti-aging dengan sunscreen.
- Arahkan konsumen dengan keluhan berat atau persisten ke dokter kulit.
- Lihat juga [[Ceramide, Hyaluronic Acid & Sistem Pelembap]] dan [[Produk Ray Beauty]].
`),

  K('Niacinamide & Peptida Kosmetik', { divisions: ['rnd', 'reg', 'mkt'], roles: ['formula', 'chemist', 'r&d', 'claims'] }, ['active', 'niacinamide', 'peptide'], `
# Niacinamide & Peptida Kosmetik

## Niacinamide (vitamin B3, nicotinamide)
**Mekanisme yang didukung literatur:**
- Prekursor NAD/NADP; berperan dalam metabolisme energi sel.
- Meningkatkan sintesis ceramide dan protein barrier sehingga menurunkan TEWL.
- Menghambat transfer melanosom dari melanosit ke keratinosit, mendukung klaim meratakan warna kulit.
- Membantu mengurangi tampilan produksi sebum dan pori, serta bersifat anti-inflamasi ringan.

**Catatan formulasi:**
- Larut air, relatif stabil terhadap panas dan cahaya dibanding banyak aktif lain.
- Kadar yang banyak dipakai dalam studi kosmetik berkisar beberapa persen (umum 2 sampai 5 persen); kadar lebih tinggi tidak otomatis lebih efektif dan dapat menaikkan risiko rasa tidak nyaman pada kulit sensitif.
- pH formula ideal mendekati netral sampai sedikit asam (sekitar 5 sampai 7). Pada pH sangat rendah dan suhu tinggi, niacinamide dapat terhidrolisis menjadi asam nikotinat yang memicu flushing (kemerahan sementara). Pilih grade dengan kadar asam nikotinat rendah dan cek COA.
- Kompatibel dengan sebagian besar aktif. Mitos "tidak boleh dicampur vitamin C" bersumber dari studi lama pada kondisi panas ekstrem; dalam praktik formulasi modern aman bila pH dan stabilitas diuji.
- Sinergi umum: zinc PCA (kulit berminyak), ceramide, HA, alpha arbutin, tranexamic acid.

## Peptida kosmetik
Peptida adalah rantai pendek asam amino. Klasifikasi fungsional yang lazim:
| Kelompok | Contoh INCI | Konsep kerja |
|---|---|---|
| Signal peptide | Palmitoyl Tripeptide-1, Palmitoyl Pentapeptide-4 | memberi sinyal ke fibroblas terkait matriks |
| Carrier peptide | Copper Tripeptide-1 | membawa ion tembaga |
| Neurotransmitter-inhibiting | Acetyl Hexapeptide-8 | konsep mengurangi kontraksi otot mimik (efek kosmetik superfisial) |
| Enzyme-inhibiting | peptida dari protein kedelai/beras | menghambat enzim degradasi |

**Catatan formulasi peptida:**
- Umumnya dibeli sebagai larutan supplier dengan kadar aktif sangat kecil; ikuti dosis rekomendasi supplier (biasanya dinyatakan sebagai persen larutan, bukan peptida murni).
- Tambahkan di fase dingin (di bawah sekitar 40 derajat C), hindari pH ekstrem, hindari kombinasi dengan asam kuat atau enzim protease.
- Copper peptide dapat berinteraksi dengan asam askorbat dan chelator kuat (EDTA dapat mengikat tembaga); uji kompatibilitas.
- Lipopeptida (palmitoyl) membantu penetrasi ke lapisan SC.

## Klaim dan bukti
- Data efikasi dari supplier (in vitro atau uji klinis kecil) harus disimpan di DIP, lihat [[Notifikasi BPOM, DIP & ASEAN Cosmetic Directive]].
- Hindari klaim seperti "seperti botox" atau "membentuk kolagen baru secara permanen". Pakai frasa kosmetik: "membantu menyamarkan tampilan garis halus". Rujuk [[Pedoman Klaim Kosmetik]].
- Verifikasi status bahan dan batas kadar ke peraturan BPOM terbaru dan Annex ASEAN.

## Checklist R&D
- Cek COA (assay, asam nikotinat untuk niacinamide), spesifikasi supplier, dan rekomendasi pH.
- Jalankan stabilitas sesuai [[Uji Stabilitas & Kompatibilitas Kemasan]].
- Dokumentasikan dasar dosis di formula sheet dan [[SOP R&D - Formulasi & Uji Stabilitas]].
`),

  K('Retinoid dalam Kosmetik', { divisions: ['rnd', 'reg', 'qa'], roles: ['formula', 'chemist', 'r&d', 'regulatory', 'claims'] }, ['active', 'retinoid', 'anti-aging'], `
# Retinoid dalam Kosmetik

Retinoid adalah keluarga turunan vitamin A. Di kulit, bentuk kosmetik dikonversi bertahap menjadi asam retinoat, bentuk yang berikatan dengan reseptor RAR dan memengaruhi pergantian sel serta matriks dermis.

## Jalur konversi (makin ke kanan makin poten dan makin iritatif)
Retinyl ester (mis. retinyl palmitate) -> retinol -> retinaldehida (retinal) -> asam retinoat.

- **Asam retinoat (tretinoin)** adalah bahan obat dan termasuk bahan yang dilarang dalam kosmetik; tidak boleh dipakai di produk Ray Beauty.
- **Retinol** paling banyak dipakai di kosmetik anti-aging.
- **Retinal** lebih poten dari retinol, lebih sulit distabilkan.
- **Hydroxypinacolone retinoate (HPR)**, retinyl propionate, dan alternatif nabati seperti **bakuchiol** (bukan retinoid secara kimia; dipasarkan sebagai alternatif yang lebih lembut).

## Batas regulasi
Beberapa yurisdiksi (termasuk Uni Eropa) telah memperketat batas kadar retinol dan retinyl ester dalam kosmetik karena pertimbangan paparan vitamin A total. **Verifikasi ke peraturan BPOM terbaru dan Annex ASEAN** sebelum menetapkan kadar, peringatan label, dan kategori produk.

## Tantangan stabilitas
- Sangat sensitif terhadap oksigen, cahaya (UV), panas, dan ion logam.
- Strategi: antioksidan (tocopherol, BHT bila diizinkan), chelator, proses dengan nitrogen blanket, penambahan di fase dingin, retinol terenkapsulasi dari supplier.
- Kemasan: airless pump atau tube aluminium/laminasi berpenghalang, opak. Hindari jar terbuka. Lihat [[Uji Stabilitas & Kompatibilitas Kemasan]].
- Uji assay retinol pada titik stabilitas; penurunan kadar adalah parameter rilis-stabilitas yang penting. Overage (kelebihan dosis awal) boleh dipakai bila dibenarkan data dan dicatat di DIP.

## Toleransi kulit ("retinization")
- Efek tidak diinginkan umum: kemerahan, kering, mengelupas, perih pada minggu awal.
- Panduan penggunaan untuk label/edukasi: mulai 2 sampai 3 kali seminggu malam hari, naikkan bertahap, gunakan pelembap, **wajib sunscreen di siang hari**.
- Hindari kombinasi dalam satu rutinitas malam yang sama dengan AHA/BHA konsentrasi tinggi bagi pemula.
- Ibu hamil atau menyusui: umumnya disarankan konsultasi dokter sebelum memakai produk retinoid. Tuliskan sebagai saran kehati-hatian, bukan klaim medis.

## Formulasi praktis
1. Basis: emulsi O/W atau anhydrous (serum minyak), karena retinol larut minyak.
2. Tambahkan emolien penenang (squalane, ceramide) dan bahan penenang (panthenol, allantoin).
3. pH emulsi umumnya dijaga di kisaran ramah kulit (sekitar 5 sampai 6) untuk kenyamanan dan stabilitas.
4. Tetapkan PAO yang konservatif sesuai data stabilitas in-use.

## Klaim
Boleh mengarah ke "membantu menyamarkan tampilan garis halus dan kerutan", "membantu meratakan tekstur kulit". Hindari "menghilangkan kerutan", "regenerasi sel" dengan bahasa terapi. Rujuk [[Pedoman Klaim Kosmetik]].

## Checklist sebelum launching produk retinoid
- Kadar dan bentuk retinoid sudah dicek ke regulasi terbaru.
- Assay stabilitas 3 bulan dipercepat dan real-time berjalan.
- Kemasan berpenghalang cahaya/oksigen lolos uji kompatibilitas.
- Label memuat peringatan dan cara pakai bertahap.
`),

  K('Vitamin C & Turunannya', { divisions: ['rnd', 'qa'], roles: ['formula', 'chemist', 'r&d', 'qc'] }, ['active', 'vitamin-c', 'antioxidant', 'brightening'], `
# Vitamin C & Turunannya

Vitamin C adalah antioksidan yang larut air, kofaktor enzim pembentuk kolagen, dan penghambat pembentukan melanin (berinteraksi dengan jalur tirosinase). Di kosmetik, tantangan utamanya adalah **stabilitas**.

## L-Ascorbic Acid (LAA)
- Bentuk "murni" dengan data efikasi topikal terbanyak.
- Penetrasi kulit membutuhkan bentuk tidak terion, sehingga formula umumnya dibuat pada **pH rendah (di bawah sekitar 3,5)**.
- Konsentrasi yang lazim dalam literatur sekitar 10 sampai 20 persen. Kadar tinggi meningkatkan potensi rasa perih.
- Mudah teroksidasi menjadi dehydroascorbic acid lalu terdegradasi; tanda oksidasi: warna menguning sampai coklat.
- Kombinasi klasik dalam literatur: LAA + vitamin E (tocopherol) + ferulic acid untuk meningkatkan stabilitas dan proteksi antioksidan.

## Turunan yang lebih stabil
| INCI | Kelarutan | pH kerja umum | Catatan |
|---|---|---|---|
| Sodium Ascorbyl Phosphate (SAP) | air | sekitar 6 sampai 7 | stabil, juga dipakai untuk kulit berjerawat |
| Magnesium Ascorbyl Phosphate (MAP) | air | sekitar 6 sampai 7 | lembut, stabil |
| Ascorbyl Glucoside | air | sekitar 5 sampai 7 | dikonversi enzim di kulit |
| 3-O-Ethyl Ascorbic Acid | air dan sebagian alkohol | sekitar 4 sampai 5,5 | stabil, populer untuk brightening |
| Ascorbyl Tetraisopalmitate | minyak | fase minyak | cocok untuk serum minyak/emulsi |
| Ascorbyl Palmitate | minyak | - | relatif kurang stabil, lebih sering sebagai antioksidan formula |

Konversi turunan menjadi LAA di kulit bervariasi; jangan menyamakan klaim efikasi turunan dengan data LAA tanpa bukti spesifik dari supplier.

## Strategi stabilisasi
1. Minimalkan oksigen: proses tertutup, nitrogen purging, pengisian dengan headspace kecil.
2. Chelator (mis. disodium EDTA, phytic acid) untuk mengikat ion logam pemicu oksidasi.
3. Air demineralisasi berkualitas; hindari kontak logam reaktif pada peralatan.
4. Sistem anhydrous (serum silikon/glikol atau bubuk) untuk LAA.
5. Kemasan opak, airless atau botol kaca gelap dengan dropper; pertimbangkan ukuran kecil agar habis sebelum teroksidasi.
6. Simpan bahan baku sesuai spesifikasi supplier (sejuk, kering, tertutup rapat).

## QC dan stabilitas
- Parameter: warna (bandingkan dengan standar warna), pH, assay aktif (HPLC), bau.
- Tetapkan batas perubahan warna dan kadar minimum pada akhir masa simpan.
- Jalankan stabilitas dipercepat 40 derajat C dan real-time; vitamin C sering gagal lebih awal di suhu tinggi, maka kondisi tropis (30 derajat C/75% RH) relevan untuk Indonesia. Lihat [[Uji Stabilitas & Kompatibilitas Kemasan]].

## Kompatibilitas
- LAA pada pH rendah dapat mengganggu stabilitas emulsi dan pengental tertentu (karbomer kehilangan viskositas pada pH rendah).
- Hati-hati dengan copper peptide dan oksidator.
- Untuk konsumen pemula atau kulit sensitif, rekomendasikan turunan yang lebih lembut.

## Klaim
Klaim wajar: "membantu mencerahkan dan meratakan warna kulit", "antioksidan". Hindari "memutihkan permanen" atau janji instan. Rujuk [[Pedoman Klaim Kosmetik]] dan verifikasi batas kadar bahan ke peraturan BPOM terbaru.
`),

  K('AHA, BHA & PHA - Eksfoliasi Kimia', { divisions: ['rnd', 'reg', 'retail', 'cs'], roles: ['formula', 'chemist', 'r&d', 'regulatory', 'beauty advisor'] }, ['active', 'exfoliant', 'aha', 'bha', 'pha'], `
# AHA, BHA & PHA - Eksfoliasi Kimia

Hydroxy acid melonggarkan ikatan antar korneosit sehingga sel kulit mati lebih mudah lepas. Hasilnya tekstur lebih halus dan kulit tampak lebih cerah. Efektivitas dan iritasi dipengaruhi **kadar, pH, dan bentuk asam bebas**.

## Jenis utama
| Kelompok | Contoh | Sifat | Cocok untuk |
|---|---|---|---|
| AHA | glycolic acid, lactic acid, mandelic acid | larut air, bekerja di permukaan | kulit kusam, tekstur kasar |
| BHA | salicylic acid | larut minyak, masuk ke pori | kulit berminyak, acne-prone, komedo |
| PHA | gluconolactone, lactobionic acid | molekul lebih besar, penetrasi lebih lambat, humektan | kulit sensitif |

- Glycolic acid molekul terkecil: penetrasi cepat, potensi iritasi lebih tinggi.
- Lactic acid juga komponen NMF; lebih melembapkan.
- Mandelic acid molekul lebih besar, lebih lembut.
- Salicylic acid juga anti-inflamasi ringan; dibatasi kadar dan penggunaannya dalam Annex ASEAN (termasuk ketentuan untuk produk anak). **Verifikasi ke peraturan BPOM terbaru.**

## Konsep pH dan pKa
- Fraksi asam bebas (yang aktif mengeksfoliasi) bergantung pada pH formula relatif terhadap pKa asam (glycolic dan lactic sekitar 3,8; salicylic sekitar 3).
- Makin rendah pH, makin banyak asam bebas, makin kuat efek dan iritasi.
- Strategi "partial neutralization" (menaikkan pH dengan basa seperti sodium hydroxide atau arginine) dipakai untuk menyeimbangkan efektivitas dan kenyamanan.
- Dokumentasikan kadar asam total dan pH akhir; QC wajib cek pH setiap batch karena pH adalah parameter kritis.

## Catatan formulasi
1. Pilih pengental tahan asam (mis. xanthan gum, hydroxyethylcellulose, beberapa polimer akrilat yang tahan pH rendah). Karbomer kurang cocok pada pH sangat rendah.
2. Salicylic acid sukar larut air; larutkan dengan glikol (butylene glycol, propanediol), etanol, atau gunakan bentuk garam bila sesuai tujuan.
3. Tambahkan penenang: panthenol, allantoin, madecassoside, beta-glucan.
4. Kemasan: hindari logam tak terlapis; uji kompatibilitas pompa dan pegas logam.
5. Toner eksfoliasi: transparansi dan kejernihan harus stabil (uji suhu rendah untuk kristalisasi).

## Keamanan konsumen
- AHA dapat meningkatkan sensitivitas kulit terhadap matahari. Cantumkan anjuran memakai sunscreen dan, bila dipersyaratkan, peringatan label; verifikasi ke peraturan BPOM terbaru.
- Edukasi: mulai frekuensi rendah, hindari kulit luka, jangan dikombinasikan berlebihan dengan retinoid atau scrub fisik.
- Lakukan uji keamanan (mis. HRIPT/patch test oleh lembaga uji) untuk produk leave-on beraktif asam.

## Klaim
Boleh: "membantu mengangkat sel kulit mati", "membantu menghaluskan tekstur kulit", "membantu membersihkan pori". Tidak boleh: "mengobati jerawat", "peeling medis". Rujuk [[Pedoman Klaim Kosmetik]].

## Checklist
- pH target dan rentang toleransi ditetapkan di spesifikasi produk jadi.
- Uji stabilitas pH, warna, dan kristalisasi, lihat [[Uji Stabilitas & Kompatibilitas Kemasan]].
- Peringatan dan cara pakai sudah ada di rancangan label, lihat [[Persyaratan Label Kosmetik]].
`),

  K('Ceramide, Hyaluronic Acid & Sistem Pelembap', { divisions: ['rnd', 'mkt', 'retail'], roles: ['formula', 'chemist', 'r&d', 'beauty advisor'] }, ['active', 'ceramide', 'hyaluronic-acid', 'moisturizer'], `
# Ceramide, Hyaluronic Acid & Sistem Pelembap

Pelembap yang baik menggabungkan tiga fungsi: **humektan** (menarik air), **emolien** (mengisi celah, menghaluskan), dan **oklusif** (mengurangi penguapan). Rasio ketiganya disesuaikan dengan tipe kulit, iklim lembap Indonesia, dan preferensi tekstur ringan.

## Humektan
- **Hyaluronic acid (HA) / sodium hyaluronate**: polisakarida yang mampu mengikat air dalam jumlah besar.
  - Berat molekul tinggi: membentuk film di permukaan, rasa halus, efek hidrasi permukaan.
  - Berat molekul rendah/terhidrolisis: dipasarkan untuk hidrasi lebih dalam di SC; bukti penetrasi bervariasi, gunakan data supplier.
  - Kadar penggunaan umum sangat kecil (sering di bawah 1 persen bahan aktif) karena sangat kental; ikuti rekomendasi supplier.
  - Di lingkungan sangat kering, humektan tanpa oklusif dapat terasa kurang efektif; padukan dengan emolien.
- Humektan lain: glycerin (pekerja keras, murah, bukti kuat), butylene glycol, propanediol, sodium PCA, urea, panthenol, betaine.

## Ceramide dan lipid barrier
- Ceramide adalah lipid utama di matriks lamelar stratum corneum bersama kolesterol dan asam lemak bebas.
- Bahan kosmetik: ceramide NP, AP, EOP, NS, dan pseudo-ceramide. Biasanya dibeli dalam kompleks siap pakai dengan kolesterol dan fitosfingosin.
- Literatur barrier repair menunjukkan manfaat campuran ceramide, kolesterol, dan asam lemak dalam rasio fisiologis dibanding ceramide tunggal.
- Catatan proses: ceramide punya titik leleh tinggi dan sukar larut; ikuti prosedur supplier (biasanya dilelehkan di fase minyak panas dan didispersikan dengan baik) agar tidak terjadi kristalisasi atau rasa berpasir.

## Emolien dan oklusif
| Fungsi | Contoh | Catatan sensori |
|---|---|---|
| Emolien ringan | caprylic/capric triglyceride, isononyl isononanoate, squalane, coco-caprylate | cepat menyerap |
| Emolien sedang | shea butter, jojoba oil, cetyl ethylhexanoate | lebih kaya |
| Oklusif | petrolatum, dimethicone, beeswax, lanolin | penghalang penguapan, bisa terasa berat |

Untuk iklim tropis, gel-cream dengan emolien ringan dan silikon/alternatif silikon umumnya lebih disukai.

## Pengukuran efikasi
- Corneometer (hidrasi), Tewameter (TEWL), sebelum dan sesudah pemakaian, dengan durasi dan jumlah panelis yang dirancang lembaga uji.
- Hasil uji menjadi dasar klaim "melembapkan hingga X jam"; klaim waktu wajib didukung data uji spesifik produk, simpan di DIP.

## Template kerangka formula pelembap gel-cream (persentase indikatif untuk riset awal)
1. Fase air: air demin, glycerin, butylene glycol, chelator, pengental (mis. polimer akrilat atau gum).
2. Fase minyak: emolien ringan, ceramide complex, emulsifier.
3. Fase dingin: sodium hyaluronate (pre-dispersi), niacinamide atau panthenol, pengawet, pewangi (opsional).
Sesuaikan angka melalui trial dan uji stabilitas; lihat [[Sistem Emulsi & Pemilihan Emulsifier]] dan [[SOP R&D - Formulasi & Uji Stabilitas]].

## Tips untuk Beauty Advisor
- Kulit berminyak tetap butuh pelembap; arahkan ke tekstur gel.
- Kulit kering atau barrier terganggu: pilih produk ber-ceramide dan bebas pewangi.
- Hubungkan dengan [[Biologi Kulit, Skin Barrier & Tipe Kulit]].
`),

  K('Filter UV, Formulasi Sunscreen & Konsep Uji SPF/PA', { divisions: ['rnd', 'reg', 'qa', 'mkt'], roles: ['formula', 'chemist', 'r&d', 'regulatory', 'claims'] }, ['sunscreen', 'uv-filter', 'spf', 'pa'], `
# Filter UV, Formulasi Sunscreen & Konsep Uji SPF/PA

## Dasar radiasi UV
- **UVB** (sekitar 290 sampai 320 nm): penyebab utama sunburn; ukuran perlindungannya adalah SPF.
- **UVA** (sekitar 320 sampai 400 nm): penetrasi lebih dalam, berperan pada photoaging dan pigmentasi; diukur dengan PA/PPD atau UVA-PF.
- Indonesia berada di daerah tropis dengan indeks UV tinggi sepanjang tahun.

## Jenis filter
| Jenis | Contoh (INCI) | Catatan |
|---|---|---|
| Inorganik/mineral | Zinc Oxide, Titanium Dioxide | broad spectrum (ZnO lebih baik di UVA), potensi white cast, butuh dispersi baik |
| Organik UVB | Ethylhexyl Methoxycinnamate, Ethylhexyl Salicylate, Homosalate, Octocrylene | larut minyak |
| Organik UVA | Butyl Methoxydibenzoylmethane (avobenzone), Diethylamino Hydroxybenzoyl Hexyl Benzoate | avobenzone tidak fotostabil tanpa stabilizer |
| Broad spectrum modern | Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol | fotostabil, efisien |

Semua filter UV dan kadar maksimumnya tercantum dalam Annex filter UV ASEAN. **Verifikasi ke peraturan BPOM terbaru** sebelum memilih filter dan kadar.

## Prinsip formulasi
1. Kombinasikan filter untuk cakupan UVA-UVB dan sinergi; SPF tinggi dengan beban filter efisien.
2. Stabilkan avobenzone (mis. dengan octocrylene atau triazine fotostabil); hindari kontak avobenzone dengan ion logam bebas.
3. Film former (mis. polimer akrilat) membantu keseragaman lapisan dan ketahanan air.
4. Partikel mineral: pilih grade terlapis (coated) agar mudah didispersi dan mengurangi reaktivitas; kontrol aglomerasi dengan dispersant dan homogenisasi.
5. Fokus sensori tropis: tekstur ringan, tidak lengket, tidak white cast, kompatibel dengan makeup.
6. Pastikan keseragaman batch: filter adalah bahan kritis, assay filter UV menjadi parameter QC.

## Konsep uji SPF dan PA
- **SPF in vivo**: metode baku internasional ISO 24444. Sukarelawan diberi produk dengan dosis 2 mg/cm2, lalu dipapar sinar simulasi matahari; SPF = MED kulit terlindungi dibagi MED kulit tanpa perlindungan.
- **UVA in vivo (PPD)**: ISO 24442; hasil PPD dikonversi ke grade PA ala Jepang: PA+ (PPD 2 sampai kurang dari 4), PA++ (4 sampai kurang dari 8), PA+++ (8 sampai kurang dari 16), PA++++ (16 ke atas).
- **UVA in vitro**: ISO 24443 (spektrofotometri pada pelat PMMA), termasuk critical wavelength.
- **Water resistance**: diuji dengan prosedur perendaman standar; klaim "tahan air" hanya bila lulus uji.
- Uji in vitro SPF internal di R&D berguna untuk skrining formula, tetapi **klaim label harus berdasarkan laporan uji lembaga yang kompeten** dan disimpan di DIP.

## Aturan praktis klaim dan label
- Nilai SPF di label tidak boleh melebihi hasil uji; pembulatan dan pengelompokan nilai mengikuti ketentuan regulasi, verifikasi ke peraturan BPOM terbaru.
- Hindari "sunblock total", "100% perlindungan", "tidak perlu diaplikasikan ulang".
- Cantumkan cara pakai: aplikasikan cukup sebelum terpapar matahari dan ulangi secara berkala, terutama setelah berkeringat atau berenang.
- Rujuk [[Pedoman Klaim Kosmetik]] dan [[Klaim Kosmetik - Boleh & Tidak Boleh]].

## Checklist proyek sunscreen
- Target SPF/PA, tekstur, dan klaim disepakati dengan Marketing sejak brief.
- Filter dan kadar dicek ke Annex terbaru.
- Skrining in vitro, lalu stabilitas, lalu uji in vivo final pada formula beku (frozen formula).
- Uji kompatibilitas kemasan (filter organik dapat berinteraksi dengan plastik tertentu), lihat [[Uji Stabilitas & Kompatibilitas Kemasan]].
`),

  K('Sistem Emulsi & Pemilihan Emulsifier', { divisions: ['rnd', 'mfg'], roles: ['formula', 'chemist', 'r&d', 'production'] }, ['formulation', 'emulsion', 'emulsifier'], `
# Sistem Emulsi & Pemilihan Emulsifier

Emulsi adalah dispersi dua fase yang tidak saling larut (air dan minyak) yang distabilkan emulsifier. Sebagian besar krim dan losion Ray Beauty adalah emulsi.

## Tipe emulsi
| Tipe | Ciri | Contoh produk |
|---|---|---|
| O/W (minyak dalam air) | ringan, mudah dicuci, terasa segar | losion, krim siang, gel-cream |
| W/O (air dalam minyak) | oklusif, tahan air | krim malam kaya, sunscreen tahan air |
| W/Si (air dalam silikon) | sensori halus, ringan untuk W/O | foundation, primer |
| Multiple (W/O/W) | kompleks, untuk enkapsulasi | produk khusus |
| Emulsi tanpa emulsifier klasik | distabilkan polimer (Pickering atau polymeric emulsifier) | gel-cream, sunscreen ringan |

## Konsep HLB
- HLB (hydrophilic-lipophilic balance) skala kasar sifat emulsifier nonionik. HLB rendah (sekitar 3 sampai 6) cenderung untuk W/O, HLB tinggi (sekitar 8 sampai 18) untuk O/W.
- Setiap minyak punya "required HLB"; campuran minyak dihitung rata-rata berbobot. Campurkan dua emulsifier (HLB rendah + tinggi) untuk mencapai required HLB.
- Rumus campuran: HLB campuran = (fraksi A x HLB A) + (fraksi B x HLB B).
- HLB adalah titik awal, bukan jaminan; validasi dengan trial dan stabilitas.

## Contoh sistem emulsifier yang lazim
- Cetearyl Alcohol + Ceteareth-20 (klasik, ekonomis).
- Glyceryl Stearate + PEG-100 Stearate.
- Cetearyl Olivate + Sorbitan Olivate (berbasis olive, tren "natural").
- Polyglyceryl esters (alternatif bebas PEG).
- Potassium Cetyl Phosphate (baik untuk sunscreen O/W).
- Polimer pengemulsi (mis. Acrylates/C10-30 Alkyl Acrylate Crosspolymer) untuk gel-cream rendah emulsifier.
- W/O: PEG-30 Dipolyhydroxystearate, Polyglyceryl-4 Isostearate; W/Si: PEG-10 Dimethicone, Cetyl PEG/PPG-10/1 Dimethicone.
Status halal dan asal bahan emulsifier harus dikonfirmasi ke supplier, lihat [[Sertifikasi Halal Kosmetik via BPJPH]].

## Proses pembuatan emulsi O/W panas (umum)
1. Fase A (air + humektan + chelator + pengental) dipanaskan sekitar 70 sampai 75 derajat C.
2. Fase B (minyak + emulsifier + fatty alcohol) dipanaskan pada suhu sama sampai semua leleh.
3. Masukkan B ke A (atau sebaliknya sesuai desain) sambil homogenisasi; catat kecepatan dan durasi.
4. Pendinginan bertahap dengan pengadukan jangkar/sapuan.
5. Fase C (aktif peka panas, pengawet tertentu, pewangi) ditambahkan di bawah sekitar 40 derajat C.
6. Penyesuaian pH, lalu cek viskositas dan penampilan.
Alternatif: proses dingin dengan emulsifier atau polimer cold-process.

## Mekanisme ketidakstabilan dan pencegahan
- **Creaming/sedimentasi**: sesuai hukum Stokes, laju naik/turun droplet sebanding dengan kuadrat ukuran droplet dan selisih densitas, berbanding terbalik dengan viskositas fase kontinu. Solusi: perkecil droplet (homogenisasi), naikkan viskositas fase kontinu.
- **Flokulasi dan koalesensi**: sistem emulsifier kurang kuat; tambahkan ko-emulsifier atau stabilizer polimer.
- **Ostwald ripening**: pilih minyak dengan kelarutan rendah di fase air.
- **Phase inversion**: rasio fase atau suhu tidak terkendali.
- Kristalisasi fatty alcohol atau butter: rasa berpasir; kontrol laju pendinginan.

## Checklist saat formula dipindah ke produksi
- Catat parameter kritis (suhu, kecepatan homogenizer, waktu) untuk [[Scale-up dari Lab ke Produksi]].
- Uji mikroskop ukuran droplet dan sentrifugasi sebagai skrining awal.
- Lihat [[pH, Viskositas & Kompatibilitas Bahan]] dan [[SOP R&D - Formulasi & Uji Stabilitas]].
`),

  K('Sistem Pengawet Kosmetik', { divisions: ['rnd', 'qa', 'reg'], roles: ['formula', 'chemist', 'r&d', 'micro', 'qc', 'regulatory'] }, ['formulation', 'preservative', 'microbiology'], `
# Sistem Pengawet Kosmetik

Produk yang mengandung air adalah media pertumbuhan mikroba. Pengawet melindungi produk selama masa simpan **dan selama dipakai konsumen** (kontaminasi jari, air kamar mandi). Sistem pengawet harus efektif, aman, kompatibel, dan diizinkan regulasi.

## Pengawet dan booster yang lazim
| Bahan | pH efektif | Catatan |
|---|---|---|
| Phenoxyethanol | luas | sering dikombinasikan dengan booster |
| Ethylhexylglycerin, caprylyl glycol, 1,2-hexanediol | luas | booster/multifungsi, memperkuat aktivitas |
| Paraben (methyl-, propyl-) | luas | efektif dan ekonomis; persepsi pasar perlu dipertimbangkan |
| Sodium benzoate, potassium sorbate | asam (umumnya di bawah sekitar 5,5) | bekerja dalam bentuk asam bebas; lemah di pH netral |
| Benzyl alcohol, dehydroacetic acid | asam sampai netral | sering dalam kombinasi "natural-friendly" |
| Chlorphenesin | luas | antijamur |

Semua pengawet yang diizinkan beserta kadar maksimum dan batasannya tercantum dalam Annex pengawet ASEAN. **Verifikasi ke peraturan BPOM terbaru** sebelum menetapkan kadar.

## Hurdle technology (pendekatan berlapis)
1. Pilih pengawet dengan spektrum luas (bakteri Gram positif, Gram negatif, kapang, khamir) atau kombinasi yang saling melengkapi.
2. Chelator (disodium EDTA, sodium phytate) melemahkan dinding sel bakteri Gram negatif dan memperkuat pengawet.
3. Turunkan water activity dengan glikol dan humektan.
4. pH yang sesuai.
5. Kemasan yang membatasi kontaminasi (pump, airless, tube) dibanding jar.
6. Higiene produksi sesuai CPKB, terutama kualitas air purified.

## Faktor yang menurunkan efektivitas
- Partisi ke fase minyak (pengawet larut minyak "hilang" dari fase air tempat mikroba hidup).
- Pengikatan oleh surfaktan nonionik (polysorbate), protein, atau partikel (mis. pigmen, filter mineral).
- Adsorpsi oleh kemasan plastik tertentu.
- pH bergeser selama masa simpan.
- Bahan alam (ekstrak, gum) yang membawa beban mikroba tinggi.

## Pembuktian efektivitas
- **Challenge test** (uji efektivitas pengawet) wajib untuk formula baru atau perubahan sistem pengawet; metode acuan umum ISO 11930. Lihat [[Mikrobiologi Kosmetik & Challenge Test]].
- Produk "low-risk" (mis. pH ekstrem, kadar alkohol tinggi, anhydrous) dapat dijustifikasi dengan penilaian risiko mikrobiologis, mengacu konsep ISO 29621; dokumentasikan di DIP.

## Klaim "bebas pengawet" dan "bebas paraben"
- Klaim "bebas X" yang menjelekkan bahan yang diizinkan regulasi berpotensi tidak sesuai pedoman klaim. Rujuk [[Pedoman Klaim Kosmetik]].
- Produk berlabel "preservative-free" tetap harus terbukti aman secara mikrobiologis.

## Checklist R&D
- Spektrum, pH, dan kelarutan pengawet sesuai formula.
- Kadar di bawah batas Annex terbaru; status halal pengawet terverifikasi.
- Challenge test lulus pada formula final dan kemasan final.
- Hasil dicatat di [[SOP R&D - Formulasi & Uji Stabilitas]] dan DIP.
`),

  K('pH, Viskositas & Kompatibilitas Bahan', { divisions: ['rnd', 'qa', 'mfg'], roles: ['formula', 'chemist', 'r&d', 'qc', 'lab'] }, ['formulation', 'ph', 'viscosity', 'compatibility'], `
# pH, Viskositas & Kompatibilitas Bahan

## pH
**Mengapa penting:** memengaruhi kenyamanan kulit, aktivitas bahan aktif (AHA, vitamin C), efektivitas pengawet (asam organik), stabilitas pengental, dan warna.

Panduan rentang pH (indikatif, sesuaikan dengan desain produk):
| Produk | Kisaran umum |
|---|---|
| Krim/losion wajah | sekitar 5 sampai 6,5 |
| Toner eksfoliasi AHA/BHA | lebih rendah, sesuai desain dan keamanan |
| Serum LAA | di bawah sekitar 3,5 |
| Pembersih sabun (saponifikasi) | basa, umumnya 9 ke atas |
| Pembersih surfaktan sintetis (syndet) | sekitar 5 sampai 7 |

**Praktik pengukuran:**
- Kalibrasi pH meter minimal 2 titik (pH 4 dan 7, tambah pH 10 bila perlu) setiap hari kerja; catat slope elektroda.
- Ukur pada suhu terkontrol (sekitar 25 derajat C); emulsi kental dapat diukur langsung atau sebagai dispersi 10 persen dalam air demin, metode harus konsisten antara R&D dan QC.
- Penyesuai pH: citric acid, lactic acid (turunkan); sodium hydroxide, triethanolamine, arginine, aminomethyl propanol (naikkan). Tambahkan bertahap dalam larutan encer.

## Viskositas dan reologi
- Diukur dengan viskometer rotasional (mis. Brookfield). Catat **spindle, kecepatan (rpm), suhu, dan waktu baca**; tanpa ini, angka tidak dapat dibandingkan.
- Sebagian besar krim bersifat **shear-thinning** (viskositas turun saat dioles) dan sering tiksotropik; produk mungkin perlu waktu istirahat (mis. 24 jam) sebelum diukur.
- Pengental umum: karbomer (dinetralkan, sensitif elektrolit dan pH rendah), xanthan gum, hydroxyethylcellulose, polimer akrilat pra-netral, sclerotium gum, magnesium aluminum silicate, fatty alcohol (struktur emulsi).
- Elektrolit (garam, ekstrak, niacinamide pada kadar tinggi, aktif bermuatan) dapat menurunkan viskositas karbomer.

## Kompatibilitas bahan: matriks risiko
| Kombinasi | Risiko | Mitigasi |
|---|---|---|
| Karbomer + pH rendah atau elektrolit tinggi | viskositas jatuh | ganti pengental tahan asam/elektrolit |
| Surfaktan anionik + kationik | presipitasi | pilih sistem bermuatan sesuai |
| LAA + ion logam | oksidasi, perubahan warna | chelator, air berkualitas |
| Pengawet asam organik + pH netral | pengawet tidak efektif | sesuaikan pH atau pengawet |
| Avobenzone + ion logam | perubahan warna, degradasi | chelator, grade mineral terlapis |
| Ekstrak alam + pewangi | perubahan warna/bau | uji stabilitas cahaya dan suhu |
| Copper peptide + vitamin C atau EDTA | inaktivasi | pisahkan atau ganti |

## Langkah uji kompatibilitas awal di lab
1. Buat larutan atau dispersi bahan secara berpasangan pada kadar formula.
2. Simpan pada suhu ruang dan 40 derajat C selama beberapa hari sampai beberapa minggu.
3. Amati kekeruhan, endapan, warna, bau, pH.
4. Lanjutkan ke formula lengkap dan program [[Uji Stabilitas & Kompatibilitas Kemasan]].

## Spesifikasi produk jadi
Tetapkan rentang pH dan viskositas berdasarkan data batch pilot dan stabilitas, bukan angka tunggal. Rentang ini dipakai QC saat release, lihat [[Pengujian QC Fisika-Kimia]] dan [[SOP QC - Pengujian & Release Batch]].
`),

  K('Uji Stabilitas & Kompatibilitas Kemasan', { divisions: ['rnd', 'qa', 'scm'], roles: ['formula', 'chemist', 'r&d', 'qc', 'packaging', 'buyer'] }, ['stability', 'packaging', 'shelf-life'], `
# Uji Stabilitas & Kompatibilitas Kemasan

Tujuan: membuktikan bahwa produk dalam **kemasan final** tetap memenuhi spesifikasi kualitas, keamanan, dan fungsi selama masa simpan dan masa pakai (PAO). Detail prosedur internal ada di [[SOP R&D - Formulasi & Uji Stabilitas]].

## Rancangan protokol (praktik industri umum)
| Kondisi | Tujuan | Titik pengamatan tipikal |
|---|---|---|
| 40 derajat C +/- 2, 75% RH +/- 5 (dipercepat) | prediksi cepat | 0, 1, 2, 3 bulan (sampai 6 bulan bila perlu) |
| 30 derajat C, 65% atau 75% RH (real-time tropis, relevan Indonesia) | konfirmasi masa simpan | 0, 3, 6, 12, 18, 24, 36 bulan |
| Suhu ruang terkontrol 25 derajat C | pembanding | sesuai jadwal real-time |
| 4 sampai 5 derajat C | kristalisasi, viskositas | bulanan |
| Freeze-thaw / siklus suhu (mis. -10 derajat C dan 25 sampai 40 derajat C, beberapa siklus 24 jam) | ketahanan emulsi | setelah tiap siklus |
| Paparan cahaya (sinar matahari simulasi/jendela) | fotostabilitas warna, aktif | mingguan |
| Sentrifugasi (mis. 3000 rpm 30 menit) | skrining cepat pemisahan | sekali |

Protokol dipercepat memberi indikasi, bukan bukti mutlak masa simpan; klaim masa simpan dikonfirmasi data real-time yang berjalan.

## Parameter pengamatan
- Organoleptik: penampilan, warna, bau, tekstur, pemisahan.
- Fisika-kimia: pH, viskositas, berat jenis, mikroskop (ukuran droplet), kadar aktif kritis (mis. vitamin C, retinol, filter UV).
- Mikrobiologi: pada awal dan akhir, atau sesuai risiko.
- Kemasan: kehilangan berat, deformasi, perubahan warna, kebocoran, fungsi pompa.

Kriteria penerimaan ditulis **sebelum** uji dimulai (mis. pH tetap dalam rentang spesifikasi, tidak ada pemisahan, kadar aktif di atas batas minimum).

## Uji kompatibilitas kemasan
1. **Interaksi produk-kemasan**: migrasi komponen plastik ke produk, absorpsi bahan (pewangi, pengawet, filter UV) ke dinding kemasan, korosi logam, delaminasi tube.
2. **Kehilangan berat**: timbang sampel terisi pada setiap titik; kehilangan signifikan menandakan permeabilitas atau seal buruk.
3. **Fungsi**: uji dosis pompa (gram per tekan), kekuatan torsi tutup, uji kebocoran (posisi terbalik, vakum), drop test.
4. **Dekorasi**: daya rekat sablon, hot stamping, label terhadap produk dan alkohol (rub test).
5. **Kompatibilitas pemasok**: setiap perubahan resin, supplier, atau desain kemasan memerlukan evaluasi ulang.

## Bahan kemasan dan catatan
- PET: barrier oksigen sedang, jernih; PP: tahan kimia, umum untuk jar/tutup; HDPE/LDPE: tube dan botol fleksibel; kaca: barrier terbaik, berat; aluminium/laminasi: untuk aktif sensitif oksigen.
- Pegas logam pompa yang kontak produk asam dapat korosi; minta pompa dengan jalur produk bebas logam bila perlu.
- Lihat juga [[Kemasan Berkelanjutan]] bila memakai PCR atau mono-material.

## Penetapan masa simpan dan PAO
- Masa simpan ditetapkan dari data stabilitas dan dicantumkan sebagai tanggal kedaluwarsa atau PAO sesuai ketentuan label; verifikasi ke peraturan BPOM terbaru.
- PAO mempertimbangkan uji in-use (pemakaian simulasi) dan sistem pengawet.

## Dokumentasi
Laporan stabilitas final ditandatangani R&D dan QA, menjadi bagian DIP. Lihat [[Notifikasi BPOM, DIP & ASEAN Cosmetic Directive]].
`),

  K('Evaluasi Sensori Produk Skincare', { divisions: ['rnd', 'mkt', 'data'], roles: ['formula', 'r&d', 'sensory', 'consumer insight'] }, ['sensory', 'consumer-test', 'formulation'], `
# Evaluasi Sensori Produk Skincare

Konsumen memilih ulang produk berdasarkan pengalaman pakai. Evaluasi sensori membuat pengalaman itu terukur dan dapat dibandingkan antar prototipe.

## Jenis uji
| Jenis | Panel | Pertanyaan yang dijawab |
|---|---|---|
| Deskriptif | panel terlatih (umumnya 8 sampai 15 orang) | "Seperti apa profil teksturnya?" |
| Diskriminatif (triangle, duo-trio, paired comparison) | panel semi-terlatih | "Apakah perubahan bahan baku terasa berbeda?" |
| Hedonik/afektif (kesukaan) | konsumen target (umumnya puluhan sampai ratusan) | "Seberapa suka konsumen?" |
| In-home use test (HUT) | konsumen target, beberapa minggu | penerimaan nyata dan persepsi efek |

## Atribut deskriptif skincare (contoh lexicon)
- **Sebelum pakai**: penampilan, kilap, warna, bau, konsistensi saat diambil (firmness), peaks.
- **Saat dioles**: spreadability, slip, daya serap, waktu kering, whitening (white cast), rasa dingin.
- **Setelah pakai (afterfeel, mis. 1 dan 5 menit)**: lengket (tackiness), berminyak (greasiness), residu, kilap kulit, rasa lembap, halus (silky/powdery).
Setiap atribut didefinisikan, diberi teknik evaluasi dan acuan referensi (anchor) agar panelis konsisten. Skala umum: garis 0 sampai 10 atau 0 sampai 15.

## Prosedur standar
1. Tentukan tujuan dan hipotesis (mis. prototipe B kurang lengket dari benchmark).
2. Kodekan sampel dengan 3 digit acak; urutan penyajian diacak/diseimbangkan.
3. Kontrol kondisi: suhu dan kelembapan ruangan, area aplikasi (lengan bawah bagian dalam), dosis terukur (mis. dengan pipet atau timbangan), pencucian di antara sampel.
4. Panelis bebas dari luka/iritasi, telah memberi persetujuan, dan tidak memakai produk lain di area uji.
5. Analisis statistik: ANOVA untuk data deskriptif, uji binomial untuk triangle test, top-2-box dan penalty analysis (JAR scale) untuk konsumen.
6. Laporan: grafik spider/radar profil, rekomendasi perbaikan formula.

## Kaitan sensori dengan bahan
- Lengket: humektan berlebih, polimer tertentu; atasi dengan silikon/alternatif, bedak (silica, starch), emolien ringan.
- Berminyak: emolien berat atau kadar minyak tinggi.
- Pilling (menggumpal saat dilapis): ketidakcocokan polimer antar produk; uji layering dengan sunscreen dan makeup.
- White cast pada sunscreen mineral: ukuran partikel dan dispersi.

## Keamanan dan etika
- Uji sensori dilakukan pada formula yang telah memenuhi penilaian keamanan dan mikrobiologi.
- Data pribadi panelis dijaga kerahasiaannya.

## Pemakaian hasil
- Klaim konsumen (mis. "90% merasa kulit lebih lembap") hanya dari uji dengan desain, jumlah responden, dan pertanyaan yang jelas; simpan laporannya di DIP dan rujuk [[Pedoman Klaim Kosmetik]].
- Profil sensori benchmark menjadi target saat [[Scale-up dari Lab ke Produksi]] karena tekstur dapat berubah di skala besar.
`),

  K('Scale-up dari Lab ke Produksi', { divisions: ['rnd', 'mfg', 'qa', 'ops'], roles: ['formula', 'r&d', 'production', 'process', 'qa', 'ppic'] }, ['scale-up', 'tech-transfer', 'manufacturing'], `
# Scale-up dari Lab ke Produksi

Formula yang stabil di beaker 1 kg belum tentu sama di tangki 1.000 kg. Perbedaan geometri, energi pencampuran, laju pemanasan/pendinginan, dan waktu proses mengubah ukuran droplet, viskositas, dan sensori.

## Tahapan
1. **Lab batch** (sekitar 0,5 sampai 5 kg): formula final, stabilitas awal, parameter proses dicatat.
2. **Pilot batch** (umumnya beberapa persen sampai sekitar sepersepuluh skala produksi) di mixer pilot yang geometrinya mirip.
3. **Trial produksi/batch pertama** pada mesin produksi, disupervisi R&D, QA, dan Produksi.
4. **Validasi proses**: umumnya tiga batch berturut-turut yang memenuhi spesifikasi sebelum proses dianggap tervalidasi.

## Dokumen transfer teknologi (tech transfer package)
- Formula dengan kode bahan baku, persentase, dan grade/supplier yang disetujui.
- Prosedur pembuatan rinci: urutan penambahan, suhu tiap fase, kecepatan pengaduk dan homogenizer, durasi, vakum, laju pendinginan.
- **Critical Process Parameters (CPP)** dan **Critical Quality Attributes (CQA)** (mis. pH, viskositas, penampilan, kadar aktif).
- Spesifikasi produk antara (bulk) dan produk jadi beserta metode uji.
- Data stabilitas, challenge test, dan informasi kemasan.
- Penilaian risiko (mis. FMEA sederhana) atas langkah kritis.

## Parameter yang paling sering berubah saat scale-up
| Aspek | Masalah | Pendekatan |
|---|---|---|
| Homogenisasi | shear per volume berbeda | atur waktu/kecepatan untuk mencapai ukuran droplet target (cek mikroskop) |
| Pemanasan/pendinginan | lebih lambat di tangki besar | tetapkan profil suhu, bukan hanya waktu; jaket pendingin |
| Penambahan fase | laju penambahan memengaruhi emulsi | tentukan laju (kg/menit) dan titik masuk |
| Udara terperangkap | busa, berat jenis rendah | proses vakum, deaerasi |
| Penguapan air | viskositas naik | tutup tangki, kompensasi air terdokumentasi |
| Dispersi bubuk/polimer | gumpalan (fish eyes) | pre-dispersi dalam glikol, eductor, penambahan perlahan |

Prinsip kesetaraan yang dipakai: kecepatan ujung pengaduk (tip speed), energi per volume, atau waktu sirkulasi; pilih sesuai mekanisme kritis produk.

## Peran tiap fungsi
- **R&D**: pemilik formula, hadir di batch pertama, menyetujui hasil.
- **Produksi**: menyusun batch record induk dari prosedur, memastikan kapasitas dan kelayakan alat.
- **QA/QC**: menyetujui protokol validasi, menguji sampel in-process dan akhir, menilai deviasi.
- **PPIC**: menjadwalkan trial, memastikan ketersediaan bahan, lihat [[PPIC, MRP, Perencanaan Kapasitas & OEE]].

## Checklist go/no-go batch pertama
- Bahan baku dari supplier yang sama dengan formula lab (atau sudah ekuivalensi diuji).
- Peralatan bersih dan line clearance dilakukan, lihat [[Catatan Batch, Line Clearance & Validasi Pembersihan]].
- Sampel in-process diambil pada titik yang ditentukan.
- Hasil dibandingkan dengan lab batch: pH, viskositas, mikroskop, sensori (lihat [[Evaluasi Sensori Produk Skincare]]).
- Batch produksi awal dimasukkan ke program stabilitas.
- Penyimpangan dicatat sebagai deviasi sesuai [[Deviasi, CAPA & Analisis Akar Masalah]].
Acuan prosedur: [[SOP Produksi - CPKB]].
`),

  K('Prinsip CPKB - Personel, Bangunan & Dokumentasi', { divisions: ['mfg', 'qa', 'rnd', 'scm', 'hr'], roles: ['production', 'qa', 'qc', 'warehouse', 'gmp', 'cpkb'] }, ['cpkb', 'gmp', 'quality-system'], `
# Prinsip CPKB - Personel, Bangunan & Dokumentasi

CPKB (Cara Pembuatan Kosmetik yang Baik) adalah pedoman BPOM yang sejalan dengan pedoman GMP ASEAN dan secara konsep serupa dengan ISO 22716. Tujuannya menjamin produk dibuat secara konsisten sesuai mutu yang ditetapkan. Prosedur operasional Ray Beauty ada di [[SOP Produksi - CPKB]]. Ketentuan rinci dan pemeriksaan sertifikasi dapat berubah; **verifikasi ke peraturan BPOM terbaru.**

## Aspek utama CPKB
1. Sistem manajemen mutu
2. Personalia
3. Bangunan dan fasilitas
4. Peralatan
5. Sanitasi dan higiene
6. Produksi
7. Pengawasan mutu
8. Dokumentasi
9. Audit internal
10. Penyimpanan
11. Kontrak produksi dan pengujian
12. Penanganan keluhan dan penarikan produk

## Personel
- Struktur organisasi dengan pemisahan jelas antara kepala **Produksi** dan kepala **Pengawasan Mutu (QC/QA)**; keduanya tidak boleh dirangkap.
- Uraian tugas tertulis, kualifikasi sesuai peran.
- Pelatihan CPKB awal dan berkala, terdokumentasi (materi, peserta, evaluasi).
- Higiene personel: pemeriksaan kesehatan, pakaian kerja sesuai area, larangan makan/minum/merokok di area produksi, cuci tangan, tidak memakai perhiasan, luka terbuka dilaporkan.

## Bangunan dan fasilitas
- Alur material dan personel satu arah untuk mencegah campur baur dan kontaminasi silang.
- Zonasi: gudang, area penimbangan, pengolahan (mixing), pengisian primer, pengemasan sekunder, laboratorium, toilet terpisah dan tidak membuka langsung ke area produksi.
- Permukaan dinding, lantai, langit-langit halus, mudah dibersihkan; sudut melengkung bila memungkinkan.
- Sistem tata udara sesuai kebutuhan area (filtrasi, perbedaan tekanan bila diperlukan), pengendalian hama, pencahayaan memadai.
- **Sistem air** (purified water) dengan pemantauan mikrobiologi dan konduktivitas rutin; air adalah bahan baku terbesar kosmetik.

## Peralatan
- Didesain mudah dibersihkan, bahan kontak produk inert (umumnya stainless steel 316L).
- Kualifikasi (IQ/OQ/PQ) untuk peralatan kritis; kalibrasi timbangan, termometer, pH meter terjadwal dengan label status.
- Status alat jelas: "bersih", "kotor", "sedang dipakai", "rusak".

## Dokumentasi: "jika tidak tertulis, dianggap tidak dilakukan"
Hierarki dokumen:
1. Manual mutu dan kebijakan
2. SOP/prosedur tetap
3. Instruksi kerja, spesifikasi, formula induk, prosedur pengolahan dan pengemasan induk
4. Catatan/rekaman (catatan batch, log kebersihan, kalibrasi, pelatihan)

Prinsip **Good Documentation Practice**:
- Tulis dengan tinta permanen, saat kegiatan dilakukan, bukan sesudahnya.
- Koreksi dengan satu coretan, tulis nilai benar, paraf, tanggal, alasan; tidak boleh tip-ex.
- Setiap dokumen punya nomor, versi, tanggal berlaku, pengesahan; versi lama ditarik.
- Data elektronik memiliki kontrol akses, jejak audit, dan backup (prinsip ALCOA: Attributable, Legible, Contemporaneous, Original, Accurate).

## Audit internal (self-inspection)
- Jadwal tahunan mencakup seluruh aspek; temuan dicatat, ditindaklanjuti melalui [[Deviasi, CAPA & Analisis Akar Masalah]].

Lihat juga [[Catatan Batch, Line Clearance & Validasi Pembersihan]] dan [[K3 di Pabrik Kosmetik]].
`),

  K('Catatan Batch, Line Clearance & Validasi Pembersihan', { divisions: ['mfg', 'qa'], roles: ['production', 'qa', 'qc', 'supervisor', 'operator'] }, ['cpkb', 'batch-record', 'line-clearance', 'cleaning-validation'], `
# Catatan Batch, Line Clearance & Validasi Pembersihan

## Catatan batch (batch record)
Catatan batch membuktikan bahwa setiap batch dibuat sesuai prosedur induk. Terdiri dari **Catatan Pengolahan Batch** (mixing) dan **Catatan Pengemasan Batch** (filling dan packing).

Isi minimum:
1. Nama produk, kode, nomor batch, ukuran batch, tanggal mulai dan selesai.
2. Daftar bahan: kode, nomor lot, jumlah teoretis dan aktual ditimbang, paraf penimbang dan pemeriksa (verifikasi ganda).
3. Peralatan yang dipakai beserta status bersih dan kalibrasi.
4. Langkah proses dengan parameter aktual (suhu, waktu, kecepatan, vakum), paraf pelaksana dan pemeriksa.
5. Hasil pengujian in-process (pH, viskositas, penampilan, berat isi).
6. Rekonsiliasi: hasil teoretis vs aktual, kemasan diterima vs dipakai vs rusak vs dikembalikan.
7. Catatan deviasi dan nomor laporannya.
8. Contoh label/coding batch dan kedaluwarsa yang dipakai.
9. Tanda tangan supervisor produksi dan review QA sebelum release.

**Rumus rekonsiliasi hasil:** Yield (%) = (jumlah aktual / jumlah teoretis) x 100. Tetapkan batas yield (mis. rentang yang dibenarkan data historis); di luar batas wajib investigasi.

## Line clearance
Tujuan: mencegah campur baur produk, label, dan kemasan dari batch atau produk sebelumnya.

Checklist sebelum memulai batch atau produk baru:
- Tidak ada sisa produk, bahan, kemasan, label, atau dokumen dari batch sebelumnya di area dan mesin.
- Peralatan berlabel "bersih" dan masih dalam masa berlaku kebersihan (clean hold time).
- Coding printer diset ke nomor batch dan tanggal yang benar; cetak contoh dan verifikasi.
- Bahan dan kemasan yang datang sesuai dengan batch record (kode, lot, jumlah).
- Kondisi area (kebersihan, suhu, kelembapan bila dipersyaratkan) memenuhi syarat.
- Dilakukan oleh operator, diverifikasi supervisor/QA (IPC), ditandatangani di batch record.
Lakukan juga **line clearance di akhir** batch (sisa bahan dikembalikan atau dimusnahkan dengan catatan).

## Pembersihan dan sanitasi
Langkah tipikal peralatan mixing:
1. Pengosongan sisa produk.
2. Pembilasan awal dengan air (panas bila produk berminyak).
3. Pencucian dengan deterjen yang ditetapkan (konsentrasi, suhu, waktu kontak).
4. Pembilasan dengan purified water.
5. Sanitasi (mis. etanol 70 persen, air panas, atau sanitizer tervalidasi).
6. Pengeringan dan pelabelan status.

Faktor TACT: **Time, Action (mekanis), Concentration, Temperature**.

## Konsep validasi pembersihan
- Membuktikan bahwa prosedur pembersihan secara konsisten menghilangkan residu produk, deterjen, dan mikroba sampai batas yang dapat diterima.
- Pilih **worst-case product** (paling sulit dibersihkan: kental, berminyak, berwarna, pigmen, aktif kuat).
- Metode sampling: swab permukaan (titik paling sulit dijangkau) dan rinse sample.
- Parameter: inspeksi visual bersih, residu kimia (mis. TOC, konduktivitas, atau uji spesifik), mikrobiologi swab.
- Batas penerimaan ditetapkan berdasarkan penilaian risiko dan dibenarkan secara ilmiah; umumnya dibuktikan pada beberapa siklus berturut-turut.
- Tetapkan **dirty hold time** (maksimal waktu alat kotor sebelum dicuci) dan **clean hold time**.
- Revalidasi bila ada perubahan produk worst-case, deterjen, atau prosedur.

Acuan: [[SOP Produksi - CPKB]] dan [[Prinsip CPKB - Personel, Bangunan & Dokumentasi]].
`),

  K('PPIC, MRP, Perencanaan Kapasitas & OEE', { divisions: ['ops', 'mfg', 'scm', 'data'], roles: ['ppic', 'production', 'planner', 'inventory', 'buyer'] }, ['ppic', 'mrp', 'capacity', 'oee'], `
# PPIC, MRP, Perencanaan Kapasitas & OEE

PPIC (Production Planning and Inventory Control) menghubungkan permintaan (forecast dan order) dengan kapasitas pabrik dan ketersediaan material.

## Hierarki perencanaan
1. **S&OP bulanan**: menyelaraskan forecast Sales/Marketing, kapasitas, stok, dan finansial untuk 3 sampai 18 bulan.
2. **MPS (Master Production Schedule)**: jumlah produk jadi per SKU per minggu.
3. **MRP**: menurunkan MPS menjadi kebutuhan bahan baku dan kemasan.
4. **Jadwal produksi harian** per mesin/lini, termasuk urutan produk.

## Logika MRP
- **Gross requirement** = MPS x jumlah per unit dari BOM (bill of materials), termasuk faktor susut (scrap/yield).
- **Net requirement** = gross requirement - stok tersedia (released) - open PO + safety stock.
- **Planned order release** = net requirement digeser mundur sebesar lead time supplier, dibulatkan ke MOQ atau kelipatan kemasan.
- Kemasan cetak (box, label) sering punya lead time terpanjang dan MOQ besar; rencanakan lebih awal dan pantau perubahan artwork.
- Bahan karantina (belum release QC) tidak dihitung sebagai stok tersedia.

Contoh: MPS 10.000 tube 50 g; bulk per tube 50 g + susut 3 persen. Kebutuhan bulk = 10.000 x 50 g x 1,03 = 515 kg. Bila bahan A 5 persen formula, kebutuhan A = 25,75 kg dikurangi stok tersedia.

## Perencanaan kapasitas
- **Kapasitas tersedia** = jam kerja tersedia x jumlah lini x efisiensi aktual (OEE historis).
- **Beban** = jumlah unit / laju standar + waktu changeover + waktu cleaning.
- Utilisasi = beban / kapasitas tersedia. Utilisasi terencana yang terlalu tinggi menyisakan sedikit ruang untuk gangguan.
- **Bottleneck** sering di mixing (waktu batch + pendinginan + release bulk) atau filling. Lindungi bottleneck: jadwalkan tanpa jeda, minimalkan changeover.
- Urutan produk (campaign/sequencing): terang ke gelap, tanpa pewangi ke berpewangi, untuk mengurangi waktu pembersihan.
- Lead time QC release (termasuk mikrobiologi beberapa hari) harus masuk perhitungan lead time produk jadi.

## OEE (Overall Equipment Effectiveness)
**OEE = Availability x Performance x Quality**
- Availability = waktu operasi aktual / waktu produksi terencana.
- Performance = (waktu siklus ideal x jumlah unit diproduksi) / waktu operasi aktual.
- Quality = unit baik / total unit diproduksi.

Contoh: shift 480 menit, istirahat terencana 30 menit, maka waktu terencana 450 menit. Downtime 45 menit, operasi 405 menit, sehingga Availability = 90 persen. Laju ideal 60 unit/menit, produksi 21.870 unit; Performance = 21.870 / (405 x 60) = 90 persen. Unit baik 21.432; Quality = 98 persen. OEE = 0,90 x 0,90 x 0,98 = sekitar 79 persen.

Angka 85 persen sering disebut sebagai acuan kelas dunia untuk lini diskrit; gunakan sebagai referensi, bukan target mutlak.

**Six Big Losses**: kerusakan mesin, setup/changeover, idle dan stop kecil, kecepatan turun, cacat produksi, cacat saat start-up. Perbaikan: SMED untuk changeover, autonomous maintenance, preventive maintenance, analisis Pareto penyebab downtime.

## KPI PPIC
- Schedule adherence, OTIF ke distribusi, OEE per lini, hari stok (days of inventory), tingkat stockout, akurasi MRP.
Lihat juga [[Kebijakan Inventori - FEFO, Safety Stock & EOQ]] dan [[Peramalan Permintaan Produk Kosmetik]].
`),

  K('Pengujian QC Fisika-Kimia', { divisions: ['qa', 'rnd'], roles: ['qc', 'lab', 'analyst', 'chemist'] }, ['qc', 'testing', 'specification'], `
# Pengujian QC Fisika-Kimia

QC menguji bahan baku, bahan kemas, produk antara (bulk), dan produk jadi terhadap spesifikasi yang disetujui. Prosedur lengkap ada di [[SOP QC - Pengujian & Release Batch]].

## Uji yang lazim untuk produk skincare
| Parameter | Metode/alat | Catatan kritis |
|---|---|---|
| Penampilan, warna, bau | visual vs standar referensi, kabin cahaya | gunakan standar batch acuan yang disimpan |
| pH | pH meter terkalibrasi | metode (langsung atau dispersi) konsisten |
| Viskositas | viskometer rotasional | spindle, rpm, suhu, waktu baca tetap |
| Berat jenis | piknometer atau gelas ukur logam | indikasi udara terperangkap |
| Homogenitas, ukuran droplet | mikroskop | bandingkan dengan standar |
| Kadar aktif | HPLC, UV-Vis, titrasi | untuk aktif dengan klaim atau kritis stabilitas |
| Kadar air/padatan | moisture analyzer, oven | bubuk, balm |
| Berat/volume isi | timbangan, sampling statistik | memenuhi pernyataan isi bersih |
| Kebocoran, torsi tutup | uji vakum, torsimeter | produk jadi |
| Kesesuaian kemasan dan label | checklist dengan artwork approved | nomor batch, ED, nomor notifikasi |

## Pengujian bahan baku
- Identifikasi (mis. FTIR terhadap spektrum referensi, indeks bias, titik leleh), penampilan, dan parameter kritis spesifikasi.
- Dokumen supplier: COA per lot dibandingkan dengan spesifikasi internal; lihat [[Kualifikasi Supplier, COA & Spesifikasi Bahan Baku]].
- Supplier terkualifikasi dapat memperoleh pengurangan pengujian (reduced testing) dengan uji identifikasi tetap dilakukan, sesuai kebijakan QA.

## Pengujian bahan kemas
- Dimensi kritis (diameter leher, tinggi), berat, warna vs standar, kualitas cetak, fungsi (pompa, tutup), kesesuaian artwork dan teks.
- Sampling menggunakan rencana statistik (mis. konsep AQL) dengan klasifikasi cacat kritis, mayor, minor.

## Validasi dan verifikasi metode
- Metode baru atau metode kadar aktif divalidasi: spesifisitas, linearitas, akurasi, presisi, rentang, dan batas deteksi bila relevan.
- Uji kesesuaian sistem (system suitability) setiap menjalankan HPLC.

## Out of Specification (OOS)
1. Analis melapor ke supervisor; jangan membuang sampel atau larutan.
2. **Investigasi fase 1 (lab)**: cek perhitungan, alat, standar, pereaksi, prosedur. Bila ditemukan kesalahan lab yang jelas, hasil dibatalkan dan uji diulang dengan dokumentasi.
3. **Fase 2 (produksi)**: bila tidak ada kesalahan lab, investigasi proses dan bahan.
4. Uji ulang hanya sesuai protokol yang disetujui QA; tidak boleh "menguji sampai lulus".
5. Keputusan batch oleh QA dan CAPA dicatat, lihat [[Deviasi, CAPA & Analisis Akar Masalah]].

## Manajemen laboratorium
- Kalibrasi alat terjadwal, log penggunaan, standar referensi dengan tanggal kedaluwarsa, pereaksi berlabel (tanggal buat, kedaluwarsa, pembuat).
- Data mentah disimpan dan dapat ditelusuri (prinsip ALCOA).
- Lihat [[Mikrobiologi Kosmetik & Challenge Test]] dan [[Release Batch & Retained Sample]].
`),

  K('Mikrobiologi Kosmetik & Challenge Test', { divisions: ['qa', 'rnd', 'mfg'], roles: ['micro', 'qc', 'lab', 'formula', 'r&d'] }, ['microbiology', 'challenge-test', 'qc'], `
# Mikrobiologi Kosmetik & Challenge Test

## Sumber kontaminasi
- Air (paling umum, terutama bila sistem purified water tidak terpantau).
- Bahan baku alami (ekstrak, gum, bubuk mineral, pati).
- Peralatan dan selang yang tidak bersih atau tidak kering.
- Personel dan udara lingkungan.
- Kemasan.
- Penggunaan oleh konsumen.

## Konsep batas mikroba produk jadi
Regulasi menetapkan batas **angka lempeng total (ALT)** bakteri aerob mesofilik, **angka kapang khamir (AKK)**, dan ketiadaan mikroba patogen tertentu. Konsep acuan internasional (ISO 17516) membedakan:
- Produk untuk area mata, anak-anak di bawah usia tertentu, dan membran mukosa: batas lebih ketat.
- Produk lainnya: batas lebih longgar.
- Mikroba spesifik yang harus negatif dalam sejumlah sampel (mis. per 1 g atau 1 mL): **Pseudomonas aeruginosa, Staphylococcus aureus, Candida albicans, Escherichia coli**, dan sesuai regulasi dapat ditambah lainnya.

**Gunakan angka batas dari peraturan BPOM yang berlaku sebagai acuan spesifikasi Ray Beauty; verifikasi ke peraturan BPOM terbaru** sebelum menetapkan atau mengubah spesifikasi.

## Metode uji rutin (konsep)
1. Persiapan sampel dengan pengencer yang mengandung **penetral pengawet** (mis. polysorbate, lecithin) agar pengawet tidak menghambat pertumbuhan di cawan dan menghasilkan negatif palsu.
2. **Validasi penetralan** (method suitability) untuk tiap formula atau kelompok formula.
3. Hitung cawan untuk bakteri aerob dan kapang khamir pada media dan suhu inkubasi yang ditetapkan.
4. Uji deteksi patogen dengan pengayaan dan media selektif, konfirmasi koloni tersangka.
5. Kontrol positif dan negatif, uji pertumbuhan media (growth promotion).
Waktu inkubasi beberapa hari harus masuk perencanaan lead time release.

## Pemantauan lingkungan dan air
- Purified water: konduktivitas/TOC dan mikrobiologi di titik pengambilan bergilir dengan batas waspada (alert) dan batas tindakan (action).
- Settle plate atau air sampler di area pengisian, swab permukaan, swab tangan operator.
- Tren dianalisis bulanan; kenaikan tren memicu investigasi sebelum melampaui batas tindakan.

## Challenge test (uji efektivitas pengawet)
Acuan metode umum: **ISO 11930**.
1. Inokulasi produk terpisah dengan suspensi mikroba uji: Pseudomonas aeruginosa, Staphylococcus aureus, Escherichia coli, Candida albicans, Aspergillus brasiliensis.
2. Konsentrasi awal tinggi yang ditetapkan metode.
3. Hitung jumlah mikroba hidup pada titik waktu yang ditentukan (mis. hari ke-7, 14, 28).
4. Bandingkan reduksi log terhadap kriteria penerimaan (kriteria A lebih ketat, kriteria B dapat diterima dengan justifikasi risiko tambahan).
5. Uji dilakukan pada formula final, idealnya juga setelah penyimpanan stabilitas, untuk memastikan pengawet tetap efektif.

**Interpretasi reduksi log**: reduksi 1 log = berkurang 90 persen, 2 log = 99 persen, 3 log = 99,9 persen.

## Kapan challenge test diulang
- Formula baru atau perubahan sistem pengawet, pH, atau kadar air signifikan.
- Perubahan kemasan dari jar ke pump atau sebaliknya (penilaian risiko).
- Keluhan kontaminasi atau tren mikro memburuk.

## Tindakan saat batch gagal mikro
Batch ditahan (hold), investigasi akar masalah (air, bahan, alat, personel), keputusan QA (umumnya tolak dan musnahkan), serta CAPA. Lihat [[Deviasi, CAPA & Analisis Akar Masalah]] dan [[Sistem Pengawet Kosmetik]].
`),

  K('Release Batch & Retained Sample', { divisions: ['qa', 'mfg', 'scm'], roles: ['qa', 'qc', 'warehouse', 'production', 'ppic'] }, ['qc', 'release', 'retained-sample', 'cpkb'], `
# Release Batch & Retained Sample

Release adalah keputusan formal QA bahwa sebuah batch layak didistribusikan. Tidak ada produk yang boleh dikirim dari status karantina. Prosedur internal ada di [[SOP QC - Pengujian & Release Batch]].

## Status material dan produk
| Status | Arti | Penandaan |
|---|---|---|
| Karantina | menunggu hasil uji/review | label kuning atau status sistem "Q" |
| Diluluskan (Released) | boleh dipakai/dikirim | label hijau |
| Ditolak (Rejected) | tidak memenuhi syarat | label merah, area terkunci |
| Ditahan (Hold) | sedang investigasi | label khusus |

Status di sistem WMS/ERP harus selaras dengan label fisik; gudang tidak boleh mengalokasikan stok non-released. Lihat [[Operasi Gudang & Stock Opname]].

## Langkah release produk jadi
1. **Uji produk jadi** sesuai spesifikasi: fisika-kimia, mikrobiologi, kemasan dan penandaan.
2. **Review catatan batch lengkap** oleh QA:
   - Semua langkah terisi, paraf lengkap, parameter dalam rentang.
   - Rekonsiliasi bahan, bulk, dan kemasan dalam batas.
   - In-process control memenuhi syarat.
   - Line clearance terdokumentasi.
   - Deviasi (bila ada) sudah diinvestigasi, dinilai dampaknya, dan ditutup atau ada justifikasi tertulis.
3. **Verifikasi status pendukung**: bahan baku dan kemasan yang dipakai berstatus released; produk memiliki nomor notifikasi aktif dan artwork label disetujui.
4. **Keputusan release** oleh personel QA yang berwenang, ditandatangani dengan tanggal, lalu status diubah di sistem.

## Release bersyarat
Hanya bila diatur dalam prosedur dan disetujui pimpinan QA dengan penilaian risiko (mis. pengiriman antar gudang internal sambil menunggu hasil akhir dengan karantina tetap). Untuk distribusi ke pasar, tunggu semua hasil kritis. Persetujuan mengikuti [[Kebijakan Persetujuan]].

## Retained sample (sampel pertinggal)
Tujuan: bukti untuk investigasi keluhan, efek samping, dan audit.
- **Produk jadi**: setiap batch, dalam kemasan akhir yang dipasarkan, jumlah cukup untuk minimal dua kali pengujian lengkap.
- **Bahan baku**: sampel per lot yang diterima, sesuai kebijakan QA.
- Lama simpan: umumnya sampai sekurang-kurangnya masa kedaluwarsa ditambah periode tertentu; **verifikasi ke peraturan BPOM terbaru dan pedoman CPKB** untuk durasi yang dipersyaratkan.
- Kondisi simpan sesuai label penyimpanan produk, area terkunci, akses terbatas, logbook keluar-masuk.
- Penarikan sampel pertinggal untuk uji harus tercatat (siapa, kapan, untuk apa).

Bedakan dengan **sampel stabilitas** (bagian program stabilitas berkelanjutan untuk batch produksi) dan **sampel referensi** (untuk pengujian ulang).

## Dokumentasi pendukung
- Certificate of Analysis (COA) produk jadi internal per batch untuk distributor atau marketplace bila diminta.
- Daftar batch released harian untuk PPIC dan Gudang.

## KPI
- Lead time release (selesai produksi sampai released), right-first-time batch record, jumlah batch reject per bulan, jumlah deviasi per 100 batch.
Kaitkan dengan [[Penanganan Efek Samping & Kosmetovigilans]] saat sampel pertinggal dipakai untuk investigasi keluhan.
`),

  K('Deviasi, CAPA & Analisis Akar Masalah', { divisions: ['qa', 'mfg', 'rnd', 'scm', 'ops'], roles: ['qa', 'qc', 'production', 'supervisor', 'warehouse', 'ppic'] }, ['deviation', 'capa', 'root-cause', 'quality-system'], `
# Deviasi, CAPA & Analisis Akar Masalah

**Deviasi** adalah penyimpangan dari prosedur, spesifikasi, atau kondisi yang disetujui. **CAPA** (Corrective and Preventive Action) adalah tindakan untuk menghilangkan penyebab agar tidak terulang (korektif) atau tidak terjadi (preventif).

## Alur penanganan deviasi
1. **Deteksi dan tindakan segera (containment)**: hentikan proses bila perlu, pisahkan dan beri label "Hold" pada material/batch terdampak.
2. **Pelaporan** maksimal dalam waktu yang ditetapkan SOP (mis. dalam satu shift) ke supervisor dan QA, dengan nomor deviasi.
3. **Klasifikasi risiko**:
   - Kritis: berdampak pada keamanan konsumen atau kepatuhan regulasi (mis. salah bahan, kontaminasi mikro, label salah klaim/nomor notifikasi).
   - Mayor: berdampak pada mutu tapi tidak langsung pada keamanan (mis. viskositas di luar spesifikasi).
   - Minor: penyimpangan dokumentasi atau proses tanpa dampak mutu.
4. **Investigasi akar masalah** dengan metode di bawah.
5. **Penilaian dampak** pada batch terdampak dan batch lain (apakah masalah sistemik).
6. **Keputusan disposisi** batch oleh QA: release, rework/reprocess (bila prosedur tervalidasi), atau tolak.
7. **CAPA**: penanggung jawab, tenggat, bukti penyelesaian.
8. **Verifikasi efektivitas CAPA** setelah periode tertentu (mis. tidak ada kejadian berulang dalam beberapa batch berikutnya).
9. Penutupan oleh QA, data masuk tren bulanan.

## Metode 5 Why
Tanyakan "mengapa" berulang sampai menemukan penyebab sistemik yang dapat dikendalikan.
Contoh: viskositas krim rendah.
1. Mengapa rendah? Pengental tidak terhidrasi sempurna.
2. Mengapa? Waktu dispersi lebih singkat dari prosedur.
3. Mengapa? Operator mengejar jadwal changeover.
4. Mengapa? Jadwal tidak memperhitungkan waktu hidrasi.
5. Mengapa? Standar waktu proses di PPIC belum diperbarui sejak formula berubah.
Akar masalah: data master waktu proses tidak dikontrol perubahan. CAPA: update master data, hubungkan change control R&D ke PPIC.

## Diagram fishbone (Ishikawa) 6M
Kelompokkan kemungkinan penyebab:
- **Man** (personel): pelatihan, kelelahan, pemahaman instruksi.
- **Machine**: kalibrasi, keausan, setting.
- **Method**: prosedur tidak jelas atau tidak sesuai.
- **Material**: variasi lot bahan baku, supplier baru.
- **Measurement**: metode uji, alat ukur, sampling.
- **Mother Nature/Environment**: suhu, kelembapan, kebersihan.
Gunakan fishbone untuk brainstorming, lalu 5 Why untuk menggali cabang yang paling didukung data.

## Alat pendukung
- Pareto (80/20) untuk memilih masalah prioritas.
- Is/Is Not analysis untuk mempersempit lingkup.
- Fault tree dan FMEA (RPN = Severity x Occurrence x Detection) untuk risiko proses.

## Kesalahan umum
- Berhenti di "human error" tanpa bertanya mengapa sistem memungkinkan kesalahan itu.
- CAPA hanya "retraining" untuk semua masalah.
- Tidak menutup CAPA atau tidak memverifikasi efektivitas.
- Tidak menghubungkan deviasi berulang lintas batch.

## Change control
Perubahan formula, supplier, proses, alat, spesifikasi, atau label harus melalui change control dengan penilaian dampak regulasi (apakah perlu pembaruan notifikasi), mutu, dan stabilitas. Persetujuan mengikuti [[Kebijakan Persetujuan]].

Lihat [[Pengujian QC Fisika-Kimia]] untuk OOS dan [[Prinsip CPKB - Personel, Bangunan & Dokumentasi]].
`),

  K('Notifikasi BPOM, DIP & ASEAN Cosmetic Directive', { divisions: ['reg', 'rnd', 'qa', 'legal'], roles: ['regulatory', 'r&d', 'qa', 'claims', 'halal'] }, ['regulatory', 'bpom', 'notification', 'dip', 'acd'], `
# Notifikasi BPOM, DIP & ASEAN Cosmetic Directive

## ASEAN Cosmetic Directive (ACD) secara ringkas
- Kesepakatan harmonisasi regulasi kosmetik negara ASEAN; Indonesia mengadopsinya dalam peraturan BPOM.
- Sistem **notifikasi**: produk tidak dievaluasi sebelum beredar seperti registrasi obat; tanggung jawab keamanan ada pada pemilik notifikasi, diawasi melalui **post-market surveillance** dan inspeksi DIP.
- Annex utama ACD:
  - Annex II: bahan yang dilarang.
  - Annex III: bahan yang dibatasi (kadar, area pakai, peringatan).
  - Annex IV: pewarna yang diizinkan.
  - Annex VI: pengawet yang diizinkan.
  - Annex VII: filter UV yang diizinkan.
- Daftar Annex diperbarui berkala; **verifikasi ke peraturan BPOM terbaru** dan pembaruan ASEAN sebelum memakai suatu bahan.
- Definisi kosmetik: bahan atau sediaan untuk bagian luar tubuh (epidermis, rambut, kuku, bibir, organ genital luar) atau gigi dan mukosa mulut, terutama untuk membersihkan, mewangikan, mengubah penampilan, memperbaiki bau badan, melindungi, atau memelihara tubuh pada kondisi baik. Produk yang mengklaim mengobati atau mencegah penyakit bukan kosmetik.

## Proses notifikasi kosmetik BPOM (gambaran umum)
1. **Persiapan perusahaan**: pemohon adalah badan usaha di Indonesia (industri kosmetik yang memiliki izin produksi, atau importir/badan usaha yang bekerja sama dengan industri). Ray Beauty memakai izin produksi dan sertifikat CPKB pabriknya sendiri.
2. **Pendaftaran akun** perusahaan di sistem notifikasi elektronik BPOM.
3. **Penyiapan data produk**: nama dan varian, kategori, formula lengkap (INCI dan persentase), fungsi bahan, kemasan, rancangan label, klaim.
4. **Pengecekan kepatuhan**: bahan terhadap Annex, kadar, klaim, label.
5. **Pengajuan notifikasi dan pembayaran PNBP** sesuai tarif berlaku.
6. **Evaluasi administratif** oleh BPOM; bisa diminta perbaikan data.
7. **Terbit nomor notifikasi** (untuk produk dalam negeri umumnya diawali kode NA). Masa berlaku dan aturan perpanjangan dapat berubah; **verifikasi ke peraturan BPOM terbaru**.
8. **Perubahan**: perubahan formula, nama, kemasan, atau klaim tertentu dapat memerlukan notifikasi baru atau pemberitahuan perubahan; selalu nilai lewat change control.
Prosedur internal: [[SOP Regulasi - Notifikasi BPOM & Halal]].

## Dokumen Informasi Produk (DIP)
DIP adalah dokumen yang wajib disiapkan pemilik notifikasi dan disediakan saat diperiksa BPOM. Mengacu konsep Product Information File ACD, isinya:
1. **Data administratif dan ringkasan produk**: identitas perusahaan, nomor notifikasi, label dan kemasan.
2. **Mutu bahan baku**: spesifikasi dan COA bahan, spesifikasi pewangi (termasuk informasi alergen bila relevan), status bahan terhadap Annex.
3. **Mutu produk jadi**: formula, metode pembuatan ringkas, spesifikasi dan metode uji, data stabilitas, hasil mikrobiologi dan challenge test, informasi kemasan.
4. **Keamanan**: penilaian keamanan (safety assessment) oleh penilai yang kompeten, mencakup profil toksikologi bahan, paparan, uji keamanan produk bila ada, dan data efek samping.
5. **Efikasi/bukti klaim**: laporan uji klinis, uji konsumen, data literatur atau supplier.

Checklist kesiapan DIP sebelum launching:
- Semua bagian terisi dan versi formula sama dengan yang dinotifikasi.
- Safety assessment ditandatangani.
- Bukti klaim untuk setiap klaim di label dan materi promosi.
- Data stabilitas minimal tahap yang dipersyaratkan internal, real-time berjalan.

Lihat [[Persyaratan Label Kosmetik]], [[Klaim Kosmetik - Boleh & Tidak Boleh]], dan [[Uji Stabilitas & Kompatibilitas Kemasan]].
`),

  K('Persyaratan Label Kosmetik', { divisions: ['reg', 'design', 'mkt', 'qa', 'scm'], roles: ['regulatory', 'packaging', 'designer', 'claims', 'qa'] }, ['regulatory', 'label', 'packaging', 'artwork'], `
# Persyaratan Label Kosmetik

Label adalah dokumen regulasi, bukan hanya desain. Setiap artwork kemasan Ray Beauty harus diperiksa Regulatory dan QA sebelum dicetak. Detail dan format wajib dapat berubah; **verifikasi ke peraturan BPOM terbaru** tentang penandaan kosmetik.

## Unsur penandaan yang umumnya wajib (mengacu konsep ASEAN)
1. **Nama produk** dan, bila perlu, nama varian.
2. **Kegunaan** produk bila tidak jelas dari nama atau tampilan.
3. **Cara penggunaan** bila diperlukan agar aman dan efektif.
4. **Komposisi/daftar bahan** dengan nama INCI, diurutkan dari kadar terbesar ke terkecil; bahan di bawah ambang tertentu dapat ditulis tanpa urutan; pewarna dapat ditulis dengan nomor CI sesuai ketentuan.
5. **Nama dan alamat** badan usaha yang bertanggung jawab (pemilik notifikasi) dan negara asal produk.
6. **Netto/isi bersih** dalam satuan metrik (gram atau mL).
7. **Nomor batch/kode produksi**.
8. **Tanggal kedaluwarsa** dan/atau ketentuan masa pakai sesuai regulasi yang berlaku.
9. **Nomor notifikasi BPOM**.
10. **Peringatan/perhatian** khusus, termasuk peringatan yang dipersyaratkan Annex untuk bahan tertentu (mis. bahan dibatasi).
11. **Logo halal** dan nomor sertifikat sesuai ketentuan BPJPH bila produk bersertifikat halal, lihat [[Sertifikasi Halal Kosmetik via BPJPH]].
12. Informasi wajib menggunakan **Bahasa Indonesia** (dapat didampingi bahasa lain), kecuali istilah yang diizinkan (mis. INCI).

Jika kemasan primer terlalu kecil, sebagian informasi dapat diletakkan di kemasan sekunder, brosur, atau label gantung sesuai ketentuan. Nama produk, nomor batch, dan netto biasanya tetap harus ada di kemasan primer; verifikasi rinciannya.

## Prosedur approval artwork
1. Marketing/Design menyusun draf dari brief.
2. **Regulatory** mengecek: konsistensi dengan data notifikasi (nama, formula, netto), klaim, peringatan, Bahasa Indonesia.
3. **R&D** mengecek: daftar INCI sesuai formula final, cara pakai.
4. **QA** mengecek: area coding batch/ED, keterbacaan, barcode.
5. **Halal/Legal** mengecek: logo halal, merek dagang.
6. Approval final tertulis dengan nomor versi artwork; supplier cetak menerima hanya file final.
7. **Proof cetak** dicek terhadap artwork approved (warna, teks, dimensi) sebelum produksi massal.
8. Artwork versi lama ditarik dari supplier.

## Kesalahan label yang sering terjadi
- Daftar INCI tidak diperbarui setelah perubahan formula atau supplier pewangi.
- Netto tidak sesuai dengan isi aktual atau satuan salah.
- Klaim di label berbeda dari data yang dinotifikasi.
- Klaim "hipoalergenik", "dermatologically tested" tanpa bukti di DIP.
- Typo nomor notifikasi atau alamat.
- Area coding tertutup lipatan atau varnish sehingga tinta tidak menempel.

## Hubungan dengan kanal digital
Informasi produk di marketplace, situs, dan media sosial juga harus konsisten dengan label dan notifikasi, termasuk klaim. Lihat [[Klaim Kosmetik - Boleh & Tidak Boleh]], [[Pedoman Klaim Kosmetik]], dan [[Produk Ray Beauty]].
`),

  K('Klaim Kosmetik - Boleh & Tidak Boleh', { divisions: ['reg', 'mkt', 'ecom', 'studio', 'retail', 'cs', 'rnd'], roles: ['claims', 'regulatory', 'copywriter', 'content', 'beauty advisor', 'marketing'] }, ['regulatory', 'claims', 'marketing', 'compliance'], `
# Klaim Kosmetik - Boleh & Tidak Boleh

Klaim mencakup semua pernyataan tentang produk: di label, iklan, konten media sosial, deskripsi marketplace, live streaming, materi beauty advisor, dan endorsement KOL. Acuan utama perusahaan: [[Pedoman Klaim Kosmetik]]. Ketentuan BPOM tentang klaim dapat berubah; **verifikasi ke peraturan BPOM terbaru**.

## Prinsip klaim kosmetik (mengacu kriteria umum ASEAN)
1. **Kepatuhan hukum**: tidak menyatakan produk disetujui/diberi izin oleh BPOM sebagai klaim keunggulan.
2. **Kebenaran**: tidak menyatakan manfaat bahan bila bahan tidak ada atau kadarnya tidak mendukung.
3. **Dukungan bukti**: setiap klaim didukung data (uji klinis, uji konsumen, literatur, data supplier) yang tersimpan di DIP.
4. **Kejujuran**: tidak melebih-lebihkan, tidak memanipulasi gambar before-after.
5. **Adil**: tidak menjelekkan produk pesaing atau bahan yang diizinkan.
6. **Keputusan berdasarkan informasi**: konsumen dapat memahami klaim dengan benar.

## Batas kosmetik vs obat
Kosmetik merawat penampilan dan kondisi baik bagian luar tubuh. **Tidak boleh** mengklaim mengobati, menyembuhkan, mencegah penyakit, atau mengubah fungsi fisiologis tubuh.

| Hindari | Alternatif yang lebih aman |
|---|---|
| "Menyembuhkan jerawat" | "Membantu merawat kulit berjerawat" |
| "Menghilangkan flek hitam selamanya" | "Membantu menyamarkan tampilan noda hitam" |
| "Memutihkan permanen" | "Membantu mencerahkan kulit" (dengan bukti) |
| "Menumbuhkan kolagen baru" | "Membantu menjaga kekenyalan kulit" |
| "Anti-inflamasi", "antibiotik", "antiseptik untuk luka" | "Membantu menenangkan kulit" |
| "Efek seperti suntik botox/filler" | "Membantu menyamarkan tampilan garis halus" |
| "Aman 100%", "tanpa efek samping" | "Telah melalui uji iritasi pada kulit manusia" (bila benar) |
| "Hasil instan 1 malam" | klaim waktu hanya bila didukung uji |

## Klaim yang butuh bukti spesifik
- Angka persentase ("94% responden...") dari uji konsumen dengan metodologi tercatat.
- Klaim waktu ("melembapkan 24 jam") dari uji instrumental.
- "Dermatologically tested", "hypoallergenic", "non-comedogenic", "suitable for sensitive skin": butuh laporan uji yang relevan.
- SPF/PA dan "tahan air": laporan uji standar, lihat [[Filter UV, Formulasi Sunscreen & Konsep Uji SPF/PA]].
- "Natural", "organic", "vegan", "clean": definisikan dan siapkan bukti; hindari bila tidak dapat dibuktikan.
- Klaim "bebas X" (bebas paraben, bebas alkohol): boleh bila benar dan tidak menyesatkan atau menjelekkan bahan yang diizinkan; ikuti [[Pedoman Klaim Kosmetik]].
- Klaim halal hanya setelah sertifikat terbit, lihat [[Sertifikasi Halal Kosmetik via BPJPH]].

## Alur review klaim
1. Tim konten menulis draf dan mencantumkan sumber bukti.
2. Regulatory mereview terhadap pedoman dan DIP; R&D memverifikasi teknis.
3. Klaim berisiko tinggi atau baru diputuskan sesuai [[Kebijakan Persetujuan]].
4. Simpan daftar "klaim disetujui" per produk sebagai bank klaim untuk semua kanal.
5. Brief KOL/affiliate wajib menyertakan daftar klaim yang boleh dan dilarang; pantau konten tayang.

## Checklist cepat sebelum publikasi
- Tidak ada kata obat/penyakit.
- Ada bukti untuk setiap angka.
- Sesuai label dan data notifikasi.
- Gambar before-after tidak diedit dan berasal dari uji yang terdokumentasi.
Lihat juga [[Persyaratan Label Kosmetik]].
`),

  K('Sertifikasi Halal Kosmetik via BPJPH', { divisions: ['reg', 'rnd', 'scm', 'qa', 'mfg'], roles: ['halal', 'regulatory', 'buyer', 'procurement', 'qa', 'formula'] }, ['halal', 'bpjph', 'regulatory', 'sjph'], `
# Sertifikasi Halal Kosmetik via BPJPH

Sertifikasi halal di Indonesia diselenggarakan oleh **BPJPH** (Badan Penyelenggara Jaminan Produk Halal) berdasarkan Undang-Undang Jaminan Produk Halal dan peraturan turunannya. Kosmetik termasuk produk yang diwajibkan bersertifikat halal secara bertahap, dengan ketentuan jadwal dan pengecualian (mis. produk yang mengandung bahan haram wajib mencantumkan keterangan tidak halal). Jadwal dan tata cara dapat berubah; **verifikasi ke peraturan BPJPH terbaru**. Prosedur internal: [[SOP Regulasi - Notifikasi BPOM & Halal]].

## Pihak yang terlibat
- **BPJPH**: menerima permohonan, menerbitkan sertifikat.
- **LPH (Lembaga Pemeriksa Halal)**: melakukan pemeriksaan/audit dan pengujian; perusahaan memilih LPH yang terakreditasi.
- **Komisi Fatwa MUI** (atau mekanisme penetapan kehalalan yang berlaku): menetapkan fatwa kehalalan produk berdasarkan hasil pemeriksaan.
- **Penyelia Halal** internal: personel yang ditetapkan perusahaan, bertanggung jawab atas proses produk halal (PPH).

## Sistem Jaminan Produk Halal (SJPH)
Perusahaan membangun sistem yang memastikan kehalalan konsisten, mencakup:
1. Komitmen dan tanggung jawab manajemen, kebijakan halal.
2. Penetapan dan pelatihan Penyelia Halal serta tim manajemen halal.
3. **Bahan**: semua bahan (termasuk bahan penolong, pelarut, pewangi, pewarna, dan bahan kemasan yang kontak produk bila relevan) memiliki dokumen pendukung kehalalan (sertifikat halal yang masih berlaku atau dokumen yang dipersyaratkan).
4. **Produk**: nama dan karakteristik produk tidak bertentangan dengan syariat.
5. **Fasilitas produksi**: bebas kontaminasi bahan najis; bila fasilitas dipakai bersama produk non-halal, ada prosedur pemisahan dan pembersihan yang memadai.
6. **Prosedur tertulis aktivitas kritis**: seleksi bahan baru, pembelian, penerimaan, formulasi/pengembangan produk, produksi, pencucian, penyimpanan, distribusi.
7. **Ketertelusuran** dari bahan ke produk jadi.
8. Penanganan produk yang tidak memenuhi kriteria.
9. Audit internal dan kaji ulang manajemen.

## Bahan kritis kosmetik yang perlu perhatian
- Turunan hewani: kolagen, gelatin, elastin, keratin, plasenta, squalene/squalane hewani, lanolin, gliserin dan asam lemak dari lemak hewan, stearat, emulsifier berbasis lemak.
- Hasil fermentasi dan bioteknologi (media pertumbuhan).
- Etanol dan turunan alkohol: perlakuan mengikuti fatwa dan ketentuan yang berlaku.
- Pewangi dan ekstrak (pelarut dan pembawa).
- Kuas atau aplikator berbahan bulu hewan.

## Alur permohonan (gambaran umum)
1. Siapkan SJPH, daftar bahan dengan dokumen halal, daftar produk, alur proses, dan data fasilitas.
2. Ajukan permohonan melalui sistem elektronik BPJPH (SIHALAL) dan pilih LPH.
3. Verifikasi dokumen dan penetapan biaya.
4. Pemeriksaan/audit LPH di fasilitas, termasuk pengujian laboratorium bila diperlukan.
5. Penetapan kehalalan, lalu penerbitan sertifikat halal oleh BPJPH.
6. Pencantuman label halal nasional sesuai ketentuan pada kemasan, lihat [[Persyaratan Label Kosmetik]].

## Menjaga status halal
- Setiap bahan baru, supplier baru, atau perubahan formula melalui persetujuan Penyelia Halal **sebelum** dibeli dan dipakai.
- Pantau masa berlaku sertifikat halal bahan dari supplier; buat pengingat sebelum kedaluwarsa.
- Laporkan perubahan yang dipersyaratkan ke BPJPH.
- Kaitkan dengan [[Kualifikasi Supplier, COA & Spesifikasi Bahan Baku]].
`),

  K('Penanganan Efek Samping & Kosmetovigilans', { divisions: ['reg', 'qa', 'cs', 'retail', 'ecom', 'legal'], roles: ['regulatory', 'qa', 'customer service', 'beauty advisor', 'complaint'] }, ['adverse-event', 'cosmetovigilance', 'complaint', 'recall'], `
# Penanganan Efek Samping & Kosmetovigilans

Kosmetovigilans adalah kegiatan pengumpulan, evaluasi, dan pemantauan efek tidak diinginkan akibat penggunaan kosmetik. Pemilik notifikasi bertanggung jawab memantau dan melaporkan sesuai ketentuan BPOM; tata cara dan tenggat pelaporan dapat berubah, **verifikasi ke peraturan BPOM terbaru**.

## Definisi kerja
- **Keluhan mutu**: masalah produk (bau berubah, pemisahan, kemasan bocor, isi kurang, benda asing).
- **Efek tidak diinginkan**: reaksi pada tubuh (gatal, kemerahan, perih, ruam, bengkak).
- **Efek tidak diinginkan serius**: reaksi yang mengakibatkan cacat, rawat inap, ancaman jiwa, atau kondisi berat lain sesuai definisi regulasi. Wajib eskalasi segera.

## Alur penanganan
1. **Penerimaan** (CS, beauty advisor, marketplace, media sosial): catat di formulir standar dalam waktu yang ditetapkan.
   Data minimum: identitas dan kontak pelapor (dengan persetujuan), nama produk, **nomor batch**, tanggal kedaluwarsa, tempat beli, cara dan frekuensi pakai, produk lain yang dipakai bersamaan, waktu muncul reaksi, gejala, foto (dengan izin), tindakan yang sudah dilakukan, riwayat alergi.
2. **Respons awal ke konsumen**: empatik, sarankan hentikan pemakaian, bilas area dengan air, dan konsultasi ke tenaga kesehatan bila gejala berat atau berlanjut. **Jangan memberikan diagnosis atau saran pengobatan.** Jangan menyalahkan konsumen dan jangan menjanjikan kompensasi sebelum evaluasi.
3. **Eskalasi** ke QA dan Regulatory; kasus serius dan kasus yang viral di media sosial dieskalasi segera ke pimpinan sesuai [[Kebijakan Persetujuan]].
4. **Pengambilan sampel**: minta produk konsumen (bila memungkinkan) dan uji bersama **sampel pertinggal** dari batch yang sama, lihat [[Release Batch & Retained Sample]].
5. **Evaluasi kausalitas** oleh personel kompeten (penilai keamanan): hubungan waktu, perbaikan setelah berhenti, kemunculan kembali saat dipakai ulang, faktor lain, profil bahan (mis. pewangi, pengawet, aktif asam).
6. **Pelaporan ke BPOM** sesuai kriteria dan tenggat yang berlaku.
7. **Tindak lanjut**: jawab konsumen secara tertulis, tutup kasus, masukkan data ke tren.

## Analisis tren
- Hitung tingkat keluhan per juta unit terjual per SKU dan per batch.
- Tren naik pada satu batch: indikasi masalah produksi atau bahan; tren naik di semua batch: indikasi masalah formula atau klaim/cara pakai.
- Masukkan hasil ke kaji ulang keamanan produk dan pembaruan DIP.

## Penarikan produk (recall)
- Dipicu oleh risiko keamanan, temuan mutu serius, atau perintah BPOM.
- Siapkan prosedur recall: tim, klasifikasi risiko, daftar distribusi per batch (dari data gudang dan 3PL), template komunikasi, rekonsiliasi jumlah ditarik vs didistribusikan.
- Lakukan **mock recall** berkala untuk menguji kecepatan ketertelusuran. Lihat [[Logistik, Distribusi & Manajemen 3PL]].

## Dokumentasi dan pelatihan
- Semua kasus tercatat dengan nomor unik, disimpan sesuai kebijakan retensi.
- CS dan beauty advisor dilatih memakai skrip respons dan kriteria eskalasi.
- Hubungkan temuan dengan [[Deviasi, CAPA & Analisis Akar Masalah]] bila terkait mutu.
`),

  K('Kualifikasi Supplier, COA & Spesifikasi Bahan Baku', { divisions: ['scm', 'qa', 'rnd', 'reg'], roles: ['buyer', 'procurement', 'purchasing', 'qa', 'qc', 'halal', 'packaging'] }, ['supplier', 'coa', 'specification', 'procurement'], `
# Kualifikasi Supplier, COA & Spesifikasi Bahan Baku

Mutu produk dimulai dari mutu bahan. Pembelian hanya boleh dari **daftar supplier yang disetujui (Approved Supplier List, ASL)** yang dikelola QA bersama Procurement.

## Tahapan kualifikasi supplier baru
1. **Kebutuhan dan seleksi awal**: R&D atau Procurement mengusulkan; pertimbangkan harga, MOQ, lead time, lokasi, kapasitas.
2. **Kuesioner supplier**: legalitas, sistem mutu (ISO 9001, GMP/ISO 22716), sertifikat halal, kebijakan perubahan, kemampuan ketertelusuran, keberlanjutan.
3. **Dokumen teknis bahan**: TDS (technical data sheet), SDS/MSDS, spesifikasi, contoh COA, pernyataan status regulasi (mis. komposisi, impurities), dokumen halal, pernyataan alergen pewangi, informasi asal (nabati/hewani/sintetis), pernyataan bebas bahan dilarang.
4. **Evaluasi sampel** oleh R&D (kinerja dalam formula) dan QC (uji terhadap spesifikasi).
5. **Audit supplier** (onsite, remote, atau kuesioner) berbasis risiko: wajib untuk bahan kritis (aktif, pengawet, filter UV, kemasan primer).
6. **Batch percobaan**: beberapa lot awal diuji penuh.
7. **Persetujuan** oleh QA dan, bila relevan, Penyelia Halal; masuk ASL dengan kategori risiko.

## Spesifikasi bahan baku internal
Setiap bahan punya spesifikasi bernomor dan berversi berisi:
- Nama dagang, nama INCI, nomor CAS bila ada, kode internal, supplier dan produsen yang disetujui.
- Parameter dan batas: penampilan, warna, bau, identifikasi (FTIR), kadar/assay, pH larutan, indeks bias, berat jenis, bilangan asam/peroksida untuk minyak, kadar air, cemaran logam berat, mikrobiologi (terutama bahan alam dan air-based).
- Kondisi penyimpanan, masa simpan/retest date, kemasan.
- Metode uji dan rencana sampling.
- Persyaratan dokumen per kiriman (COA wajib per lot).

## Verifikasi COA saat penerimaan
Checklist QC/Gudang:
- Nama bahan, kode, dan supplier sesuai PO dan ASL.
- Nomor lot di COA sama dengan nomor lot di kemasan.
- Tanggal produksi dan kedaluwarsa/retest tercantum dan sisa umur memenuhi kebijakan penerimaan.
- Semua parameter COA berada dalam spesifikasi internal (bukan hanya spesifikasi supplier).
- COA ditandatangani/disahkan pihak berwenang supplier.
- Kemasan utuh, segel baik, label jelas.
Bahan masuk berstatus **karantina** sampai QC menyatakan released. Lihat [[Pengujian QC Fisika-Kimia]].

## Pemantauan kinerja supplier
- Skor berkala: mutu (persentase lot ditolak, keluhan), ketepatan waktu, kelengkapan dokumen, respons terhadap CAPA.
- Supplier dengan kinerja buruk dikenai SCAR (supplier corrective action request) atau dicabut dari ASL.
- **Notifikasi perubahan**: supplier wajib memberitahu perubahan proses, lokasi produksi, atau sumber bahan; perubahan dinilai melalui change control (dampak stabilitas, halal, regulasi).

## Dual sourcing
Untuk bahan kritis dengan risiko pasokan tinggi, kualifikasi supplier kedua; ekuivalensi dibuktikan dengan uji formula dan stabilitas sebelum dipakai.

Lihat juga [[Sertifikasi Halal Kosmetik via BPJPH]] dan [[Kebijakan Inventori - FEFO, Safety Stock & EOQ]].
`),

  K('Kebijakan Inventori - FEFO, Safety Stock & EOQ', { divisions: ['scm', 'ops', 'fin', 'mfg'], roles: ['inventory', 'ppic', 'warehouse', 'buyer', 'planner', 'logistics'] }, ['inventory', 'fefo', 'safety-stock', 'eoq'], `
# Kebijakan Inventori - FEFO, Safety Stock & EOQ

Inventori kosmetik harus seimbang: cukup untuk melayani permintaan, tetapi tidak berlebihan karena bahan dan produk memiliki masa kedaluwarsa, modal kerja terikat, dan risiko obsolete saat ganti artwork atau formula.

## FEFO (First Expired, First Out)
- Barang dengan tanggal kedaluwarsa (atau retest) paling awal dikeluarkan lebih dulu, bukan berdasarkan tanggal masuk (FIFO).
- Sistem WMS mengalokasikan otomatis berdasarkan ED; picker memverifikasi nomor batch dan ED di label.
- Kebijakan **minimum sisa umur** untuk penerimaan bahan dan pengiriman ke pelanggan (mis. persentase minimum masa simpan tersisa sesuai kesepakatan dengan distributor/marketplace).
- Produk mendekati kedaluwarsa dilaporkan berkala untuk aksi (promo, bundling, retur supplier, pemusnahan terdokumentasi).
Prosedur gudang: [[SOP Gudang - FEFO & Stock Opname]].

## Klasifikasi ABC dan XYZ
- **ABC** berdasarkan nilai pemakaian tahunan: A (sekitar 70 sampai 80 persen nilai, sedikit item) dikontrol ketat, C dikontrol sederhana.
- **XYZ** berdasarkan variabilitas permintaan: X stabil, Z sangat fluktuatif.
- Kombinasi menentukan kebijakan: AX cocok untuk replenishment rutin, AZ butuh kolaborasi forecast intensif, CZ dipertimbangkan make-to-order.

## Safety stock (SS)
Rumus dasar (variabilitas permintaan, lead time tetap):
**SS = Z x sigma_d x akar(LT)**
- Z = faktor service level (mis. sekitar 1,65 untuk 95 persen, 2,33 untuk 99 persen).
- sigma_d = standar deviasi permintaan per periode.
- LT = lead time dalam periode yang sama.

Bila lead time juga bervariasi:
**SS = Z x akar(LT x sigma_d kuadrat + d_rata kuadrat x sigma_LT kuadrat)**

**Reorder point (ROP) = d_rata x LT + SS**

Contoh: permintaan rata-rata 1.000 unit/minggu, sigma_d 200 unit, LT 4 minggu, service level 95 persen. SS = 1,65 x 200 x akar(4) = 660 unit. ROP = 1.000 x 4 + 660 = 4.660 unit.

## EOQ (Economic Order Quantity)
**EOQ = akar(2 x D x S / H)**
- D = permintaan tahunan (unit), S = biaya per pemesanan, H = biaya simpan per unit per tahun (sering dinyatakan sebagai persentase nilai barang).

Contoh: D = 12.000 kg, S = Rp 500.000 per order, H = Rp 2.000 per kg per tahun. EOQ = akar(2 x 12.000 x 500.000 / 2.000) = akar(6.000.000) = sekitar 2.449 kg.

Penyesuaian praktis:
- Bulatkan ke MOQ atau kelipatan kemasan supplier.
- Batasi dengan masa simpan: jumlah order tidak boleh melebihi pemakaian selama sisa umur bahan.
- Pertimbangkan diskon kuantitas dan kapasitas gudang (termasuk area bersuhu terkendali).

## KPI inventori
- Days of inventory/inventory turnover, service level/fill rate, akurasi stok, nilai stok mendekati kedaluwarsa, nilai stok slow moving dan obsolete.

## Tata kelola
- Parameter SS dan ROP ditinjau berkala (mis. per kuartal) atau saat terjadi perubahan permintaan, supplier, atau lead time.
- Penghapusan (write-off) dan pemusnahan stok mengikuti [[Kebijakan Persetujuan]].
Lihat [[Peramalan Permintaan Produk Kosmetik]] dan [[PPIC, MRP, Perencanaan Kapasitas & OEE]].
`),

  K('Peramalan Permintaan Produk Kosmetik', { divisions: ['scm', 'ops', 'data', 'sales', 'mkt', 'ecom'], roles: ['ppic', 'planner', 'demand', 'analyst', 'inventory'] }, ['forecasting', 'demand-planning', 's&op'], `
# Peramalan Permintaan Produk Kosmetik

Permintaan kosmetik dipengaruhi musim belanja (Ramadan dan Lebaran, tanggal kembar kampanye marketplace, akhir tahun), promosi, peluncuran produk, tren media sosial, dan aktivitas KOL. Forecast yang baik menggabungkan data historis dengan input komersial.

## Langkah proses demand planning bulanan
1. **Kumpulkan data**: penjualan aktual per SKU per kanal (sell-in ke distributor, sell-out marketplace/retail bila tersedia), stok di kanal, out-of-stock, kalender promo.
2. **Bersihkan data**: koreksi periode stockout (permintaan tidak terlayani), pisahkan lonjakan promo dari baseline, tandai outlier.
3. **Buat statistical forecast baseline**.
4. **Tambahkan intelijen pasar**: rencana promo, launching, perubahan harga, listing baru, aktivitas pesaing.
5. **Konsensus** dalam rapat demand review (Sales, Marketing, E-commerce, SCM, Finance).
6. **Masuk ke S&OP** untuk diselaraskan dengan kapasitas dan inventori.
7. **Ukur akurasi** dan pelajari penyebab error.

## Metode statistik umum
| Metode | Cocok untuk | Catatan |
|---|---|---|
| Moving average (n periode) | permintaan stabil | lambat merespons tren |
| Weighted moving average | stabil dengan bobot terbaru | bobot ditentukan analis |
| Exponential smoothing sederhana: F(t+1) = alpha x A(t) + (1 - alpha) x F(t) | stabil tanpa tren | alpha 0 sampai 1, besar = responsif |
| Holt (double exponential) | ada tren | parameter level dan tren |
| Holt-Winters | tren dan musiman | butuh minimal sekitar dua siklus musim data |
| Regresi/kausal | dampak harga, promo | butuh data driver |
| Croston | permintaan intermittent (jarang) | untuk SKU slow moving |

**Produk baru**: gunakan analogi SKU serupa (like-for-like), target launching, data pre-order, dan perbarui cepat setelah minggu-minggu awal penjualan.

## Ukuran akurasi
- **Error** = Aktual - Forecast.
- **MAPE** = rata-rata (|Aktual - Forecast| / Aktual) x 100 persen. Kurang andal untuk SKU volume sangat kecil.
- **WMAPE** = jumlah |Aktual - Forecast| / jumlah Aktual x 100 persen; lebih representatif di level portofolio.
- **Bias** = jumlah (Forecast - Aktual) / jumlah Aktual; positif berarti over-forecast konsisten (risiko stok berlebih), negatif berarti under-forecast (risiko stockout).
- **Forecast value added (FVA)**: bandingkan akurasi forecast konsensus dengan baseline statistik untuk melihat apakah input manual benar-benar memperbaiki akurasi.

## Praktik baik
- Forecast pada level yang tepat: agregat (kategori/bulan) lebih akurat, lalu disagregasi ke SKU/minggu.
- Bekukan (freeze) horizon jangka pendek sesuai lead time produksi dan kemasan untuk stabilitas jadwal.
- Dokumentasikan asumsi promo; bandingkan uplift aktual dengan rencana setelah kampanye.
- Pantau sinyal awal: wishlist, add-to-cart, tren pencarian, performa konten viral.
- Gunakan forecast untuk safety stock, lihat [[Kebijakan Inventori - FEFO, Safety Stock & EOQ]].

## Peran AI agent
Agen boleh menyiapkan baseline statistik dan analisis error, namun angka konsensus dan perubahan besar tetap diputuskan dalam forum S&OP sesuai [[Kebijakan Persetujuan]]. Lihat [[PPIC, MRP, Perencanaan Kapasitas & OEE]].
`),

  K('Operasi Gudang & Stock Opname', { divisions: ['scm', 'ops', 'fin', 'qa'], roles: ['warehouse', 'inventory', 'logistics', 'gudang', 'ppic'] }, ['warehouse', 'stock-opname', 'inventory', 'cpkb'], `
# Operasi Gudang & Stock Opname

Gudang Ray Beauty menyimpan bahan baku, bahan kemas, produk antara, dan produk jadi. Gudang adalah bagian dari sistem CPKB: kondisi penyimpanan, status mutu, dan ketertelusuran harus terjaga. Prosedur internal: [[SOP Gudang - FEFO & Stock Opname]].

## Proses inti
1. **Penerimaan (inbound)**
   - Cocokkan surat jalan dengan PO: item, jumlah, supplier.
   - Inspeksi fisik: kemasan rusak, segel, kebersihan, label supplier, nomor lot, ED.
   - Terima COA (bahan baku) dan serahkan ke QC.
   - Beri label karantina dan tempatkan di area karantina; input ke WMS dengan nomor lot.
   - Kejanggalan dicatat di berita acara dan dilaporkan ke Procurement dan QA.
2. **Penyimpanan (putaway)**
   - Lokasi berkode (zona-rak-tingkat-bin); barang tidak diletakkan langsung di lantai (gunakan palet), jarak dari dinding untuk pembersihan dan pengendalian hama.
   - Pisahkan: bahan mudah terbakar (pelarut, etanol, pewangi tertentu) di area khusus; bahan berbau kuat; bahan suhu terkendali; area produk ditolak dan retur terkunci.
   - Pantau suhu dan kelembapan dengan data logger terkalibrasi; lakukan temperature mapping area gudang.
3. **Pengeluaran (picking dan issuing)**
   - Hanya material berstatus released yang boleh dikeluarkan.
   - Ikuti FEFO, lihat [[Kebijakan Inventori - FEFO, Safety Stock & EOQ]].
   - Penimbangan bahan untuk produksi dilakukan di ruang timbang dengan verifikasi ganda.
4. **Pengiriman (outbound)**
   - Verifikasi pesanan, nomor batch dicatat per pengiriman untuk ketertelusuran recall.
   - Kemasan pengiriman melindungi produk dari panas dan benturan.
5. **Retur**: barang retur dikarantina dan dievaluasi QA sebelum diputuskan (stok kembali, rework, atau pemusnahan).

## Stock opname
**Jenis:**
- **Opname periodik/tahunan**: seluruh stok dihitung, biasanya dengan aktivitas gudang dibekukan.
- **Cycle count**: sebagian item dihitung bergilir; frekuensi berdasarkan ABC (A lebih sering, mis. bulanan; C lebih jarang).

**Langkah opname:**
1. Perencanaan: jadwal, tim (penghitung dan pemeriksa terpisah dari pemegang stok), cut-off dokumen penerimaan dan pengeluaran.
2. Persiapan: rapikan lokasi, pastikan semua transaksi sudah diinput, siapkan kartu hitung atau perangkat pemindai.
3. **Penghitungan buta** (blind count): penghitung tidak melihat angka sistem.
4. Hitung ulang item dengan selisih di atas toleransi oleh tim berbeda.
5. Rekonsiliasi: bandingkan hasil fisik dengan sistem per item, lot, dan lokasi.
6. Investigasi selisih: transaksi belum diinput, salah lokasi, salah satuan, salah lot, kerusakan, kehilangan.
7. Penyesuaian stok disetujui sesuai [[Kebijakan Persetujuan]] dan dilaporkan ke Finance.
8. Laporan dan CAPA untuk penyebab berulang.

**Akurasi stok (record accuracy)** = jumlah item yang hasil hitungnya sesuai (dalam toleransi) / jumlah item dihitung x 100 persen. Ukur juga selisih nilai absolut.

## KPI gudang
- Akurasi stok, dock-to-stock time, order picking accuracy, OTIF pengiriman, utilisasi lokasi, nilai stok rusak/kedaluwarsa, kepatuhan suhu.

## Keselamatan
Forklift dan hand pallet hanya dioperasikan personel terlatih, batas tumpukan palet, APD, dan jalur pejalan kaki. Lihat [[K3 di Pabrik Kosmetik]] dan [[Logistik, Distribusi & Manajemen 3PL]].
`),

  K('Logistik, Distribusi & Manajemen 3PL', { divisions: ['scm', 'ops', 'ecom', 'sales', 'fin'], roles: ['logistics', 'warehouse', 'distribution', 'inventory', 'buyer'] }, ['logistics', '3pl', 'distribution', 'fulfillment'], `
# Logistik, Distribusi & Manajemen 3PL

Ray Beauty menjual melalui distributor, retail modern, toko kecantikan, dan marketplace. Logistik harus menjaga mutu produk (suhu, benturan), ketertelusuran batch, dan biaya per unit yang efisien di negara kepulauan.

## Jaringan distribusi
- **Pabrik dan gudang pusat** -> gudang regional/hub atau distributor -> toko/pelanggan.
- **Fulfillment e-commerce**: gudang sendiri, gudang 3PL fulfillment, atau gudang yang dikelola marketplace.
- Pertimbangkan penempatan stok dekat konsentrasi pembeli untuk memperpendek waktu kirim dan menurunkan ongkir.

## Pemilihan dan kualifikasi 3PL
Kriteria:
1. Kemampuan penyimpanan sesuai ketentuan produk (suhu ruang terkendali, bebas lembap dan hama, area terpisah produk retur/rusak).
2. Sistem WMS dengan pelacakan lot dan ED, dukungan FEFO, integrasi dengan ERP/marketplace.
3. Kapasitas puncak kampanye (lonjakan pesanan saat event marketplace).
4. Jangkauan jaringan dan SLA waktu kirim.
5. Struktur biaya: inbound, storage per palet/bin, pick and pack per order, packaging, value added services (bundling, sampling), pengiriman.
6. Kepatuhan: legalitas, asuransi, keamanan, kerahasiaan data pelanggan.
7. Audit lapangan oleh SCM dan QA sebelum kontrak, lalu berkala.

## Kontrak dan SLA
Butir penting:
- KPI: akurasi inventori, akurasi pick, ketepatan waktu dispatch (mis. pesanan sebelum jam cut-off dikirim hari yang sama), tingkat kerusakan, waktu respons retur.
- Tanggung jawab kehilangan dan kerusakan, batas ganti rugi.
- Kewajiban mengikuti FEFO, karantina retur, dan pelaporan suhu.
- Hak audit, kerahasiaan data, prosedur saat recall.
- Kontrak ditinjau Legal dan disetujui sesuai [[Kebijakan Persetujuan]].

## Pengiriman dan transportasi
- Moda: darat (truk, untuk Jawa dan sekitarnya), laut (antar pulau, biaya rendah tetapi lebih lama dan risiko panas), udara (cepat, mahal, batasan barang berbahaya).
- **Barang berbahaya**: produk ber-etanol tinggi, aerosol, atau parfum dapat dikategorikan barang berbahaya untuk transportasi udara; cek SDS dan ketentuan maskapai/ekspedisi.
- Lindungi dari panas: hindari penyimpanan lama di kendaraan tertutup atau dermaga terbuka; produk sunscreen dan emulsi sensitif terhadap suhu tinggi.
- Packing e-commerce: bubble wrap, segel anti bocor untuk botol cair, uji drop untuk desain paket.

## Ketertelusuran
- Catat nomor batch per pengiriman ke distributor dan per order (minimal per gelombang pengiriman) agar recall dapat dilakukan cepat.
- Lakukan mock recall berkala bersama 3PL, lihat [[Penanganan Efek Samping & Kosmetovigilans]].

## KPI logistik
- OTIF (On Time In Full), lead time order-to-delivery, biaya logistik per unit atau persen penjualan, tingkat kerusakan, tingkat retur karena kesalahan kirim, akurasi stok di 3PL (verifikasi dengan stock opname bersama).

## Rutin operasional mingguan
1. Review stok per lokasi dan ED, rencana transfer antar gudang.
2. Review KPI 3PL dan eskalasi pelanggaran SLA.
3. Rencana kapasitas untuk kampanye mendatang bersama E-commerce.
4. Rekonsiliasi tagihan 3PL dengan data aktivitas.
Lihat [[Operasi Gudang & Stock Opname]] dan [[SOP Gudang - FEFO & Stock Opname]].
`),

  K('K3 di Pabrik Kosmetik', { divisions: ['mfg', 'scm', 'qa', 'rnd', 'hr', 'ops'], roles: ['hse', 'k3', 'production', 'warehouse', 'lab', 'safety'] }, ['hse', 'k3', 'safety', 'manufacturing'], `
# K3 di Pabrik Kosmetik

Keselamatan dan Kesehatan Kerja (K3) melindungi karyawan, fasilitas, dan lingkungan. Pabrik kosmetik menangani bahan kimia, pelarut mudah terbakar, peralatan panas dan bertekanan, serta mesin berputar. Kewajiban hukum K3 di Indonesia (mis. SMK3, ahli K3, P2K3) diatur peraturan ketenagakerjaan; **verifikasi ke peraturan terbaru** untuk ketentuan yang berlaku bagi pabrik.

## Identifikasi bahaya utama
| Area | Bahaya | Pengendalian |
|---|---|---|
| Gudang bahan kimia | kebakaran (etanol, pewangi, pelarut), tumpahan, reaksi bahan tidak kompatibel | ruang berventilasi, grounding/bonding, pemisahan asam-basa-oksidator, spill kit, APAR |
| Ruang timbang | debu bubuk (pigmen, mineral, polimer), inhalasi | local exhaust ventilation, masker yang sesuai |
| Mixing | panas (pemanasan fase sekitar 70 sampai 80 derajat C), uap, pengaduk berputar, homogenizer | interlock, prosedur LOTO, sarung tangan tahan panas |
| Filling dan packing | titik jepit mesin, kebisingan, gerakan berulang | pelindung mesin, pelindung telinga, rotasi kerja, ergonomi |
| Boiler, kompresor, bejana tekan | ledakan, luka bakar | inspeksi dan sertifikasi berkala, operator berlisensi |
| Lab QC/R&D | asam, basa, pelarut HPLC, mikroba | lemari asam, biosafety cabinet, APD, limbah terpisah |
| Gudang | forklift, tumpukan roboh | operator berlisensi, batas tinggi tumpukan, jalur pejalan kaki |

## Hierarki pengendalian risiko
1. Eliminasi (hilangkan bahaya).
2. Substitusi (bahan lebih aman, mis. pelarut kurang volatil).
3. Rekayasa teknik (ventilasi, pelindung mesin, interlock).
4. Administratif (SOP, izin kerja, pelatihan, rambu).
5. APD (kacamata, sarung tangan nitril, jas lab, safety shoes, masker, pelindung telinga) sebagai lapisan terakhir.

## HIRADC/JSA
- Lakukan identifikasi bahaya, penilaian risiko, dan pengendalian untuk setiap aktivitas rutin dan non-rutin.
- Risiko = kemungkinan x keparahan; risiko tinggi tidak boleh dikerjakan sebelum ada pengendalian tambahan.
- Tinjau ulang saat ada mesin, bahan, atau proses baru.

## Izin kerja (permit to work)
Wajib untuk: pekerjaan panas (las, gerinda) di area dengan bahan mudah terbakar, masuk ruang terbatas (tangki), bekerja di ketinggian, pekerjaan listrik, dan perbaikan mesin dengan **LOTO (Lock Out Tag Out)**.

## Bahan kimia
- SDS tersedia di lokasi penggunaan dalam bahasa yang dimengerti pekerja.
- Label kemasan sesuai sistem GHS, termasuk wadah pindahan.
- Inventaris bahan berbahaya dan batas jumlah penyimpanan di area produksi.

## Tanggap darurat
- Rencana tanggap darurat: kebakaran, tumpahan bahan kimia, kebocoran gas, gempa, banjir.
- APAR sesuai kelas kebakaran, hidran, alarm, jalur evakuasi dan titik kumpul, eyewash dan safety shower dekat area bahan korosif.
- Tim tanggap darurat dan petugas P3K terlatih; simulasi minimal berkala.

## Limbah dan lingkungan
- Pisahkan limbah B3 (sisa bahan kimia, pelarut, kemasan terkontaminasi, limbah lab) dan serahkan ke pengelola berizin dengan manifest.
- Air limbah dari pencucian alat diolah di IPAL sesuai baku mutu yang berlaku.

## Indikator K3
- Leading: jumlah inspeksi, pelatihan, near-miss yang dilaporkan, safety observation.
- Lagging: LTI (lost time injury), frekuensi dan keparahan kecelakaan.
Budaya: dorong pelaporan near-miss tanpa menyalahkan. Lihat [[Prinsip CPKB - Personel, Bangunan & Dokumentasi]] dan [[Operasi Gudang & Stock Opname]].
`),

  K('Kemasan Berkelanjutan', { divisions: ['scm', 'rnd', 'design', 'mkt', 'reg'], roles: ['packaging', 'buyer', 'designer', 'sustainability', 'r&d', 'claims'] }, ['sustainability', 'packaging', 'esg'], `
# Kemasan Berkelanjutan

Kemasan adalah sumber dampak lingkungan terbesar yang paling terlihat konsumen pada produk kosmetik. Strategi yang baik menurunkan dampak tanpa mengorbankan perlindungan produk, keamanan, dan kepatuhan regulasi. Indonesia juga memiliki ketentuan tentang pengurangan sampah oleh produsen (peta jalan pengurangan sampah); **verifikasi ke peraturan terbaru** untuk kewajiban yang berlaku.

## Kerangka prioritas (urutan dampak)
1. **Reduce**: kurangi material (lightweighting, hapus kemasan sekunder yang tidak perlu, ukuran box sesuai isi).
2. **Reuse/Refill**: kemasan isi ulang, refill pouch, wadah tahan lama.
3. **Recycle**: desain agar mudah didaur ulang di infrastruktur lokal.
4. **Recycled content**: gunakan PCR (post-consumer recycled) resin.
5. **Renewable/bio-based**: plastik nabati atau kertas bersertifikat hutan lestari, hanya bila manfaat lingkungannya jelas.

## Prinsip design for recycling
- **Mono-material** (mis. seluruh tube dan tutup dari PE, atau botol PP dengan tutup PP) lebih mudah didaur ulang dibanding multi-material.
- Hindari warna gelap pekat/karbon hitam yang menyulitkan sortasi optik pada sebagian fasilitas; pilih warna terang atau transparan.
- Label dan sleeve yang mudah dilepas atau kompatibel dengan proses daur ulang.
- Minimalkan komponen logam (pegas pompa) yang sulit dipisah; pertimbangkan pompa all-plastic.
- Hindari metalisasi dan laminasi berlapis pada box kertas bila tidak diperlukan.
- Pertimbangkan infrastruktur Indonesia: PET botol dan HDPE relatif punya pasar daur ulang; kemasan sachet multilayer sulit didaur ulang.

## Risiko teknis yang harus diuji
- **PCR resin**: variasi warna, bau, kemungkinan kontaminan, sifat mekanik; minta dokumen kesesuaian kontak dan uji kompatibilitas produk.
- **Lightweighting**: risiko penyok, kebocoran, permeabilitas oksigen dan air meningkat.
- **Refill**: risiko kontaminasi mikroba pada kemasan yang dipakai ulang; berikan instruksi kebersihan dan nilai kebutuhan sistem pengawet.
- Semua perubahan melalui [[Uji Stabilitas & Kompatibilitas Kemasan]] dan change control.

## Mengukur dampak
- Berat kemasan per unit dan per mL produk.
- Persentase kemasan yang secara desain dapat didaur ulang dan persentase PCR.
- Life Cycle Assessment (LCA) sederhana untuk membandingkan opsi (mis. kaca vs plastik PCR), memperhitungkan berat transportasi.
- Data dari supplier: sertifikat PCR, sertifikat hutan lestari untuk kertas.

## Klaim lingkungan (hindari greenwashing)
- Klaim harus spesifik, benar, dan dapat dibuktikan: "botol mengandung 50% plastik daur ulang" lebih baik daripada "ramah lingkungan".
- Bedakan "dapat didaur ulang" (secara teknis) dengan "didaur ulang" (benar-benar terjadi).
- Hindari klaim absolut seperti "100% eco" atau "nol dampak".
- Klaim lingkungan diperlakukan seperti klaim produk: bukti disimpan, direview Regulatory sesuai [[Pedoman Klaim Kosmetik]] dan [[Klaim Kosmetik - Boleh & Tidak Boleh]].

## Inisiatif praktis Ray Beauty
1. Audit portofolio kemasan: material, berat, kemampuan daur ulang per SKU.
2. Prioritaskan SKU volume tertinggi untuk redesign mono-material atau PCR.
3. Pilot refill pouch untuk produk volume besar (mis. pembersih).
4. Program pengembalian kemasan bekerja sama dengan bank sampah atau mitra pengelola, dengan pencatatan jumlah terkumpul.
5. Libatkan supplier kemasan dalam target bersama dan laporkan progres ke manajemen.
Lihat [[Produk Ray Beauty]] dan [[Kualifikasi Supplier, COA & Spesifikasi Bahan Baku]].
`),
];
