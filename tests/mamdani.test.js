import { describe, it, expect } from "vitest";
import { infer } from "../src/fuzzy/mamdani.js";
import { RULES, VARIABEL_INPUT, PEMETAAN_POIN } from "../src/fuzzy/config.js";

describe("rekomendasi", () => {
  it("mengikuti tabel aturan rekomendasi", () => {
    expect(infer({ tps: 1.2, gerakan: 120, jeda: 60 }).rekomendasi).toEqual([
      "Latih fingertrick dan hafalkan algoritma sampai otomatis.",
      "Pelajari F2L intuitif / metode lebih efisien (CFOP).",
      "Latih lookahead: solve pelan tanpa berhenti.",
    ]);
    // tps 3.5 → sedang (bukan lambat); jeda 20 → sedang 0.667 ≥ 0.5
    expect(infer({ tps: 3.5, gerakan: 70, jeda: 20 }).rekomendasi).toEqual([
      "Latih algoritma yang sering dipakai agar eksekusi lebih cepat.",
      "Latihan slow turning untuk mengurangi waktu diam.",
    ]);
    expect(infer({ tps: 7, gerakan: 40, jeda: 5 }).rekomendasi).toEqual([
      "Performa seimbang, lanjutkan ke algoritma lanjutan (OLL/PLL penuh).",
    ]);
  });
});

describe("basis aturan", () => {
  it("konsekuen tiap rule sesuai sistem poin (dijelaskan di halaman Cara Kerja)", () => {
    for (const r of RULES) {
      const total = ["tps", "gerakan", "jeda"].reduce((s, k) => s + VARIABEL_INPUT[k].himpunan[r[k]].poin, 0);
      const harapan = PEMETAAN_POIN.find((p) => total >= p.min && total <= p.max).skor;
      expect(r.skor, `R${r.no}`).toBe(harapan);
    }
  });
});

// Toleransi ±0.05
const dekat = (nyata, harapan) => expect(Math.abs(nyata - harapan)).toBeLessThanOrEqual(0.05);

describe("infer() — Mamdani + centroid langkah 0.5", () => {
  it.each([
    [1.2, 120, 60, 17.85, "pemula", 1],
    [3.5, 70, 20, 50.0, "menengah", 2],
    [6.0, 55, 8, 80.77, "mahir", 2],
    [2.8, 70, 20, 45.32, "menengah", 4],
  ])("tps %s, gerakan %s, jeda %s → %s (%s)", (tps, gerakan, jeda, skor, kategori, aktif) => {
    const h = infer({ tps, gerakan, jeda });
    dekat(h.skor, skor);
    expect(h.kategori).toBe(kategori);
    expect(h.rules.filter((r) => r.alpha > 0)).toHaveLength(aktif);
  });

  it("mengikuti kontrak output", () => {
    const h = infer({ tps: 3.5, gerakan: 70, jeda: 20 });
    expect(h.rules).toHaveLength(27);
    expect(h.xs).toHaveLength(201);
    expect(h.xs[200]).toBe(100);
    expect(h.num / h.den).toBeCloseTo(h.skor, 10);
    expect(h.num).toBeCloseTo(2444.167, 2);
    expect(h.den).toBeCloseTo(48.883, 2);
    expect(Object.keys(h.mu.tps)).toEqual(["lambat", "sedang", "cepat"]);
    expect(h.rekomendasi.length).toBeGreaterThan(0);
  });
});
