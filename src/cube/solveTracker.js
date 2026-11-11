// State machine solve + perhitungan statistik.
// Modul ini murni (tanpa DOM & tanpa Bluetooth) supaya mudah dites.
//
//   idle ──[mulai()]──▶ ready ──[putaran pertama]──▶ solving
//     ▲                                                │
//     └────────[kubus solved ATAU selesai()]───────────┘
import { BATAS_JEDA_MS } from "../fuzzy/config.js";

/**
 * Hitung statistik dari daftar timestamp gerakan (ms).
 *   waktu   = max(0.1, (t[n-1] − t[0]) / 1000)
 *   tps     = gerakan / waktu
 *   jedaMs  = Σ (t[i] − t[i-1]) untuk setiap selisih > batas
 *   jeda    = min(100, jedaMs / (waktu × 1000) × 100)
 */
export function hitungStatistik(timestamps, batasJedaMs = BATAS_JEDA_MS) {
  const n = timestamps.length;
  if (n === 0) return { waktu: 0, gerakan: 0, tps: 0, jeda: 0, jedaMs: 0 };

  const waktu = Math.max(0.1, (timestamps[n - 1] - timestamps[0]) / 1000);
  const gerakan = n;
  const tps = gerakan / waktu;

  let jedaMs = 0;
  for (let i = 1; i < n; i++) {
    const selisih = timestamps[i] - timestamps[i - 1];
    if (selisih > batasJedaMs) jedaMs += selisih;
  }
  const jeda = Math.min(100, (jedaMs / (waktu * 1000)) * 100);

  return { waktu, gerakan, tps, jeda, jedaMs };
}

/**
 * Pilih sumber timestamp untuk statistik.
 * Timestamp dari kubus (t) lebih akurat, tetapi hanya dipakai jika durasinya
 * masuk akal dibanding jam browser (tLokal): rasio 0.75–1.5. Batas ini cukup longgar
 * untuk keterlambatan Bluetooth (putaran yang dikirim ulang tiba terlambat), tetapi
 * tetap menangkap jam kubus yang satuannya salah (mis. meleset 1.6× atau 1000×).
 */
export function pilihTimestamp(catatan) {
  const lokal = catatan.map((c) => c.tLokal ?? c.t);
  const kubus = catatan.map((c) => c.t);
  if (!kubus.every(Number.isFinite)) return lokal;
  const durKubus = kubus[kubus.length - 1] - kubus[0];
  const durLokal = lokal[lokal.length - 1] - lokal[0];
  if (durLokal <= 0) return kubus;
  const rasio = durKubus / durLokal;
  return rasio >= 0.75 && rasio <= 1.5 ? kubus : lokal;
}

/**
 * Pelacak satu sesi solve.
 * onSelesai(hasil) dipanggil ketika solve berakhir, dengan
 * hasil = { moves: string[], timestamps: number[], otomatis: boolean, ...statistik }
 */
export class SolveTracker {
  constructor({ onSelesai = () => {}, onBerubah = () => {} } = {}) {
    this.state = "idle";
    this.catatan = []; // [{ move, t }]
    this.onSelesai = onSelesai;
    this.onBerubah = onBerubah;
  }

  // Klik "Mulai solve": tunggu putaran pertama
  mulai() {
    this.catatan = [];
    this.#ubahState("ready");
  }

  // Batalkan tanpa menghasilkan skor
  batal() {
    this.catatan = [];
    this.#ubahState("idle");
  }

  /**
   * Terima satu putaran dari kubus.
   * @param {string} move - notasi gerakan, mis. "R'"
   * @param {number} t - timestamp (ms)
   * @param {() => boolean} [cekSolved] - mengembalikan true jika kubus solved
   * @param {number} [tLokal] - timestamp jam browser (ms), cadangan jika t dari kubus meragukan
   */
  putaran(move, t, cekSolved = () => false, tLokal = t) {
    // idle: putaran tidak dicatat (dipakai untuk mengacak)
    if (this.state === "idle") return;

    if (this.state === "ready") this.#ubahState("solving");

    this.catatan.push({ move, t, tLokal });

    // Deteksi solved hanya jika sudah ada lebih dari 1 gerakan
    if (this.catatan.length > 1 && cekSolved()) this.selesai(true);
  }

  /**
   * Akhiri solve secara otomatis jika kubus solved (hasil pengecekan async dari kubus).
   * Sama seperti di atas: hanya berlaku saat solving dan sudah lebih dari 1 gerakan.
   * @returns {boolean} true jika solve diakhiri
   */
  cobaSelesaiOtomatis(solved) {
    if (this.state !== "solving" || this.catatan.length <= 1 || !solved) return false;
    this.selesai(true);
    return true;
  }

  // Akhiri solve (otomatis = true jika dari deteksi solved)
  selesai(otomatis = false) {
    if (this.state !== "solving") {
      // Belum ada gerakan → kembali ke idle saja
      this.batal();
      return null;
    }
    const timestamps = pilihTimestamp(this.catatan);
    const hasil = {
      moves: this.catatan.map((c) => c.move),
      timestamps,
      otomatis,
      ...hitungStatistik(timestamps),
    };
    this.catatan = [];
    this.#ubahState("idle");
    this.onSelesai(hasil);
    return hasil;
  }

  #ubahState(baru) {
    this.state = baru;
    this.onBerubah(baru);
  }
}
