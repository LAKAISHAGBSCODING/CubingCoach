import { describe, it, expect, vi, afterEach } from "vitest";
import { hitungStatistik, SolveTracker, pilihTimestamp } from "../src/cube/solveTracker.js";
import { SmartCube } from "../src/cube/smartcube.js";

// Kubus tiruan: meniru QiYi di cubing.js — status stiker diperbarui dulu,
// lalu beberapa putaran dikirim berturut-turut dalam satu pesan.
function buatKubusTiruan() {
  const kubus = { solved: false, listener: null };
  kubus.puzzle = {
    getPattern: async () => ({ experimentalIsSolved: () => kubus.solved }),
    addAlgLeafListener: (l) => (kubus.listener = l),
  };
  // Jam browser ditiru: satu pesan tiba ±50 ms setelah putaran terakhirnya terjadi
  // (jam browser = jam kubus + 5000 ms), jadi putaran yang dikirim ulang tiba terlambat.
  kubus.kirim = (moves, solvedSetelahnya = false) => {
    kubus.solved = solvedSetelahnya;
    const tiba = moves[moves.length - 1][1] + 5050;
    vi.spyOn(performance, "now").mockReturnValue(tiba);
    for (const [m, t] of moves) kubus.listener({ latestAlgLeaf: { toString: () => m }, timeStamp: t });
  };
  return kubus;
}
afterEach(() => vi.restoreAllMocks());

// Rangkai SmartCube + SolveTracker persis seperti di main.js
function rangkai(kubus) {
  let hasil = null;
  const tracker = new SolveTracker({ onSelesai: (h) => (hasil = h) });
  const cube = new SmartCube({
    onPutaran: (move, t, tLokal) => tracker.putaran(move, t, undefined, tLokal),
    onCekSolved: async () => {
      if (tracker.state !== "solving" || tracker.catatan.length <= 1) return;
      tracker.cobaSelesaiOtomatis(await cube.cekSolved());
    },
  });
  cube.puzzle = kubus.puzzle;
  cube.statusDariKubus = true;
  kubus.puzzle.addAlgLeafListener((e) => cube.terimaPutaran(e));
  return { tracker, cube, hasil: () => hasil };
}
const tunggu = () => new Promise((ok) => setTimeout(ok, 10));

describe("deteksi solved otomatis dari status kubus (tanpa tombol 'Kubus sudah solved')", () => {
  it("solve berakhir sendiri saat kubus melaporkan solved", async () => {
    const kubus = buatKubusTiruan();
    const { tracker, hasil } = rangkai(kubus);
    tracker.mulai();
    kubus.kirim([["R", 1000]]);
    await tunggu();
    kubus.kirim([["U", 1400]]);
    await tunggu();
    expect(tracker.state).toBe("solving");
    kubus.kirim([["U'", 1800]], true);
    await tunggu();
    expect(tracker.state).toBe("idle");
    expect(hasil().otomatis).toBe(true);
    expect(hasil().gerakan).toBe(3);
  });

  it("satu pesan berisi beberapa putaran: semua putaran tetap tercatat sebelum selesai", async () => {
    const kubus = buatKubusTiruan();
    const { tracker, hasil } = rangkai(kubus);
    tracker.mulai();
    kubus.kirim([["R", 1000], ["U", 1300]]);
    await tunggu();
    // QiYi mengirim ulang 3 putaran terakhir sekaligus, status akhirnya solved
    kubus.kirim([["R'", 1600], ["U'", 1900], ["F", 2200]], true);
    await tunggu();
    expect(tracker.state).toBe("idle");
    expect(hasil().moves).toEqual(["R", "U", "R'", "U'", "F"]);
    expect(hasil().waktu).toBeCloseTo(1.2, 5); // (2200 − 1000) / 1000
  });

  it("tidak berakhir jika kubus belum solved", async () => {
    const kubus = buatKubusTiruan();
    const { tracker } = rangkai(kubus);
    tracker.mulai();
    kubus.kirim([["R", 0], ["U", 300], ["R'", 600]], false);
    await tunggu();
    expect(tracker.state).toBe("solving");
  });
});

describe("pilihTimestamp()", () => {
  it("pakai jam kubus jika durasinya masuk akal", () => {
    const c = [{ t: 1000, tLokal: 5000 }, { t: 3000, tLokal: 7100 }];
    expect(pilihTimestamp(c)).toEqual([1000, 3000]);
  });
  it("pakai jam browser jika jam kubus meragukan (satuan berbeda)", () => {
    const c = [{ t: 1000, tLokal: 5000 }, { t: 4200, tLokal: 7000 }]; // kubus 3.2 s vs browser 2 s
    expect(pilihTimestamp(c)).toEqual([5000, 7000]);
  });
});
import { buatAcakan } from "../src/cube/scramble.js";

describe("hitungStatistik()", () => {
  it("tanpa jeda", () => {
    const s = hitungStatistik([0, 400, 800, 1200]);
    expect(s.waktu).toBeCloseTo(1.2, 10);
    expect(s.gerakan).toBe(4);
    expect(s.tps).toBeCloseTo(3.33, 2);
    expect(s.jeda).toBe(0);
  });

  it("satu selisih 1000 ms dihitung sebagai jeda", () => {
    const s = hitungStatistik([0, 300, 1300, 1600]);
    expect(s.waktu).toBeCloseTo(1.6, 10);
    expect(s.gerakan).toBe(4);
    expect(s.tps).toBeCloseTo(2.5, 10);
    expect(s.jeda).toBeCloseTo(62.5, 10);
  });

  it("waktu minimal 0.1 detik", () => {
    expect(hitungStatistik([500]).waktu).toBe(0.1);
  });
});

describe("SolveTracker", () => {
  it("idle → ready → solving → idle (deteksi solved)", () => {
    const riwayatState = [];
    let hasil = null;
    const tr = new SolveTracker({
      onBerubah: (s) => riwayatState.push(s),
      onSelesai: (h) => (hasil = h),
    });

    tr.putaran("R", 0); // idle: diabaikan
    tr.mulai();
    tr.putaran("R", 100, () => true); // 1 gerakan: belum dicek solved
    expect(tr.state).toBe("solving");
    tr.putaran("R'", 500, () => true); // solved
    expect(tr.state).toBe("idle");
    expect(riwayatState).toEqual(["ready", "solving", "idle"]);
    expect(hasil.moves).toEqual(["R", "R'"]);
    expect(hasil.otomatis).toBe(true);
  });

  it("tombol Selesai sebelum ada gerakan → kembali idle tanpa hasil", () => {
    const tr = new SolveTracker();
    tr.mulai();
    expect(tr.selesai()).toBeNull();
    expect(tr.state).toBe("idle");
  });
});

describe("buatAcakan()", () => {
  it("20 gerakan tanpa sisi berturut-turut atau pola R L R", () => {
    const lawan = { U: "D", D: "U", L: "R", R: "L", F: "B", B: "F" };
    for (let k = 0; k < 200; k++) {
      const a = buatAcakan();
      expect(a).toHaveLength(20);
      for (let i = 1; i < a.length; i++) {
        expect(a[i][0]).not.toBe(a[i - 1][0]);
        if (i >= 2 && a[i][0] === a[i - 2][0]) {
          expect(a[i - 1][0]).not.toBe(lawan[a[i][0]]);
        }
      }
    }
  });
});
