import { describe, it, expect, beforeAll } from "vitest";
import { faceletsKePolaData, polaDataKeFacelets, faceletsSolved } from "../src/cube/facelets.js";
import { PanduanAcak, urai, teks, arah } from "../src/cube/panduanAcak.js";
import { buatAcakan } from "../src/cube/scramble.js";

const SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
// Status stiker setelah satu gerakan dari posisi solved (notasi Kociemba standar)
const SETELAH = {
  R: "UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB",
  // U: baris atas F, R, B, L bergeser (F←R, R←B, B←L, L←F)
  U: "UUUUUUUUU" + "BBBRRRRRR" + "RRRFFFFFF" + "DDDDDDDDD" + "FFFLLLLLL" + "LLLBBBBBB",
  F: "UUUUUULLLURRURRURRFFFFFFFFFRRRDDDDDDLLDLLDLLDBBBBBBBBB",
};

describe("konversi status stiker (Kociemba) → pola cubing.js", () => {
  let kpuzzle, KPattern;
  beforeAll(async () => {
    ({ KPattern } = await import("cubing/kpuzzle"));
    const { cube3x3x3 } = await import("cubing/puzzles");
    kpuzzle = await cube3x3x3.kpuzzle();
  });
  const pola = (f) => new KPattern(kpuzzle, faceletsKePolaData(f));

  it("solved ↔ pola awal", () => {
    expect(pola(SOLVED).isIdentical(kpuzzle.defaultPattern())).toBe(true);
    expect(faceletsSolved(SOLVED)).toBe(true);
  });

  it.each(["R", "U", "F"])("status stiker setelah %s cocok dengan pola cubing.js setelah %s", (m) => {
    expect(pola(SETELAH[m]).isIdentical(kpuzzle.defaultPattern().applyMove(m))).toBe(true);
  });

  it("bolak-balik untuk 50 acakan acak tetap sama", () => {
    for (let k = 0; k < 50; k++) {
      const p = kpuzzle.defaultPattern().applyAlg(buatAcakan().join(" "));
      const f = polaDataKeFacelets(p.patternData);
      expect(pola(f).isIdentical(p)).toBe(true);
    }
  });

  it("data rusak → null", () => {
    expect(faceletsKePolaData("U".repeat(54))).toBeNull();
    expect(faceletsKePolaData("abc")).toBeNull();
  });
});

describe("PanduanAcak", () => {
  it("urai/teks/arah", () => {
    expect(urai("R'")).toEqual({ sisi: "R", jumlah: 3 });
    expect(teks({ sisi: "U", jumlah: 2 })).toBe("U2");
    expect(arah({ sisi: "F", jumlah: 1 })).toBe("Sisi depan (F), searah jarum jam");
  });

  it("mengikuti acakan sampai selesai, termasuk X2 dikerjakan dua kali", () => {
    const p = new PanduanAcak(["R", "U2", "F'"]);
    expect(p.terima("R")).toBe("benar");
    expect(p.berikutnya).toEqual({ sisi: "U", jumlah: 2, koreksi: false });
    expect(p.terima("U")).toBe("benar");
    expect(p.berikutnya).toEqual({ sisi: "U", jumlah: 1, koreksi: false });
    expect(p.terima("U")).toBe("benar");
    expect(p.terima("F'")).toBe("selesai");
    expect(p.selesai).toBe(true);
  });

  it("X2 boleh dikerjakan berlawanan arah (U' U')", () => {
    const p = new PanduanAcak(["U2"]);
    p.terima("U'");
    expect(p.berikutnya).toEqual({ sisi: "U", jumlah: 3, koreksi: false }); // tinggal U' sekali lagi
    expect(p.terima("U'")).toBe("selesai");
  });

  it("salah sisi → minta dibatalkan dulu, lalu lanjut", () => {
    const p = new PanduanAcak(["R", "U"]);
    expect(p.terima("L")).toBe("salah");
    expect(p.berikutnya).toEqual({ sisi: "L", jumlah: 3, koreksi: true }); // batalkan dengan L'
    expect(p.terima("L'")).toBe("koreksi");
    expect(p.berikutnya).toEqual({ sisi: "R", jumlah: 1, koreksi: false });
    expect(p.terima("R")).toBe("benar");
    expect(p.terima("U")).toBe("selesai");
  });

  it("arah salah pada sisi yang benar → sisa putaran disesuaikan", () => {
    const p = new PanduanAcak(["R"]);
    p.terima("R'"); // salah arah: sekarang butuh R2 untuk sampai ke R
    expect(p.berikutnya).toEqual({ sisi: "R", jumlah: 2, koreksi: false });
  });

  it("tampilan menandai langkah selesai / sekarang / nanti", () => {
    const p = new PanduanAcak(["R", "U", "F"]);
    p.terima("R");
    expect(p.tampilan.map((t) => t.status)).toEqual(["selesai", "sekarang", "nanti"]);
  });
});
