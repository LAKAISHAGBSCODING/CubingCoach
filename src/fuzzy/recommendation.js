import { AMBANG_REKOMENDASI } from "./config.js";

// Aturan rekomendasi latihan (blueprint bagian 5.7), disimpan sebagai data
// supaya halaman Cara Kerja bisa menampilkan tabel yang sama persis.
// Dalam satu "grup", hanya aturan pertama yang terpenuhi yang dipakai
// (setara dengan if … else if …).
export const ATURAN_REKOMENDASI = [
  { grup: "kecepatan", variabel: "tps", himpunan: "lambat", teks: "Latih fingertrick dan hafalkan algoritma sampai otomatis." },
  { grup: "kecepatan", variabel: "tps", himpunan: "sedang", teks: "Latih algoritma yang sering dipakai agar eksekusi lebih cepat." },
  { grup: "efisiensi", variabel: "gerakan", himpunan: "boros", teks: "Pelajari F2L intuitif / metode lebih efisien (CFOP)." },
  { grup: "jeda", variabel: "jeda", himpunan: "banyak", teks: "Latih lookahead: solve pelan tanpa berhenti." },
  { grup: "jeda", variabel: "jeda", himpunan: "sedang", teks: "Latihan slow turning untuk mengurangi waktu diam." },
];

// Dipakai jika tidak ada aturan yang terpenuhi
export const REKOMENDASI_SEIMBANG = "Performa seimbang, lanjutkan ke algoritma lanjutan (OLL/PLL penuh).";

// Susun daftar rekomendasi latihan berdasarkan hasil fuzzifikasi (μ).
export function buatRekomendasi(mu, ambang = AMBANG_REKOMENDASI) {
  const saran = [];
  const grupTerpenuhi = new Set();

  for (const a of ATURAN_REKOMENDASI) {
    // Grup ini sudah punya saran → lewati aturan berikutnya di grup yang sama ("else if")
    if (grupTerpenuhi.has(a.grup)) continue;
    if (mu[a.variabel][a.himpunan] >= ambang) {
      saran.push(a.teks);
      grupTerpenuhi.add(a.grup);
    }
  }

  // Tidak ada kelemahan yang menonjol
  if (saran.length === 0) saran.push(REKOMENDASI_SEIMBANG);
  return saran;
}
