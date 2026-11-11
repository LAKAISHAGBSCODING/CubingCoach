// Koneksi smart cube (QiYi, GAN, GoCube, Giiker) lewat Web Bluetooth + cubing.js.
// cubing.js dimuat secara dinamis (import()) supaya mode input manual
// tetap jalan cepat dan tidak terganggu walaupun modul ini gagal dimuat.
//
// DETEKSI SOLVED — dua cara:
//   1. "Status dari kubus" (utama): kubus seperti QiYi mengirim posisi semua stiker
//      pada setiap putaran, dibaca lewat puzzle.getPattern(). Ini selalu sama dengan
//      kubus fisik, walaupun ada pesan Bluetooth yang terlambat/terulang.
//   2. "Pelacakan manual" (cadangan untuk kubus yang tidak mengirim status):
//      user menekan "Kubus sudah solved", lalu setiap putaran diterapkan ke salinan
//      pattern. Bisa meleset jika ada putaran yang hilang di jalan.

const OPSI_SOLVED = { ignorePuzzleOrientation: true, ignoreCenterOrientation: true };

// Web Bluetooth hanya ada di Chrome/Edge dan hanya di secure context
export function bluetoothDidukung() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator && window.isSecureContext;
}

export class SmartCube {
  constructor({ onPutaran = () => {}, onCekSolved = () => {}, onStatus = () => {} } = {}) {
    this.onPutaran = onPutaran; // (moveString, tKubus, tLokal) => void — dipanggil per putaran
    this.onCekSolved = onCekSolved; // () => void — dipanggil sekali setelah satu kelompok putaran
    this.onStatus = onStatus; // (pesan, jenis) => void, jenis: info | ok | error
    this.puzzle = null;
    this.kpuzzle = null;
    this.player = null;
    this.pattern = null;
    this.patternKnown = false; // pelacakan manual aktif (setelah "Kubus sudah solved")
    this.statusDariKubus = false; // kubus bisa melaporkan posisi stikernya sendiri
    this.cekTerjadwal = false;
  }

  // Muat modul bluetooth lebih awal (saat halaman dibuka), supaya saat tombol
  // diklik connectSmartPuzzle() bisa langsung dipanggil di dalam "user gesture".
  pramuat() {
    this.modulBluetooth ??= import("cubing/bluetooth");
    return this.modulBluetooth;
  }

  get terhubung() {
    return this.puzzle !== null;
  }

  // Deteksi selesai otomatis bisa dipakai?
  get deteksiOtomatis() {
    return this.statusDariKubus || this.patternKnown;
  }

  // Muat modul cubing.js dan tampilan 3D (dipanggil sekali)
  async #muatModul(wadahPlayer) {
    if (this.kpuzzle) return;
    const [{ cube3x3x3 }] = await Promise.all([
      import("cubing/puzzles"),
      import("cubing/twisty"), // mendaftarkan elemen <twisty-player>
    ]);
    this.kpuzzle = await cube3x3x3.kpuzzle();

    const player = document.createElement("twisty-player");
    player.setAttribute("puzzle", "3x3x3");
    player.setAttribute("control-panel", "none");
    player.setAttribute("background", "none");
    player.setAttribute("hint-facelets", "none");
    player.setAttribute("experimental-setup-anchor", "start");
    wadahPlayer.replaceChildren(player);
    this.player = player;
  }

  // HARUS dipanggil dari klik tombol (aturan Web Bluetooth)
  async hubungkan(wadahPlayer) {
    try {
      this.onStatus("Memuat modul cubing.js…", "info");
      // Mulai pemilih Bluetooth secepatnya agar "user gesture" belum kedaluwarsa
      const { connectSmartPuzzle } = await this.pramuat();
      const puzzlePromise = connectSmartPuzzle();
      this.onStatus("Pilih kubus di jendela Bluetooth…", "info");
      await this.#muatModul(wadahPlayer);
      this.puzzle = await puzzlePromise;
      this.puzzle.addAlgLeafListener((e) => this.terimaPutaran(e));

      // Beri tahu jika koneksi Bluetooth terputus (mis. kubus mati / terlalu jauh)
      this.puzzle.server?.device?.addEventListener?.("gattserverdisconnected", () => {
        this.puzzle = null;
        this.statusDariKubus = false;
        this.onStatus("Koneksi kubus terputus. Tekan \"Hubungkan ulang\".", "error");
      });

      const nama = this.puzzle.name?.() ?? "Smart cube";
      this.statusDariKubus = await this.#cobaBacaStatus();
      if (this.statusDariKubus) {
        const solved = await this.cekSolved();
        this.onStatus(
          `Terhubung: ${nama}. Deteksi selesai otomatis aktif (status dibaca langsung dari kubus).` +
            (solved ? "" : " Kubus sedang teracak; tampilan 3D dimulai dari posisi solved."),
          "ok",
        );
      } else {
        this.onStatus(`Terhubung: ${nama}. Pastikan kubus solved lalu tekan "Kubus sudah solved".`, "ok");
      }
      return true;
    } catch (err) {
      this.puzzle = null;
      const batal = err?.name === "NotFoundError";
      this.onStatus(batal ? "Pemilihan perangkat dibatalkan." : `Gagal terhubung: ${err?.message ?? err}`, "error");
      return false;
    }
  }

  // Apakah kubus ini bisa melaporkan posisi stikernya? (QiYi: ya)
  async #cobaBacaStatus() {
    try {
      // Beri waktu sebentar agar pesan "hello" pertama dari kubus sempat diterima
      await new Promise((ok) => setTimeout(ok, 400));
      const p = await this.puzzle.getPattern();
      return typeof p?.experimentalIsSolved === "function";
    } catch {
      return false; // kelas dasar cubing.js melempar "cannot get pattern"
    }
  }

  // Tandai bahwa kubus fisik sekarang dalam keadaan solved (pelacakan manual + reset 3D)
  tandaiSolved() {
    try {
      this.pattern = this.kpuzzle.defaultPattern();
      this.patternKnown = true;
      if (this.player) this.player.alg = "";
      this.onStatus(
        this.statusDariKubus
          ? "Tampilan 3D di-reset ke posisi solved."
          : "Kubus ditandai solved. Deteksi selesai otomatis aktif.",
        "ok",
      );
    } catch (err) {
      this.onStatus(`Gagal reset state: ${err?.message ?? err}`, "error");
    }
  }

  // Apakah kubus sekarang solved? (async karena status dibaca dari kubus)
  async cekSolved() {
    try {
      if (this.statusDariKubus && this.puzzle) {
        const p = await this.puzzle.getPattern();
        return p.experimentalIsSolved(OPSI_SOLVED);
      }
      if (this.patternKnown && this.pattern) return this.pattern.experimentalIsSolved(OPSI_SOLVED);
    } catch {
      /* status tidak terbaca → anggap belum solved */
    }
    return false;
  }

  // Publik (bukan #privat) agar bisa diuji dengan kubus tiruan di Vitest
  terimaPutaran(e) {
    // Pakai timestamp dari kubus jika ada (lebih akurat: putaran yang terlambat
    // dikirim ulang tetap punya waktu aslinya). Jika tidak ada, pakai jam browser.
    const tLokal = performance.now();
    const t = Number.isFinite(e.timeStamp) ? e.timeStamp : tLokal;
    const move = e.latestAlgLeaf;
    try {
      this.player?.experimentalAddMove(move);
      if (this.patternKnown) this.pattern = this.pattern.applyMove(move);
    } catch (err) {
      this.onStatus(`Galat memproses putaran: ${err?.message ?? err}`, "error");
    }
    this.onPutaran(move.toString(), t, tLokal);

    // Satu pesan Bluetooth bisa berisi beberapa putaran sekaligus. Cek solved cukup
    // sekali setelah semuanya diproses (status stiker kubus sudah yang terbaru).
    if (!this.cekTerjadwal) {
      this.cekTerjadwal = true;
      setTimeout(() => {
        this.cekTerjadwal = false;
        this.onCekSolved();
      }, 0);
    }
  }

  putuskan() {
    try {
      this.puzzle?.disconnect();
    } catch {
      /* abaikan */
    }
    this.puzzle = null;
    this.statusDariKubus = false;
    this.onStatus("Koneksi diputus.", "info");
  }
}
