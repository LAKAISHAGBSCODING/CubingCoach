// Daftar referensi halaman Cara Kerja (format APA).
// Field: penulis, tahun, judul, terbitan (dicetak miring), detail, url, catatan, todo.
// Item dengan todo: true masih placeholder — WAJIB dilengkapi kelompok, jangan dikarang.
export const REFERENSI = [
  {
    grup: "A. Dasar metode",
    item: [
      {
        penulis: "Zadeh, L. A.",
        tahun: "1965",
        judul: "Fuzzy sets",
        terbitan: "Information and Control, 8",
        detail: "(3), 338–353",
      },
      {
        penulis: "Mamdani, E. H., & Assilian, S.",
        tahun: "1975",
        judul: "An experiment in linguistic synthesis with a fuzzy logic controller",
        terbitan: "International Journal of Man-Machine Studies, 7",
        detail: "(1), 1–13",
      },
    ],
  },
  {
    grup: "B. Dasar domain (speedcubing)",
    item: [
      {
        penulis: "Boyce, K., & Storm, C.",
        tahun: "2022",
        judul: "Rubik's cube: What separates the fastest solvers from the rest?",
        terbitan: "Journal of Emerging Investigators",
        url: "https://emerginginvestigators.org/articles/21-189",
        catatan:
          "Temuan yang dipakai: turn speed (r = −0,85), fraksi waktu jeda (r = 0,72), dan jumlah gerakan berkorelasi dengan waktu solve; CFOP ±54 gerakan, metode pemula ±135 gerakan.",
      },
    ],
  },
  {
    grup: "C. Penerapan Mamdani sejenis",
    item: [
      {
        penulis: "[Penulis]",
        tahun: "[tahun]",
        judul: "Sistem Penunjang Keputusan dengan Metode Fuzzy Logic Mamdani dalam Penilaian Kinerja Pegawai",
        terbitan: "[nama jurnal]",
        url: "https://zenodo.org/record/5777248",
        todo: true,
        catatan: "TODO: lengkapi penulis, tahun, dan nama jurnal dari PDF-nya.",
      },
    ],
  },
  {
    grup: "D. Sumber kepakaran (wawancara)",
    item: [
      {
        teksBebas:
          'Wawancara dengan [Nama pakar], [pengalaman, mis. "cuber WCA sejak 20xx, rata-rata 3x3 xx detik"], [tanggal].',
        todo: true,
        catatan: "TODO: lengkapi. Digunakan untuk menentukan batas himpunan dan memvalidasi basis aturan.",
      },
    ],
  },
  {
    grup: "E. Pustaka teknis",
    item: [
      {
        teksBebas: "cubing.js — koneksi Bluetooth smart cube dan tampilan 3D.",
        url: "https://js.cubing.net/cubing/",
      },
    ],
  },
];
