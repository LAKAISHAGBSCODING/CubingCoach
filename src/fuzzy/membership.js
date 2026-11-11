// Fungsi keanggotaan trapesium.
//
//   μ(x) = 0                    jika x < a atau x > d
//        = 1                    jika b ≤ x ≤ c
//        = (x − a) / (b − a)    jika a ≤ x < b
//        = (d − x) / (d − c)    jika c < x ≤ d
//
// Kasus bahu kiri (a = b) dan bahu kanan (c = d) otomatis tertangani,
// karena bagian "naik"/"turun" yang pembaginya nol tidak pernah dijalankan.
export function trap(x, [a, b, c, d]) {
  // Di luar rentang trapesium → 0
  if (x < a || x > d) return 0;
  // Bagian datar (puncak) → 1
  if (x >= b && x <= c) return 1;
  // Bagian naik: a ≤ x < b
  if (x < b) return (x - a) / (b - a);
  // Bagian turun: c < x ≤ d
  return (d - x) / (d - c);
}

// Batasi nilai agar tetap di dalam semesta [min, max]
export function clamp(x, [min, max]) {
  return Math.min(max, Math.max(min, x));
}

// Fuzzifikasi satu variabel: hitung μ untuk setiap himpunannya.
// Nilai input di luar semesta di-clamp dulu ke batas min/max.
// Hasil: { namaHimpunan: μ, ... }
export function fuzzifikasi(x, variabel) {
  const nilai = clamp(x, variabel.semesta);
  const hasil = {};
  for (const [nama, himpunan] of Object.entries(variabel.himpunan)) {
    hasil[nama] = trap(nilai, himpunan.param);
  }
  return hasil;
}
