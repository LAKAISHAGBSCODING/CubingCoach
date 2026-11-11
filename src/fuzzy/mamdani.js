// Mesin inferensi fuzzy metode MAMDANI (ditulis manual, tanpa library fuzzy).
// Modul ini murni: tidak menyentuh DOM, sehingga bisa dites terpisah.
import {
  VARIABEL_INPUT,
  VARIABEL_OUTPUT,
  RULES,
  LANGKAH_CENTROID,
} from "./config.js";
import { trap, fuzzifikasi } from "./membership.js";
import { buatRekomendasi } from "./recommendation.js";

/**
 * Jalankan seluruh tahap Mamdani.
 * @param {{tps:number, gerakan:number, jeda:number}} input - nilai crisp
 * @returns hasil tiap tahap (lihat kontrak di blueprint 5.6)
 */
export function infer(input) {
  const varOut = VARIABEL_OUTPUT.skor;

  // ---------- 1. FUZZIFIKASI ----------
  // Hitung derajat keanggotaan μ setiap himpunan untuk ketiga input.
  const mu = {
    tps: fuzzifikasi(input.tps, VARIABEL_INPUT.tps),
    gerakan: fuzzifikasi(input.gerakan, VARIABEL_INPUT.gerakan),
    jeda: fuzzifikasi(input.jeda, VARIABEL_INPUT.jeda),
  };

  // ---------- 2. INFERENSI (implikasi MIN) ----------
  // α_i = min(μ_TPS, μ_Gerakan, μ_Jeda) untuk setiap rule.
  const rules = RULES.map((r) => ({
    ...r,
    alpha: Math.min(mu.tps[r.tps], mu.gerakan[r.gerakan], mu.jeda[r.jeda]),
  }));

  // ---------- 3. KOMPOSISI ----------
  // Untuk tiap himpunan output, ambil α terbesar dari rule yang MAKA-nya himpunan itu.
  const alphaOut = {};
  for (const nama of Object.keys(varOut.himpunan)) alphaOut[nama] = 0;
  for (const r of rules) {
    alphaOut[r.skor] = Math.max(alphaOut[r.skor], r.alpha);
  }

  // ---------- 4. AGREGASI (MAX) + 5. DEFUZZIFIKASI CENTROID (diskrit) ----------
  // μ_agg(z) = max_k( min(α_k, μ_k(z)) )
  // z*       = Σ(z · μ_agg(z)) / Σ μ_agg(z),  z = 0, 0.5, 1, ..., 100
  const [zMin, zMax] = varOut.semesta;
  const jumlahLangkah = Math.round((zMax - zMin) / LANGKAH_CENTROID);
  const xs = [];
  const ys = [];
  let num = 0; // Σ(z · μ_agg)
  let den = 0; // Σ μ_agg
  for (let i = 0; i <= jumlahLangkah; i++) {
    // Pakai indeks bulat (bukan z += 0.5) agar tidak ada galat penjumlahan desimal
    const z = zMin + i * LANGKAH_CENTROID;
    let muAgg = 0;
    for (const [nama, himpunan] of Object.entries(varOut.himpunan)) {
      // Potong (clip) himpunan output setinggi α-nya, lalu ambil maksimum
      const terpotong = Math.min(alphaOut[nama], trap(z, himpunan.param));
      muAgg = Math.max(muAgg, terpotong);
    }
    xs.push(z);
    ys.push(muAgg);
    num += z * muAgg;
    den += muAgg;
  }
  // Jika tidak ada rule yang aktif (Σμ = 0), skor = 0
  const skor = den === 0 ? 0 : num / den;

  // ---------- 6. KATEGORI AKHIR ----------
  // Himpunan output dengan μ(z*) terbesar.
  const muSkor = {};
  let kategori = null;
  for (const [nama, himpunan] of Object.entries(varOut.himpunan)) {
    muSkor[nama] = trap(skor, himpunan.param);
    if (kategori === null || muSkor[nama] > muSkor[kategori]) kategori = nama;
  }

  return {
    input: { ...input },
    mu,
    rules,
    alphaOut,
    xs,
    ys,
    num,
    den,
    skor,
    muSkor,
    kategori,
    rekomendasi: buatRekomendasi(mu),
  };
}
