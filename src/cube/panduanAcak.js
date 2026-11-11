// Pemandu acakan: memberi tahu gerakan berikutnya yang harus diputar, mengikuti
// putaran dari smart cube, dan memberi koreksi jika salah putar.
// Modul murni (tanpa DOM), bisa dites terpisah.
//
// Setiap langkah disimpan sebagai { sisi, jumlah } dengan jumlah = banyak putaran
// seperempat searah jarum jam (1 = "R", 2 = "R2", 3 = "R'").

const NAMA_SISI = { U: "atas", D: "bawah", R: "kanan", L: "kiri", F: "depan", B: "belakang" };

// "R" → {sisi:"R", jumlah:1}, "R'" → 3, "R2" → 2
export function urai(gerakan) {
  const m = /^([URFDLB])(2'?|'|)$/.exec(String(gerakan).trim());
  if (!m) return null;
  const jumlah = m[2] === "" ? 1 : m[2] === "'" ? 3 : 2;
  return { sisi: m[1], jumlah };
}

// Kebalikan dari urai(): {sisi:"R", jumlah:3} → "R'"
export function teks({ sisi, jumlah }) {
  return sisi + ["", "", "2", "'"][jumlah];
}

// Penjelasan arah untuk pemula
export function arah({ sisi, jumlah }) {
  const putar = jumlah === 2 ? "putar 2 kali" : jumlah === 1 ? "searah jarum jam" : "berlawanan arah jarum jam";
  return `Sisi ${NAMA_SISI[sisi]} (${sisi}), ${putar}`;
}

export class PanduanAcak {
  constructor(daftarGerakan) {
    this.langkah = daftarGerakan.map(urai).filter(Boolean);
    this.i = 0; // indeks langkah acakan yang sedang dikerjakan
    this.sisa = this.langkah[0]?.jumlah ?? 0; // sisa putaran pada langkah ini
    this.koreksi = []; // putaran pembatal untuk gerakan yang salah (paling depan dulu)
  }

  get selesai() {
    return this.i >= this.langkah.length && this.koreksi.length === 0;
  }

  /** Gerakan yang harus diputar sekarang: { sisi, jumlah, koreksi:boolean } atau null jika selesai */
  get berikutnya() {
    if (this.koreksi.length) return { ...this.koreksi[0], koreksi: true };
    if (this.i < this.langkah.length) return { sisi: this.langkah[this.i].sisi, jumlah: this.sisa, koreksi: false };
    return null;
  }

  /**
   * Terima satu putaran dari kubus.
   * @returns "benar" | "salah" | "koreksi" | "selesai" | "abaikan"
   */
  terima(gerakan) {
    const g = urai(gerakan);
    if (!g || this.selesai) return "abaikan";

    // Sedang ada gerakan salah yang harus dibatalkan dulu
    if (this.koreksi.length) {
      const k = this.koreksi[0];
      if (g.sisi === k.sisi) {
        k.jumlah = (k.jumlah - g.jumlah + 4) % 4;
        if (k.jumlah === 0) this.koreksi.shift();
        return this.selesai ? "selesai" : "koreksi";
      }
      this.koreksi.unshift({ sisi: g.sisi, jumlah: (4 - g.jumlah) % 4 });
      return "salah";
    }

    const sekarang = this.langkah[this.i];
    if (g.sisi === sekarang.sisi) {
      // Sisi benar: kurangi sisa putaran (bisa jadi arah sebaliknya, mis. R2 dikerjakan R' R')
      this.sisa = (this.sisa - g.jumlah + 4) % 4;
      if (this.sisa === 0) {
        this.i++;
        this.sisa = this.langkah[this.i]?.jumlah ?? 0;
      }
      return this.selesai ? "selesai" : "benar";
    }

    // Sisi salah → harus dibatalkan dulu dengan putaran kebalikannya
    this.koreksi.unshift({ sisi: g.sisi, jumlah: (4 - g.jumlah) % 4 });
    return "salah";
  }

  /** Status tiap langkah untuk tampilan: [{ teks, status: "selesai"|"sekarang"|"nanti" }] */
  get tampilan() {
    return this.langkah.map((l, idx) => ({
      teks: teks(l),
      status: idx < this.i ? "selesai" : idx === this.i ? "sekarang" : "nanti",
    }));
  }
}
