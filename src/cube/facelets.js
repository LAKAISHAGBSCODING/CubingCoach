// Konversi status stiker (notasi Kociemba, 54 huruf) ↔ data pola kubus cubing.js.
// Modul murni (tanpa DOM), bisa dites terpisah.
//
// Notasi Kociemba: 6 sisi berurutan U R F D L B, tiap sisi 9 stiker dibaca baris per baris.
// Contoh solved: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB".
//
// Tabel pemetaan di bawah diambil dari cubing.js (qiyiCornerMappings/qiyiEdgeMappings):
// urutan stiker QiYi di cubing.js sama persis dengan urutan Kociemba.

// Urutan kepingan standar (urutan "Reid") yang dipakai pola 3x3x3 cubing.js
const URUTAN_SUDUT = "UFR URB UBL ULF DRF DFL DLB DBR".split(" ");
const URUTAN_RUSUK = "UF UR UB UL DF DR DB DL FR FL BR BL".split(" ");

// Indeks stiker (0–53) untuk tiap posisi kepingan, urutan huruf sama dengan nama posisinya
const STIKER_SUDUT = [
  [8, 20, 9], // UFR
  [2, 11, 45], // URB
  [0, 47, 36], // UBL
  [6, 38, 18], // ULF
  [29, 15, 26], // DRF
  [27, 24, 44], // DFL
  [33, 42, 53], // DLB
  [35, 51, 17], // DBR
];
const STIKER_RUSUK = [
  [7, 19], // UF
  [5, 10], // UR
  [1, 46], // UB
  [3, 37], // UL
  [28, 25], // DF
  [32, 16], // DR
  [34, 52], // DB
  [30, 43], // DL
  [23, 12], // FR
  [21, 41], // FL
  [48, 14], // BR
  [50, 39], // BL
];

const putarKiri = (s, i) => s.slice(i) + s.slice(0, i);

// "huruf stiker" → { kepingan, orientasi }, mis. "RUF" → sudut UFR dengan orientasi 2
const PETA = {};
URUTAN_RUSUK.forEach((nama, idx) => {
  for (let o = 0; o < 2; o++) PETA[putarKiri(nama, o)] = { kepingan: idx, orientasi: o };
});
URUTAN_SUDUT.forEach((nama, idx) => {
  for (let o = 0; o < 3; o++) PETA[putarKiri(nama, o)] = { kepingan: idx, orientasi: o };
});

/** Apakah status stiker solved? (setiap sisi berwarna seragam) */
export function faceletsSolved(facelets) {
  if (typeof facelets !== "string" || facelets.length !== 54) return false;
  for (let s = 0; s < 54; s += 9) {
    const sisi = facelets.slice(s, s + 9);
    if (sisi !== sisi[0].repeat(9)) return false;
  }
  return true;
}

/**
 * Status stiker Kociemba → data pola (KPatternData) untuk cubing.js.
 * @returns data pola, atau null jika stiker tidak membentuk kubus yang sah
 */
export function faceletsKePolaData(facelets) {
  if (typeof facelets !== "string" || facelets.length !== 54) return null;
  const orbit = (daftar) => {
    const pieces = [];
    const orientation = [];
    for (const idx of daftar) {
      const info = PETA[idx.map((i) => facelets[i]).join("")];
      if (!info) return null; // kombinasi warna mustahil (data rusak)
      pieces.push(info.kepingan);
      orientation.push(info.orientasi);
    }
    // Setiap kepingan harus muncul tepat sekali
    if (new Set(pieces).size !== pieces.length) return null;
    return { pieces, orientation };
  };
  const CORNERS = orbit(STIKER_SUDUT);
  const EDGES = orbit(STIKER_RUSUK);
  if (!CORNERS || !EDGES) return null;
  return {
    EDGES,
    CORNERS,
    CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0], orientationMod: [1, 1, 1, 1, 1, 1] },
  };
}

/** Kebalikan dari faceletsKePolaData (dipakai untuk pengujian). */
export function polaDataKeFacelets(data) {
  const hasil = Array(54).fill("?");
  // Pusat sisi tetap
  "URFDLB".split("").forEach((h, i) => (hasil[i * 9 + 4] = h));
  const isi = (daftar, urutan, orbit) =>
    daftar.forEach((idx, posisi) => {
      const nama = putarKiri(urutan[orbit.pieces[posisi]], orbit.orientation[posisi]);
      idx.forEach((i, k) => (hasil[i] = nama[k]));
    });
  isi(STIKER_SUDUT, URUTAN_SUDUT, data.CORNERS);
  isi(STIKER_RUSUK, URUTAN_RUSUK, data.EDGES);
  return hasil.join("");
}
