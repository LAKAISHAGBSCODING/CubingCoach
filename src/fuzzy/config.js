// =====================================================================
// KONFIGURASI FUZZY — semua angka parameter himpunan & rule ada di sini.
// Ubah angka di file ini → halaman utama, halaman Cara Kerja (tabel,
// grafik, simulasi), dan hasil perhitungan ikut berubah.
// Format himpunan trapesium: [a, b, c, d]
//   a = b  → bahu kiri  (nilai ≤ a bernilai 1)
//   c = d  → bahu kanan (nilai ≥ d bernilai 1)
//
// CATATAN KALIBRASI: angka di bawah masih nilai awal (belum dari pakar).
// Jika diubah, hitung ulang contoh manual di halaman Cara Kerja dan nilai
// harapan di tests/mamdani.test.js.
// =====================================================================

// Warna konsisten di semua grafik: merah = buruk, kuning = sedang, hijau = baik
export const WARNA = {
  buruk: "#e5484d",
  sedang: "#e2a300",
  baik: "#2f9e64",
};

// ---------- Variabel input ----------
// poin = poin kualitas himpunan, dipakai untuk menjelaskan penyusunan rule
// dasar = alasan penentuan batas himpunan (ditampilkan di halaman Cara Kerja)
export const VARIABEL_INPUT = {
  tps: {
    label: "TPS",
    keterangan: "putaran per detik",
    satuan: "putaran/detik",
    semesta: [0, 10],
    himpunan: {
      lambat: { param: [0, 0, 1.5, 3], warna: WARNA.buruk, poin: 0 },
      sedang: { param: [1.5, 3, 4, 5.5], warna: WARNA.sedang, poin: 1 },
      cepat: { param: [4, 5.5, 10, 10], warna: WARNA.baik, poin: 2 },
    },
    dasar:
      "Turn speed berkorelasi kuat dengan waktu solve (Boyce & Storm, 2022). Batas himpunan ditentukan dari wawancara pakar dan data solve kelompok.",
  },
  gerakan: {
    label: "Gerakan",
    keterangan: "jumlah gerakan",
    satuan: "gerakan",
    semesta: [20, 150],
    himpunan: {
      efisien: { param: [20, 20, 50, 65], warna: WARNA.baik, poin: 2 },
      normal: { param: [50, 65, 75, 90], warna: WARNA.sedang, poin: 1 },
      boros: { param: [75, 90, 150, 150], warna: WARNA.buruk, poin: 0 },
    },
    dasar: "Metode CFOP rata-rata ±54 gerakan, metode pemula ±135 gerakan (Boyce & Storm, 2022).",
  },
  jeda: {
    label: "Jeda",
    keterangan: "rasio jeda (%)",
    satuan: "%",
    semesta: [0, 100],
    himpunan: {
      sedikit: { param: [0, 0, 10, 25], warna: WARNA.baik, poin: 2 },
      sedang: { param: [10, 25, 35, 50], warna: WARNA.sedang, poin: 1 },
      banyak: { param: [35, 50, 100, 100], warna: WARNA.buruk, poin: 0 },
    },
    dasar:
      "Fraksi waktu jeda berkorelasi kuat dengan waktu solve (Boyce & Storm, 2022). Batas himpunan ditentukan dari wawancara pakar dan data solve kelompok.",
  },
};

// ---------- Variabel output ----------
export const VARIABEL_OUTPUT = {
  skor: {
    label: "Skor",
    keterangan: "skor performa",
    satuan: "poin (0–100)",
    semesta: [0, 100],
    himpunan: {
      pemula: { param: [0, 0, 25, 45], warna: WARNA.buruk },
      menengah: { param: [25, 45, 55, 75], warna: WARNA.sedang },
      mahir: { param: [55, 75, 100, 100], warna: WARNA.baik },
    },
    dasar: "Skala 0–100 dibagi tiga kategori linguistik, disepakati bersama pakar.",
  },
};

// Pembagian total poin rule → himpunan output (penjelasan penyusunan rule)
export const PEMETAAN_POIN = [
  { min: 0, max: 2, skor: "pemula" },
  { min: 3, max: 4, skor: "menengah" },
  { min: 5, max: 6, skor: "mahir" },
];

// Langkah sampel z untuk defuzzifikasi centroid diskrit
export const LANGKAH_CENTROID = 0.5;

// Batas μ agar sebuah kondisi rekomendasi dianggap terpenuhi
export const AMBANG_REKOMENDASI = 0.5;

// Batas selisih waktu antar-gerakan yang dihitung sebagai "jeda" (ms)
export const BATAS_JEDA_MS = 500;

// ---------- Basis aturan (27 rule) ----------
// Format: [TPS, Gerakan, Jeda, Skor]
// Dasar penyusunan: total poin kualitas ketiga premis (lihat field "poin" di atas),
// lalu dipetakan dengan PEMETAAN_POIN: 0–2 → pemula, 3–4 → menengah, 5–6 → mahir.
const DAFTAR_RULE = [
  ["lambat", "boros", "banyak", "pemula"], // R1
  ["lambat", "boros", "sedang", "pemula"], // R2
  ["lambat", "boros", "sedikit", "pemula"], // R3
  ["lambat", "normal", "banyak", "pemula"], // R4
  ["lambat", "normal", "sedang", "pemula"], // R5
  ["lambat", "normal", "sedikit", "menengah"], // R6
  ["lambat", "efisien", "banyak", "pemula"], // R7
  ["lambat", "efisien", "sedang", "menengah"], // R8
  ["lambat", "efisien", "sedikit", "menengah"], // R9
  ["sedang", "boros", "banyak", "pemula"], // R10
  ["sedang", "boros", "sedang", "pemula"], // R11
  ["sedang", "boros", "sedikit", "menengah"], // R12
  ["sedang", "normal", "banyak", "pemula"], // R13
  ["sedang", "normal", "sedang", "menengah"], // R14
  ["sedang", "normal", "sedikit", "menengah"], // R15
  ["sedang", "efisien", "banyak", "menengah"], // R16
  ["sedang", "efisien", "sedang", "menengah"], // R17
  ["sedang", "efisien", "sedikit", "mahir"], // R18
  ["cepat", "boros", "banyak", "pemula"], // R19
  ["cepat", "boros", "sedang", "menengah"], // R20
  ["cepat", "boros", "sedikit", "menengah"], // R21
  ["cepat", "normal", "banyak", "menengah"], // R22
  ["cepat", "normal", "sedang", "menengah"], // R23
  ["cepat", "normal", "sedikit", "mahir"], // R24
  ["cepat", "efisien", "banyak", "menengah"], // R25
  ["cepat", "efisien", "sedang", "mahir"], // R26
  ["cepat", "efisien", "sedikit", "mahir"], // R27
];

// Ubah array menjadi objek rule bernomor: { no, tps, gerakan, jeda, skor }
export const RULES = DAFTAR_RULE.map(([tps, gerakan, jeda, skor], i) => ({
  no: i + 1,
  tps,
  gerakan,
  jeda,
  skor,
}));