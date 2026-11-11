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

import { faceletsSolved, faceletsKePolaData } from "./facelets.js";
export { faceletsSolved };

const OPSI_SOLVED = { ignorePuzzleOrientation: true, ignoreCenterOrientation: true };

// Web Bluetooth hanya ada di Chrome/Edge dan hanya di secure context
export function bluetoothDidukung() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator && window.isSecureContext;
}

/**
 * Terjemahkan error koneksi Bluetooth menjadi pesan yang jelas.
 * Catatan: Web Bluetooth memakai "NotFoundError" untuk beberapa kasus berbeda
 * (jendela pemilih ditutup DAN layanan Bluetooth kubus tidak ditemukan), jadi
 * pembedanya adalah isi pesan error-nya. Detail asli selalu ikut ditampilkan.
 */
export function pesanGalatKoneksi(err) {
  const asli = String(err?.message ?? err ?? "tidak diketahui");
  const detail = ` (detail: ${asli})`;

  if (/cancel/i.test(asli)) {
    return (
      "Jendela Bluetooth ditutup tanpa memilih kubus. Jika kubus tidak muncul di daftar: nyalakan Bluetooth, " +
      "putar satu sisi kubus agar bangun, dan putuskan kubus dari aplikasi di HP (kubus hanya bisa tersambung ke " +
      'satu perangkat). Setelah 2 kali gagal, klik "Hubungkan kubus" lagi: daftar akan menampilkan semua perangkat.'
    );
  }
  if (/no services matching|no characteristics matching/i.test(asli)) {
    return (
      "Kubus terdeteksi, tetapi protokol Bluetooth-nya tidak cocok dengan tombol ini. Untuk GAN model baru " +
      '(mis. i Carry 2, i Carry E, GAN12 ui, GAN14), pakai tombol "Hubungkan GAN".' + detail
    );
  }
  if (/unable to determine cube mac/i.test(asli)) {
    return (
      "MAC address kubus GAN tidak diketahui, jadi data kubus tidak bisa dibuka. Coba lagi dan isi MAC address " +
      "saat diminta (lihat di aplikasi GAN atau daftar perangkat Bluetooth di HP)." + detail
    );
  }
  if (/can't find target ble services|unsupported cube/i.test(asli)) {
    return "Model kubus GAN ini tidak didukung (bukan protokol GAN Gen2/Gen3/Gen4)." + detail;
  }
  if (/adapter|bluetooth is (off|disabled)|not available/i.test(asli)) {
    return "Bluetooth di perangkat ini mati atau tidak tersedia. Nyalakan Bluetooth lalu coba lagi." + detail;
  }
  if (/unknown bluetooth dev/i.test(asli)) {
    return "Perangkat yang dipilih bukan smart cube yang dikenali (nama Bluetooth-nya tidak cocok)." + detail;
  }
  if (/gatt|disconnect|network/i.test(asli)) {
    return "Koneksi ke kubus gagal atau terputus saat menyambung. Dekatkan kubus lalu coba lagi." + detail;
  }
  return "Gagal terhubung." + detail;
}


// ---------- MAC address kubus GAN (dibutuhkan library untuk membuka enkripsi) ----------
const KEY_MAC = "cubingCoach.ganMac";
const POLA_MAC = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;

// MAC address tidak pernah berubah (tertanam di chip Bluetooth kubus), jadi cukup diisi sekali.
// Disimpan dengan dua kunci: ID perangkat dari Chrome DAN nama kubus (mis. "GANicE2_47D5"),
// karena ID dari Chrome bisa berubah jika izin Bluetooth situs di-reset.
const kunciMac = (device) => [device.id, device.name && `nama:${device.name}`].filter(Boolean);

function bacaMacTersimpan(device) {
  try {
    const data = JSON.parse(localStorage.getItem(KEY_MAC) ?? "{}");
    for (const k of kunciMac(device)) if (data[k]) return data[k];
  } catch {
    /* abaikan */
  }
  return null;
}
function simpanMac(device, mac) {
  try {
    const data = JSON.parse(localStorage.getItem(KEY_MAC) ?? "{}");
    for (const k of kunciMac(device)) {
      if (mac) data[k] = mac;
      else delete data[k];
    }
    localStorage.setItem(KEY_MAC, JSON.stringify(data));
  } catch {
    /* abaikan: hanya kenyamanan */
  }
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
    // Jalur GAN model baru (library gan-web-bluetooth)
    this.gan = null; // koneksi GanCubeConnection
    this.faceletsTerakhir = null; // status stiker terbaru dari kubus GAN (null = belum ada / usang)
  }

  // Muat modul bluetooth lebih awal (saat halaman dibuka), supaya saat tombol
  // diklik pemilih Bluetooth bisa langsung dipanggil di dalam "user gesture".
  pramuat() {
    this.modulBluetooth ??= import("cubing/bluetooth");
    return this.modulBluetooth;
  }
  pramuatGan() {
    this.modulGan ??= import("gan-web-bluetooth");
    return this.modulGan;
  }

  get terhubung() {
    return this.puzzle !== null || this.gan !== null;
  }

  // Deteksi selesai otomatis bisa dipakai?
  get deteksiOtomatis() {
    return this.statusDariKubus || this.patternKnown;
  }

  // Muat modul cubing.js dan tampilan 3D (dipanggil sekali; publik agar bisa diuji tanpa Bluetooth)
  async siapkanTampilan(wadahPlayer) {
    if (this.kpuzzle) return;
    const [{ cube3x3x3 }, { KPattern }] = await Promise.all([
      import("cubing/puzzles"),
      import("cubing/kpuzzle"),
      import("cubing/twisty"), // mendaftarkan elemen <twisty-player>
    ]);
    this.kpuzzle = await cube3x3x3.kpuzzle();
    this.KPattern = KPattern;

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
      await this.siapkanTampilan(wadahPlayer);
      this.puzzle = await puzzlePromise;
      this.puzzle.addAlgLeafListener((e) => this.terimaPutaran(e));

      // Beri tahu jika koneksi Bluetooth terputus (mis. kubus mati / terlalu jauh)
      const puzzleIni = this.puzzle;
      this.puzzle.server?.device?.addEventListener?.("gattserverdisconnected", () => {
        if (this.puzzle !== puzzleIni) return; // event dari koneksi lama → abaikan
        this.puzzle = null;
        this.statusDariKubus = false;
        this.onStatus("Koneksi kubus terputus. Tekan \"Hubungkan ulang\".", "error");
      });

      const nama = this.puzzle.name?.() ?? "Smart cube";
      this.#mulaiKoneksiBaru();
      this.statusDariKubus = await this.#cobaBacaStatus();
      if (this.statusDariKubus) {
        await this.sinkronDariSensor(); // gambar 3D langsung mengikuti posisi kubus
        this.onStatus(
          `Terhubung: ${nama}. Gambar 3D mengikuti posisi kubus dan timer berhenti otomatis saat solved. ` +
            'Jika gambar berbeda dengan kubus di tanganmu, selesaikan kubusnya lalu tekan "Gambar salah? Reset".',
          "ok",
        );
      } else {
        this.onStatus(`Terhubung: ${nama}. Pastikan kubus solved lalu tekan "Kubus sudah solved".`, "ok");
      }
      return true;
    } catch (err) {
      this.puzzle = null;
      this.onStatus(pesanGalatKoneksi(err), "error");
      return false;
    }
  }

  // GAN model baru (Gen2/Gen3/Gen4) lewat library gan-web-bluetooth.
  // HARUS dipanggil dari klik tombol (aturan Web Bluetooth)
  async hubungkanGan(wadahPlayer) {
    let perangkat = null;
    let pakaiMacTersimpan = false;
    try {
      this.onStatus("Memuat modul GAN…", "info");
      const { connectGanCube } = await this.pramuatGan();
      // Penyedia MAC address: pakai yang tersimpan; jika tidak ada, library mencoba
      // membaca otomatis; jika gagal juga, minta user mengisi (isFallback = true).
      const penyediaMac = async (device, isFallback) => {
        perangkat = device;
        const tersimpan = bacaMacTersimpan(device);
        if (!isFallback) {
          pakaiMacTersimpan = Boolean(tersimpan);
          return tersimpan;
        }
        const isian = window.prompt(
          `MAC address kubus "${device.name ?? "GAN"}" tidak bisa dibaca otomatis.\n` +
            "Isi MAC address-nya (contoh AB:12:CD:34:EF:56). Cukup sekali — akan disimpan di browser ini.\n" +
            "Cara melihatnya: buka chrome://bluetooth-internals → Devices → Start Scan, lalu lihat kolom Address.",
          tersimpan ?? "",
        );
        const mac = isian && POLA_MAC.test(isian.trim()) ? isian.trim().toUpperCase().replaceAll("-", ":") : null;
        // MAC tidak pernah berubah → langsung simpan agar tidak ditanya lagi
        if (mac) simpanMac(device, mac);
        return mac;
      };
      const koneksiPromise = connectGanCube(penyediaMac);
      this.onStatus("Pilih kubus GAN di jendela Bluetooth…", "info");
      await this.siapkanTampilan(wadahPlayer);
      const conn = await koneksiPromise;

      this.#mulaiKoneksiBaru();
      this.gan = conn;
      this.statusDariKubus = true;
      this.faceletsTerakhir = null;
      if (perangkat) simpanMac(perangkat, conn.deviceMAC);
      conn.events$.subscribe((ev) => this.terimaEventGan(ev, conn));
      await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });

      this.onStatus(
        `Terhubung: ${conn.deviceName}. Gambar 3D mengikuti posisi kubus dan timer berhenti otomatis saat solved. ` +
          'Jika gambar berbeda dengan kubus di tanganmu, selesaikan kubusnya lalu tekan "Gambar salah? Reset".',
        "ok",
      );
      return true;
    } catch (err) {
      this.gan = null;
      // MAC tersimpan mungkin salah ketik → lupakan agar percobaan berikutnya bertanya lagi
      if (pakaiMacTersimpan && perangkat) simpanMac(perangkat, null);
      this.onStatus(pesanGalatKoneksi(err), "error");
      return false;
    }
  }

  // Publik agar bisa diuji dengan kubus GAN tiruan di Vitest
  terimaEventGan(ev, conn = this.gan) {
    if (conn !== this.gan) return; // event dari koneksi lama → abaikan
    if (ev.type === "MOVE") {
      // Status stiker yang tersimpan sekarang sudah usang
      this.faceletsTerakhir = null;
      this.terimaPutaran({ latestAlgLeaf: ev.move, timeStamp: ev.cubeTimestamp ?? undefined });
    } else if (ev.type === "FACELETS") {
      this.faceletsTerakhir = ev.facelets;
      this.onCekSolved();
    } else if (ev.type === "DISCONNECT") {
      this.gan = null;
      this.statusDariKubus = false;
      this.onStatus('Koneksi kubus terputus. Tekan "Hubungkan GAN" lagi.', "error");
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

  // Kubus baru: lupakan pelacakan & koreksi dari kubus sebelumnya
  #mulaiKoneksiBaru() {
    this.pattern = null;
    this.patternKnown = false;
    this.koreksiManual = false;
  }

  /**
   * Posisi kubus menurut sensornya (KPattern), atau null jika tidak tersedia.
   * QiYi: langsung dari cubing.js. GAN: dari status stiker terakhir (notasi Kociemba).
   */
  async polaSensor() {
    try {
      if (this.gan) {
        const data = faceletsKePolaData(this.faceletsTerakhir);
        return data && this.KPattern ? new this.KPattern(this.kpuzzle, data) : null;
      }
      if (this.statusDariKubus && this.puzzle) return await this.puzzle.getPattern();
    } catch {
      /* sensor tidak terbaca */
    }
    return null;
  }

  /**
   * Samakan pelacakan program + gambar 3D dengan posisi menurut sensor kubus, jadi
   * tombol "Kubus sudah solved" tidak wajib lagi. Dipanggil saat tidak sedang solve.
   * Tidak dijalankan setelah user mengoreksi manual (sensor dianggap salah).
   */
  async sinkronDariSensor() {
    if (this.koreksiManual) return false;
    const p = await this.polaSensor();
    if (!p) return false;
    if (this.patternKnown && this.pattern?.isIdentical(p)) return false; // sudah sama
    this.pattern = p;
    this.patternKnown = true;
    await this.tampilkanPola(p);
    return true;
  }

  /** Tampilkan posisi apa pun di gambar 3D: cari solusinya, lalu pasang kebalikannya sebagai setup. */
  async tampilkanPola(p) {
    if (!this.player) return;
    const giliran = (this.giliranTampil = (this.giliranTampil ?? 0) + 1);
    try {
      let setup = "";
      if (!p.experimentalIsSolved(OPSI_SOLVED)) {
        const { experimentalSolve3x3x3IgnoringCenters } = await import("cubing/search");
        setup = (await experimentalSolve3x3x3IgnoringCenters(p)).invert();
      }
      if (giliran !== this.giliranTampil) return; // sudah ada permintaan yang lebih baru
      this.player.experimentalSetupAlg = setup;
      this.player.alg = "";
    } catch (err) {
      this.onStatus(`Gambar 3D tidak bisa disamakan: ${err?.message ?? err}`, "error");
    }
  }

  // Koreksi manual: kubus fisik sekarang solved (dipakai jika gambar 3D / sensor salah)
  tandaiSolved() {
    try {
      this.pattern = this.kpuzzle.defaultPattern();
      this.patternKnown = true;
      this.koreksiManual = true; // jangan ditimpa lagi oleh sensor yang salah
      this.giliranTampil = (this.giliranTampil ?? 0) + 1; // batalkan sinkron 3D yang masih berjalan
      if (this.player) {
        this.player.experimentalSetupAlg = "";
        this.player.alg = "";
      }
      if (this.gan) {
        // GAN menyimpan status stiker di dalam kubus dan bisa melenceng; samakan ke solved
        const gan = this.gan;
        this.faceletsTerakhir = null;
        gan
          .sendCubeCommand({ type: "REQUEST_RESET" })
          .then(() => gan.sendCubeCommand({ type: "REQUEST_FACELETS" })) // perbarui indikator
          .catch(() => {});
        this.onStatus("Dikoreksi: status kubus GAN dan gambar 3D di-reset ke posisi solved.", "ok");
        return;
      }
      this.onStatus(
        this.statusDariKubus
          ? "Dikoreksi: gambar 3D dan pelacakan di-reset ke posisi solved."
          : "Kubus ditandai solved. Deteksi selesai otomatis aktif.",
        "ok",
      );
    } catch (err) {
      this.onStatus(`Gagal reset state: ${err?.message ?? err}`, "error");
    }
  }

  /**
   * Kondisi kubus dari dua sumber (untuk indikator & deteksi selesai):
   *  - sensor:   menurut kubus sendiri (QiYi/GAN). null = kubus tidak mengirim / data belum datang.
   *  - cadangan: menurut pelacakan program sejak "Kubus sudah solved". null = belum diaktifkan.
   *  - solved:   true jika salah satu sumber menyatakan solved.
   */
  async kondisi() {
    let sensor = null;
    let cadangan = null;
    try {
      if (this.gan) {
        sensor = this.faceletsTerakhir ? faceletsSolved(this.faceletsTerakhir) : null;
      } else if (this.statusDariKubus && this.puzzle) {
        sensor = (await this.puzzle.getPattern()).experimentalIsSolved(OPSI_SOLVED);
      }
    } catch {
      sensor = null;
    }
    try {
      if (this.patternKnown && this.pattern) cadangan = this.pattern.experimentalIsSolved(OPSI_SOLVED);
    } catch {
      cadangan = null;
    }
    return { sensor, cadangan, solved: sensor === true || cadangan === true };
  }

  // Apakah kubus sekarang solved? (async karena status dibaca dari kubus)
  // Solved menurut sensor kubus ATAU pelacakan cadangan (lihat kondisi())
  async cekSolved() {
    return (await this.kondisi()).solved;
  }

  // Publik (bukan #privat) agar bisa diuji dengan kubus tiruan di Vitest
  terimaPutaran(e) {
    // Pakai timestamp dari kubus jika ada (lebih akurat: putaran yang terlambat
    // dikirim ulang tetap punya waktu aslinya). Jika tidak ada, t dibiarkan kosong —
    // jangan diisi jam browser, supaya dua jam tidak tercampur dalam satu solve
    // (pilihTimestamp() lalu memakai jam browser untuk seluruh solve).
    const tLokal = performance.now();
    const t = Number.isFinite(e.timeStamp) ? e.timeStamp : undefined;
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
        if (this.gan) {
          // GAN: minta status stiker terbaru (dicek lagi saat event FACELETS tiba)
          this.gan.sendCubeCommand({ type: "REQUEST_FACELETS" }).catch(() => {});
        }
        // Cek sekarang juga: pelacakan cadangan tidak perlu menunggu data dari kubus
        this.onCekSolved();
      }, 0);
    }
  }

  putuskan() {
    try {
      this.puzzle?.disconnect();
      this.gan?.disconnect();
    } catch {
      /* abaikan */
    }
    this.puzzle = null;
    this.gan = null;
    this.statusDariKubus = false;
    this.onStatus("Koneksi diputus.", "info");
  }
}
