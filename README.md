# CubingCoach

Aplikasi web untuk menilai performa satu kali solve rubik 3x3 dengan **logika fuzzy metode Mamdani**.
Dibuat untuk Tugas UAS mata kuliah Kecerdasan Buatan.

Data solve diambil otomatis dari **smart cube** (QiYi, GAN, GoCube, Giiker) lewat Bluetooth, atau dimasukkan
secara manual. Hasilnya berupa skor 0–100, kategori (pemula / menengah / mahir), dan rekomendasi latihan.
Seluruh perhitungan fuzzy ditulis sendiri tanpa library fuzzy.

---

## Daftar isi

- [Halaman](#halaman)
- [Menjalankan](#menjalankan)
- [Memakai smart cube](#memakai-smart-cube)
- [Cara penilaian](#cara-penilaian)
- [Struktur proyek](#struktur-proyek)
- [Pengujian](#pengujian)
- [Mengubah parameter fuzzy](#mengubah-parameter-fuzzy)
- [Pemecahan masalah](#pemecahan-masalah)
- [Yang masih harus dilengkapi](#yang-masih-harus-dilengkapi)

---

## Halaman

| Halaman | Isi |
|---|---|
| **Beranda** — `index.html` | Solve dengan smart cube, input manual, hasil penilaian, dan riwayat. Sengaja tanpa istilah teknis fuzzy. |
| **Detail Perhitungan** — `perhitungan.html` | Tujuh langkah Mamdani dengan angka asli. Sumber data: solve terakhir, riwayat, atau slider "coba sendiri". |
| **Cara Kerja** — `metode.html` | Penjelasan teori: alasan memakai fuzzy, data smart cube, 5 tahap Mamdani, variabel & himpunan, matriks 27 rule, aturan rekomendasi, contoh manual, letak kode, pemenuhan ketentuan tugas, referensi, tim. |

Link **"Lihat cara skor ini dihitung →"** di kartu hasil langsung membuka Detail Perhitungan dengan data solve tersebut.

---

## Menjalankan

**Prasyarat:** Node.js **20.19 atau lebih baru** (cek dengan `node -v`) dan browser **Chrome atau Edge**.

```bash
npm install
npm run dev
```

Buka alamat yang muncul (biasanya `http://localhost:5173`).

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build statis ke folder `dist/` (3 halaman HTML) |
| `npm run preview` | Menjalankan hasil build secara lokal |
| `npm test` | Menjalankan semua tes Vitest |

Catatan:

- Web Bluetooth hanya ada di **Chrome/Edge** (desktop dan Android), tidak ada di Firefox maupun Safari/iOS.
- Web Bluetooth butuh *secure context*: `localhost` atau HTTPS. Jangan membuka file HTML langsung lewat `file://`.
- **Input manual** tetap berfungsi penuh tanpa Bluetooth dan tanpa internet.
- Jika di-hosting, gunakan HTTPS agar fitur Bluetooth jalan.

---

## Memakai smart cube

1. Klik tombol koneksi sesuai merek kubus, lalu pilih kubus di jendela Bluetooth:

   | Tombol | Kubus | Library |
   |---|---|---|
   | **Hubungkan kubus** | QiYi, GAN 356i generasi awal, GoCube, Giiker, Heykube | `cubing` |
   | **Hubungkan GAN** | GAN model baru (Gen2/Gen3/Gen4): i Carry, i Carry S, i Carry 2, i 3, GAN12 ui, GAN14 ui, Monster Go 3Ai, MoYu AI 2023 | `gan-web-bluetooth` |

   Kubus GAN butuh **MAC address** untuk membuka enkripsi datanya. Program mencoba membacanya otomatis; jika gagal,
   program meminta MAC address diisi sekali (lihat di aplikasi GAN atau daftar perangkat Bluetooth di HP), lalu
   menyimpannya di browser.
2. Klik **Buat acakan**. Kotak pemandu menampilkan **gerakan berikutnya** (besar, dengan panah arah putaran).
   Setiap kali kubus diputar, langkah berikutnya muncul otomatis. Jika salah putar, pemandu meminta
   gerakan itu dibatalkan dulu.
3. Setelah acakan selesai, timer **langsung siap** dan mulai pada putaran pertama. Timer **berhenti otomatis**
   saat kubus solved, lalu muncul layar perayaan (waktu, gerakan, TPS, skor, konfeti).
   Tombol **Mulai solve** / **Selesai** tetap bisa dipakai secara manual.

**Gambar 3D mengikuti posisi kubus.** Program membaca posisi stiker dari sensor kubus (QiYi dan GAN mengirimnya),
lalu gambar 3D dan pelacakan program disamakan otomatis, jadi tidak ada tombol yang wajib ditekan.
Tombol **Gambar salah? Reset** hanya untuk koreksi: tekan saat kubus di tangan sedang solved tetapi gambar
3D menunjukkan posisi lain (catatan posisi di dalam kubus melenceng). Timer berhenti jika sensor kubus
**atau** pelacakan program menyatakan solved.

**Statistik yang diambil dari solve.** Waktu dihitung dari timestamp tiap putaran (memakai jam kubus jika tersedia):

```text
waktu   = (t_terakhir − t_pertama) / 1000                  detik
TPS     = gerakan / waktu                                   putaran per detik
jeda    = Σ selisih antar-putaran > 500 ms ÷ total waktu × 100   persen
```

---

## Cara penilaian

| Tahap | Keterangan |
|---|---|
| **Input** | TPS (0–10), jumlah gerakan (20–150), rasio jeda (0–100%) |
| **1. Fuzzifikasi** | Fungsi keanggotaan trapesium, 3 himpunan per variabel |
| **2. Inferensi** | 27 rule, operator DAN = MIN: `α = min(μ_TPS, μ_Gerakan, μ_Jeda)` |
| **3. Komposisi** | α terbesar untuk tiap himpunan output (MAX) |
| **4. Agregasi** | Himpunan output dipotong setinggi α, lalu digabung (MAX) |
| **5. Defuzzifikasi** | Centroid diskrit, langkah 0,5: `z* = Σ(z·μ(z)) / Σμ(z)` |
| **Output** | Skor 0–100, kategori dengan μ(z*) terbesar, rekomendasi latihan |

Konsekuen tiap rule disusun dengan sistem poin kualitas: tiap himpunan bernilai 0 (buruk), 1 (sedang), atau
2 (baik). Total poin 0–2 → pemula, 3–4 → menengah, 5–6 → mahir.

**Contoh** (dipakai juga di laporan): TPS 3,5; gerakan 70; jeda 20%.

- μ TPS sedang = 1, μ gerakan normal = 1, μ jeda sedikit = 0,333, μ jeda sedang = 0,667
- Rule aktif: R14 (α = 0,667 → menengah) dan R15 (α = 0,333 → menengah)
- α menengah = max(0,667; 0,333) = 0,667
- `z* = 2444,167 / 48,883 = 50,00` → kategori **menengah**

---

## Struktur proyek

```text
├── index.html              Beranda
├── perhitungan.html        Detail Perhitungan
├── metode.html             Cara Kerja
├── vite.config.js          Konfigurasi Vite (multi-page) + Vitest
├── public/                 Favicon
├── src/
│   ├── main.js             Titik masuk Beranda
│   ├── perhitungan.js      Titik masuk Detail Perhitungan
│   ├── metode.js           Titik masuk Cara Kerja
│   ├── style.css           Tampilan (terang & gelap)
│   ├── fuzzy/              ← INTI LOGIKA FUZZY (tanpa DOM, bisa dites terpisah)
│   │   ├── config.js         semua angka: himpunan, rule, ambang, langkah centroid
│   │   ├── membership.js     trap(), clamp(), fuzzifikasi()
│   │   ├── mamdani.js        infer(): seluruh tahap Mamdani
│   │   └── recommendation.js aturan & teks rekomendasi latihan
│   ├── cube/
│   │   ├── smartcube.js      koneksi Bluetooth (cubing.js) & deteksi solved
│   │   ├── solveTracker.js   state machine solve & hitungStatistik()
│   │   └── scramble.js       generator acakan 20 gerakan
│   ├── ui/                 Grafik Canvas & renderer tiap bagian halaman
│   ├── content/            Data referensi dan tim (halaman Cara Kerja)
│   └── storage/history.js  Riwayat di localStorage
└── tests/                  Tes Vitest
```

Data di browser disimpan di `localStorage` dengan key `cubingCoach.history` (maksimal 50 solve) dan
`cubingCoach.lastInput` (penilaian terakhir).

---

## Pengujian

```bash
npm test
```

Tes mencakup fungsi keanggotaan, hasil `infer()` untuk beberapa kasus acuan, kesesuaian rule dengan sistem poin,
aturan rekomendasi, perhitungan statistik solve, generator acakan, dan deteksi solved otomatis dengan kubus tiruan.

---

## Mengubah parameter fuzzy

Semua angka ada di [`src/fuzzy/config.js`](src/fuzzy/config.js). Setelah diubah, grafik, tabel, dan hasil di
ketiga halaman ikut berubah otomatis. Yang perlu diperbarui manual:

- **Contoh perhitungan manual** di `metode.html` (Bagian 8) dan di README ini.
- **Nilai harapan tes** di `tests/mamdani.test.js`.
- Tes *"konsekuen tiap rule sesuai sistem poin"* akan gagal jika rule tidak lagi cocok dengan poin di config.

> **Catatan kalibrasi.** Angka himpunan saat ini masih nilai awal, belum dari pakar. Khususnya rasio jeda:
> menurut Boyce & Storm (2022), solver dengan rata-rata 10 detik masih menghabiskan ±33% waktunya untuk jeda,
> sedangkan himpunan "sedikit" saat ini 0–25%. Definisi jeda juga berbeda, karena program hanya menghitung
> jeda di atas 0,5 detik.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| `npm run dev` gagal: `does not provide an export named 'styleText'` | Node.js terlalu lama (terminal Laragon memakai Node 18). Jalankan dari terminal VS Code, atau ganti versi Node di Laragon ke 20.19+. |
| Vitest gagal: `Cannot read properties of undefined (reading 'config')` | Di Windows, jalankan dari path berhuruf drive kapital: `cd C:\laragon\www\cubingcoach` (bukan `c:\`). |
| Tombol **Hubungkan kubus** nonaktif | Browser tidak mendukung Web Bluetooth, atau halaman tidak dibuka lewat `localhost`/HTTPS. |
| Timer tidak berhenti sendiri | Lihat pesan status setelah terhubung. Jika diminta, tekan **Kubus sudah solved** sebelum mulai solve. |

---

## Yang masih harus dilengkapi

- [ ] [`src/content/tim.js`](src/content/tim.js): nama, NIM, dan peran keempat anggota.
- [ ] [`src/content/referensi.js`](src/content/referensi.js): item bertanda `todo: true`
      (data jurnal Mamdani sejenis dan data wawancara pakar).
