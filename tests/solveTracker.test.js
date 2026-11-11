import { describe, it, expect, vi, afterEach } from "vitest";
import { hitungStatistik, SolveTracker, pilihTimestamp } from "../src/cube/solveTracker.js";
import { SmartCube, pesanGalatKoneksi, faceletsSolved } from "../src/cube/smartcube.js";

const SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
const ACAK = "UUUUUUUUFRRRRRRRRRFFFFFFFFUDDDDDDDDDLLLLLLLLLBBBBBBBBB";

describe("faceletsSolved()", () => {
  it("mengenali status solved dalam notasi Kociemba", () => {
    expect(faceletsSolved(SOLVED)).toBe(true);
    expect(faceletsSolved(ACAK)).toBe(false);
    expect(faceletsSolved(null)).toBe(false);
    expect(faceletsSolved("UUU")).toBe(false);
  });
});

describe("kubus GAN model baru (gan-web-bluetooth) — tiruan", () => {
  // Kubus GAN tiruan: membalas REQUEST_FACELETS dengan event FACELETS berisi status saat ini
  function rangkaiGan() {
    let hasil = null;
    const perintah = [];
    const tracker = new SolveTracker({ onSelesai: (h) => (hasil = h) });
    const cube = new SmartCube({
      onPutaran: (move, t, tLokal) => tracker.putaran(move, t, undefined, tLokal),
      onCekSolved: async () => {
        if (tracker.state !== "solving" || tracker.catatan.length <= 1) return;
        tracker.cobaSelesaiOtomatis(await cube.cekSolved());
      },
    });
    const kubus = { facelets: ACAK };
    cube.gan = {
      sendCubeCommand: async (cmd) => {
        perintah.push(cmd.type);
        if (cmd.type === "REQUEST_FACELETS") {
          setTimeout(() => cube.terimaEventGan({ type: "FACELETS", facelets: kubus.facelets }), 1);
        }
      },
    };
    cube.statusDariKubus = true;
    const gerak = (move, cubeTimestamp, faceletsSetelahnya = ACAK) => {
      kubus.facelets = faceletsSetelahnya;
      cube.terimaEventGan({ type: "MOVE", move, cubeTimestamp });
    };
    return { tracker, cube, gerak, perintah, hasil: () => hasil };
  }

  it("berhenti otomatis saat status stiker dari kubus solved", async () => {
    const { tracker, gerak, perintah, hasil } = rangkaiGan();
    tracker.mulai();
    gerak("R", 1000);
    await tunggu();
    gerak("U", 1400);
    await tunggu();
    expect(tracker.state).toBe("solving");
    gerak("U'", 1800, SOLVED);
    await tunggu();
    await vi.waitFor(() => expect(tracker.state).toBe("idle"));
    expect(hasil().otomatis).toBe(true);
    expect(hasil().moves).toEqual(["R", "U", "U'"]);
    expect(perintah.filter((p) => p === "REQUEST_FACELETS").length).toBe(3);
  });

  it("status stiker lama tidak dipakai setelah ada putaran baru (tidak salah berhenti)", async () => {
    const { tracker, cube, gerak } = rangkaiGan();
    tracker.mulai();
    gerak("R", 1000);
    gerak("R'", 1300);
    cube.faceletsTerakhir = SOLVED; // sisa status lama
    gerak("U", 1600); // putaran baru → status lama harus dibuang
    expect(await cube.cekSolved()).toBe(false);
  });

  it("gerakan GAN tanpa timestamp kubus → seluruh solve pakai jam browser", async () => {
    const { tracker, gerak, hasil } = rangkaiGan();
    tracker.mulai();
    gerak("R", 1000);
    gerak("U", null); // gerakan yang dipulihkan: cubeTimestamp null
    await tunggu();
    gerak("U'", 1800, SOLVED);
    await tunggu();
    await vi.waitFor(() => expect(hasil()?.otomatis).toBe(true));
    expect(hasil().timestamps.every((t) => t === hasil().timestamps[0] || t > 0)).toBe(true);
    expect(hasil().waktu).toBeLessThan(1); // jam browser (tes berjalan cepat), bukan 0.8 s jam kubus campur
  });

  it("cadangan: sensor kubus GAN melenceng, tapi pelacakan sejak 'Kubus sudah solved' tetap menghentikan timer", async () => {
    const { cube3x3x3 } = await import("cubing/puzzles");
    const { tracker, cube, gerak, hasil } = rangkaiGan();
    cube.kpuzzle = await cube3x3x3.kpuzzle();
    cube.tandaiSolved(); // kubus fisik solved; anggap kubus GAN mengabaikan reset (sensor tetap "teracak")
    tracker.mulai();
    gerak("R", 1000); // sensor kubus terus melaporkan ACAK
    gerak("U", 1300);
    await tunggu();
    expect(tracker.state).toBe("solving");
    gerak("U'", 1600);
    gerak("R'", 1900); // kubus fisik kembali solved
    await vi.waitFor(() => expect(tracker.state).toBe("idle"));
    expect(hasil().moves).toEqual(["R", "U", "U'", "R'"]);
  });

  it("cadangan tetap jalan walaupun kubus GAN tidak pernah membalas dengan status stiker", async () => {
    const { cube3x3x3 } = await import("cubing/puzzles");
    const { tracker, cube, gerak, hasil } = rangkaiGan();
    cube.gan.sendCubeCommand = async () => {}; // kubus diam: tidak ada event FACELETS sama sekali
    cube.kpuzzle = await cube3x3x3.kpuzzle();
    cube.tandaiSolved();
    tracker.mulai();
    gerak("F", 1000);
    gerak("F'", 1400);
    await vi.waitFor(() => expect(tracker.state).toBe("idle"));
    expect(hasil().otomatis).toBe(true);
    expect(await cube.kondisi()).toEqual({ sensor: null, cadangan: true, solved: true });
  });

  it("'Kubus sudah solved' mengirim REQUEST_RESET ke kubus GAN", () => {
    const { cube, perintah } = rangkaiGan();
    cube.kpuzzle = { defaultPattern: () => ({}) };
    cube.tandaiSolved();
    expect(perintah).toContain("REQUEST_RESET");
  });
});

describe("pesanGalatKoneksi()", () => {
  const galat = (message) => Object.assign(new Error(message), { name: "NotFoundError" });
  it("NotFoundError karena jendela ditutup ≠ NotFoundError karena protokol tidak cocok", () => {
    expect(pesanGalatKoneksi(galat("User cancelled the requestDevice() chooser."))).toMatch(/ditutup tanpa memilih/);
    const protokol = pesanGalatKoneksi(
      galat("No Services matching UUID 0000fff0-0000-1000-8000-00805f9b34fb found in Device."),
    );
    expect(protokol).toMatch(/protokol Bluetooth-nya tidak cocok/);
    expect(protokol).toMatch(/Hubungkan GAN/);
    expect(protokol).toMatch(/detail: No Services matching UUID/);
  });
  it("kasus lain tetap menampilkan detail asli", () => {
    expect(pesanGalatKoneksi(galat("Bluetooth adapter not available."))).toMatch(/Bluetooth di perangkat ini mati/);
    expect(pesanGalatKoneksi("Device did not have a GATT server.")).toMatch(/detail: Device did not have/);
    expect(pesanGalatKoneksi(new Error("aneh"))).toBe("Gagal terhubung. (detail: aneh)");
  });
});

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
    await vi.waitFor(() => expect(tracker.state).toBe("idle"));
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
    await vi.waitFor(() => expect(tracker.state).toBe("idle"));
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
