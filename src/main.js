// Titik masuk halaman utama: menghubungkan modul fuzzy, smart cube, UI, dan riwayat.
// Catatan: teks yang terlihat pengguna di halaman ini sengaja tidak memakai istilah
// teknis fuzzy. Penjelasan lengkap metode ada di halaman Cara Kerja (metode.html).
import "./style.css";
import { infer } from "./fuzzy/mamdani.js";
import { SolveTracker, hitungStatistik } from "./cube/solveTracker.js";
import { SmartCube, bluetoothDidukung } from "./cube/smartcube.js";
import { buatAcakan } from "./cube/scramble.js";
import { PanduanAcak, teks as teksGerakan, arah as arahGerakan } from "./cube/panduanAcak.js";
import { tembakKonfeti } from "./ui/konfeti.js";
import { renderResult } from "./ui/renderResult.js";
import { renderHistory } from "./ui/renderHistory.js";
import { ambilRiwayat, tambahRiwayat, hapusRiwayat, simpanInputTerakhir } from "./storage/history.js";

const $ = (sel) => document.querySelector(sel);

// =====================================================================
// Hitung penilaian lalu tampilkan hasil
// =====================================================================
function nilaiDanTampilkan(input, info, { simpan = true, gulir = true } = {}) {
  const hasil = infer(input);
  renderResult($("#hasil"), hasil, info);

  // Link ke halaman Detail Perhitungan membawa data penilaian yang sedang tampil
  const q = new URLSearchParams({
    tps: String(input.tps),
    gerakan: String(input.gerakan),
    jeda: String(input.jeda),
    sumber: info.sumber,
  });
  if (Number.isFinite(info.waktu)) q.set("waktu", String(info.waktu));
  const link = $("#link-cara");
  link.href = `perhitungan.html?${q}`;
  link.hidden = false;

  if (simpan) {
    simpanInputTerakhir({ ...input, waktu: info.waktu, sumber: info.sumber });
    const { ok } = tambahRiwayat(hasil, info);
    if (!ok) setStatus("Riwayat tidak bisa disimpan (penyimpanan browser diblokir).", "error");
    renderHistory($("#riwayat"), ambilRiwayat());
  }
  if (gulir) $("#hasil-bagian").scrollIntoView({ behavior: "smooth", block: "start" });
  return hasil;
}

// =====================================================================
// INPUT MANUAL
// =====================================================================
const form = $("#form-manual");

// Kartu input manual disembunyikan dulu; muncul setelah tombol diklik
function tampilkanManual(buka) {
  $("#manual").hidden = !buka;
  $("#grid-atas").classList.toggle("satu", !buka);
  const tombol = $("#btn-buka-manual");
  tombol.setAttribute("aria-expanded", String(buka));
  tombol.textContent = buka ? "Sembunyikan manual" : "Input manual";
  if (buka) {
    $("#manual").scrollIntoView({ behavior: "smooth", block: "nearest" });
    form.elements.waktu.focus({ preventScroll: true });
  }
}
$("#btn-buka-manual").addEventListener("click", () => tampilkanManual($("#manual").hidden));
$("#btn-tutup-manual").addEventListener("click", () => tampilkanManual(false));

function bacaForm() {
  const ambil = (n) => form.elements[n].value.trim();
  return { waktu: Number(ambil("waktu")), gerakan: Number(ambil("gerakan")), jeda: Number(ambil("jeda")), mentah: ambil };
}

// Validasi: waktu > 0, gerakan > 0, jeda 0–100. Mengembalikan daftar galat per field.
function validasi({ waktu, gerakan, jeda, mentah }) {
  const galat = {};
  if (mentah("waktu") === "" || !Number.isFinite(waktu) || waktu <= 0) galat.waktu = "Waktu harus lebih dari 0.";
  if (mentah("gerakan") === "" || !Number.isFinite(gerakan) || gerakan <= 0) galat.gerakan = "Jumlah gerakan harus lebih dari 0.";
  if (mentah("jeda") === "" || !Number.isFinite(jeda) || jeda < 0 || jeda > 100) galat.jeda = "Rasio jeda harus 0–100.";
  return galat;
}

function tampilkanGalat(galat) {
  for (const n of ["waktu", "gerakan", "jeda"]) {
    form.elements[n].setAttribute("aria-invalid", galat[n] ? "true" : "false");
    form.querySelector(`[data-untuk="${n}"]`).textContent = galat[n] ?? "";
  }
}

// TPS otomatis saat user mengetik
form.addEventListener("input", () => {
  const d = bacaForm();
  const ok = d.waktu > 0 && d.gerakan > 0;
  $("#tps-otomatis").textContent = ok ? (d.gerakan / d.waktu).toFixed(2) : "–";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const d = bacaForm();
  const galat = validasi(d);
  tampilkanGalat(galat);
  if (Object.keys(galat).length) return;
  nilaiDanTampilkan(
    { tps: d.gerakan / d.waktu, gerakan: d.gerakan, jeda: d.jeda },
    { sumber: "manual", waktu: d.waktu },
  );
});

// =====================================================================
// RIWAYAT
// =====================================================================
$("#btn-hapus").addEventListener("click", () => {
  if (!confirm("Hapus semua riwayat solve?")) return;
  hapusRiwayat();
  renderHistory($("#riwayat"), ambilRiwayat());
});

// Tombol "Lihat": tampilkan ulang hasil dari data riwayat (tidak disimpan ulang)
$("#riwayat").addEventListener("click", (e) => {
  const id = e.target.closest("[data-lihat]")?.dataset.lihat;
  const it = ambilRiwayat().find((x) => x.id === id);
  if (!it) return;
  nilaiDanTampilkan(
    { tps: it.tps, gerakan: it.gerakan, jeda: it.jeda },
    { sumber: it.sumber, waktu: it.waktu },
    { simpan: false },
  );
});

// =====================================================================
// SMART CUBE
// =====================================================================
const btn = {
  hubung: $("#btn-hubung"),
  hubungGan: $("#btn-hubung-gan"),
  solved: $("#btn-solved"),
  acak: $("#btn-acak"),
  mulai: $("#btn-mulai"),
  selesai: $("#btn-selesai"),
};

function setStatus(pesan, jenis = "info") {
  const el = $("#bt-status");
  el.textContent = pesan;
  el.dataset.jenis = jenis;
}

const cube = new SmartCube({
  onStatus: setStatus,
  onPutaran: (move, t, tLokal) => {
    tracker.putaran(move, t, undefined, tLokal);
    if (tracker.state === "solving") perbaruiDaftarGerakan(move);
    else if (tracker.state === "idle") ikutiPanduan(move);
  },
  // Dipanggil setelah tiap kelompok putaran (dan tiap status stiker baru dari kubus GAN)
  onCekSolved: async () => {
    // Saat tidak sedang solve, samakan gambar 3D & pelacakan dengan sensor kubus
    if (tracker.state === "idle") await cube.sinkronDariSensor();
    const k = await cube.kondisi();
    tampilkanKondisiKubus(k);
    if (tracker.state === "solving" && tracker.catatan.length > 1) tracker.cobaSelesaiOtomatis(k.solved);
  },
});

// Indikator posisi kubus. Timer berhenti jika sensor ATAU pelacakan program menyatakan solved.
function tampilkanKondisiKubus({ sensor, cadangan, solved }) {
  const teks = (v) => (v === true ? "solved ✓" : "teracak");
  const el = $("#kondisi-kubus");
  el.hidden = false;
  el.dataset.solved = String(solved);
  // Biasanya keduanya sama → cukup satu keterangan; jika berbeda, tampilkan keduanya
  el.textContent =
    sensor !== null && cadangan !== null && sensor !== cadangan
      ? `Posisi kubus — sensor: ${teks(sensor)} · pelacakan program: ${teks(cadangan)}`
      : `Posisi kubus: ${teks(solved)}`;
}

const tracker = new SolveTracker({
  onBerubah: (state) => {
    const el = $("#live-state");
    el.textContent = state;
    el.dataset.state = state;
    btn.mulai.disabled = !cube.terhubung || state !== "idle";
    btn.selesai.disabled = state === "idle";
    if (state === "ready") {
      resetLive();
      setStatus("Siap. Timer mulai pada putaran pertama.", "info");
    }
    if (state === "solving") {
      sembunyikanPanduan();
      jalankanTimer();
    }
  },
  onSelesai: (h) => {
    tampilkanLive(h.waktu, h.gerakan);
    setStatus("Menilai solve…", "info");
    const hasil = nilaiDanTampilkan(
      { tps: h.tps, gerakan: h.gerakan, jeda: h.jeda },
      { sumber: "smart cube", waktu: h.waktu, moves: h.moves.join(" ") },
      { gulir: !h.otomatis },
    );
    setStatus(
      h.otomatis ? `Kubus solved! ${h.gerakan} gerakan dalam ${h.waktu.toFixed(2)} s.` : "Solve diakhiri manual.",
      "ok",
    );
    // Selesai otomatis (kubus benar-benar solved) → layar perayaan
    if (h.otomatis) tampilkanSelebrasi(h, hasil);
  },
});

// --- angka live ---
function tampilkanLive(waktu, gerakan) {
  $("#live-waktu").textContent = waktu.toFixed(2);
  $("#live-gerakan").textContent = gerakan;
  $("#live-tps").textContent = waktu > 0 ? (gerakan / waktu).toFixed(2) : "0.00";
}
function resetLive() {
  tampilkanLive(0, 0);
  $("#daftar-gerakan").textContent = "";
}
// Daftar gerakan selama solve; gerakan terbaru diberi animasi "muncul"
function perbaruiDaftarGerakan(terbaru) {
  const el = $("#daftar-gerakan");
  const lama = tracker.catatan.slice(0, -1).map((c) => c.move).join(" ");
  el.textContent = lama ? lama + " " : "";
  const span = document.createElement("span");
  span.className = "gerak-baru";
  span.textContent = terbaru;
  el.append(span);
}
function jalankanTimer() {
  // Timer tampilan memakai jam browser (waktu akhir yang dinilai tetap dari timestamp putaran)
  const t0 = tracker.catatan[0]?.tLokal ?? performance.now();
  const langkah = () => {
    if (tracker.state !== "solving") return;
    tampilkanLive((performance.now() - t0) / 1000, tracker.catatan.length);
    requestAnimationFrame(langkah);
  };
  requestAnimationFrame(langkah);
}

// Jalankan ulang animasi CSS pada sebuah elemen
function animasikan(el, kelas) {
  el.classList.remove(kelas);
  void el.offsetWidth; // paksa reflow agar animasi bisa diulang
  el.classList.add(kelas);
}

// =====================================================================
// PANDUAN ACAKAN — tampilkan gerakan berikutnya & ikuti putaran kubus
// =====================================================================
let panduan = null;

function tampilkanPanduan() {
  const wadah = $("#panduan");
  wadah.hidden = false;
  const b = panduan.berikutnya;
  const kotak = $("#gerak-besar");

  // Daftar langkah: selesai (redup), sekarang (disorot), nanti
  $("#acakan").innerHTML = panduan.tampilan
    .map((l) => `<span class="langkah-acak" data-status="${l.status}">${l.teks}</span>`)
    .join(" ");

  if (!b) {
    kotak.dataset.mode = "selesai";
    $("#gerak-teks").textContent = "✓";
    $("#gerak-arah").textContent = "Acakan selesai!";
    $("#gerak-info").textContent = cube.terhubung
      ? "Timer mulai otomatis pada putaran pertama. Semangat!"
      : 'Klik "Mulai solve" lalu selesaikan kubusnya.';
    return;
  }
  kotak.dataset.mode = b.koreksi ? "koreksi" : "normal";
  kotak.dataset.arah = b.jumlah === 1 ? "cw" : b.jumlah === 3 ? "ccw" : "dua";
  $("#gerak-teks").textContent = teksGerakan(b);
  $("#gerak-arah").textContent = b.koreksi ? `Salah putar! Kembalikan dulu: ${arahGerakan(b)}` : arahGerakan(b);
  const n = panduan.langkah.length;
  $("#gerak-info").textContent = cube.terhubung
    ? `Langkah ${Math.min(panduan.i + 1, n)} dari ${n} · ikuti di kubus, langkah berikutnya muncul otomatis`
    : `Acakan ${n} gerakan · hubungkan kubus agar langkah diikuti otomatis`;
}

function sembunyikanPanduan() {
  $("#panduan").hidden = true;
  panduan = null;
}

function ikutiPanduan(move) {
  if (!panduan || panduan.selesai) return;
  const hasil = panduan.terima(move);
  if (hasil === "abaikan") return;
  tampilkanPanduan();
  animasikan($("#gerak-besar"), hasil === "salah" ? "goyang" : "denyut");
  if (hasil === "selesai") {
    setStatus("Acakan selesai! Timer mulai otomatis pada putaran pertama.", "ok");
    // Langsung siap: timer berjalan begitu kubus mulai diputar
    if (cube.terhubung && tracker.state === "idle") tracker.mulai();
  }
}

// =====================================================================
// LAYAR PERAYAAN saat kubus solved
// =====================================================================
let hentikanKonfeti = () => {};

function tampilkanSelebrasi(h, hasil) {
  const layar = $("#selebrasi");
  $("#sel-gerakan").textContent = h.gerakan;
  $("#sel-tps").textContent = h.tps.toFixed(2);
  $("#sel-skor").textContent = hasil.skor.toFixed(1);
  const kat = $("#sel-kat");
  kat.textContent = hasil.kategori;
  kat.dataset.kategori = hasil.kategori;
  layar.hidden = false;
  animasikan(layar, "muncul");

  // Angka waktu "menghitung naik" sampai waktu akhir
  const el = $("#sel-waktu-angka");
  const mulai = performance.now();
  const durasi = 700;
  const hitung = (t) => {
    const p = Math.min(1, (t - mulai) / durasi);
    el.textContent = (h.waktu * (1 - (1 - p) ** 3)).toFixed(2);
    if (p < 1 && !layar.hidden) requestAnimationFrame(hitung);
  };
  requestAnimationFrame(hitung);

  hentikanKonfeti = tembakKonfeti($("#konfeti"));
  $("#sel-tutup").focus({ preventScroll: true });
}

function tutupSelebrasi() {
  const layar = $("#selebrasi");
  if (layar.hidden) return;
  layar.hidden = true;
  hentikanKonfeti();
  $("#hasil-bagian").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#sel-tutup").addEventListener("click", tutupSelebrasi);
$("#selebrasi").addEventListener("click", (e) => e.target.id === "selebrasi" && tutupSelebrasi());
document.addEventListener("keydown", (e) => e.key === "Escape" && tutupSelebrasi());

// =====================================================================
// TOMBOL
// =====================================================================
if (!bluetoothDidukung()) {
  btn.hubung.disabled = true;
  btn.hubungGan.disabled = true;
  setStatus(
    window.isSecureContext
      ? "Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge (desktop atau Android), atau pakai Input manual."
      : "Web Bluetooth butuh HTTPS atau localhost. Buka lewat `npm run dev`, atau pakai Input manual.",
    "error",
  );
} else {
  // Muat modul bluetooth lebih awal; jika gagal, tombol akan mencoba lagi
  cube.pramuat().catch(() => (cube.modulBluetooth = null));
  cube.pramuatGan().catch(() => (cube.modulGan = null));
}

// Dua jalur koneksi: cubing.js (QiYi, GAN lama, dll.) dan gan-web-bluetooth (GAN model baru).
// Harus tombol terpisah, karena satu klik hanya boleh membuka satu jendela pemilih Bluetooth.
async function hubungkanDengan(tombol, cara) {
  btn.hubung.disabled = btn.hubungGan.disabled = true;
  cube.putuskan(); // tutup koneksi lama (jika ada) sebelum membuka yang baru
  const ok = await cara();
  btn.hubung.disabled = btn.hubungGan.disabled = false;
  btn.hubung.textContent = "Hubungkan kubus";
  btn.hubungGan.textContent = "Hubungkan GAN";
  if (ok) {
    tombol.textContent = "Hubungkan ulang";
    btn.solved.disabled = false;
    if (panduan) tampilkanPanduan(); // perbarui keterangan panduan
  }
  btn.mulai.disabled = !cube.terhubung || tracker.state !== "idle";
}
btn.hubung.addEventListener("click", () => hubungkanDengan(btn.hubung, () => cube.hubungkan($("#player"))));
btn.hubungGan.addEventListener("click", () => hubungkanDengan(btn.hubungGan, () => cube.hubungkanGan($("#player"))));

// Koreksi manual: hanya jika gambar 3D berbeda dengan kubus di tangan
btn.solved.addEventListener("click", async () => {
  cube.tandaiSolved();
  tampilkanKondisiKubus(await cube.kondisi());
});

btn.acak.addEventListener("click", async () => {
  panduan = new PanduanAcak(buatAcakan());
  tampilkanPanduan();
  animasikan($("#gerak-besar"), "denyut");
  if (cube.terhubung) {
    const k = await cube.kondisi();
    setStatus(
      k.solved
        ? "Ikuti acakan di bawah. Langkah berikutnya muncul otomatis setiap kamu memutar kubus."
        : "Kubus belum solved, jadi hasil acakan tidak standar — tetap bisa diikuti. Untuk acakan resmi, selesaikan kubusnya dulu.",
      k.solved ? "info" : "error",
    );
  }
});

btn.mulai.addEventListener("click", () => {
  sembunyikanPanduan();
  tracker.mulai();
  if (!cube.deteksiOtomatis) {
    setStatus('Deteksi selesai otomatis mati (kubus ini tidak mengirim posisinya). Tekan "Gambar salah? Reset" saat kubus solved, atau akhiri dengan tombol "Selesai".', "info");
  }
});

btn.selesai.addEventListener("click", () => {
  if (tracker.state === "ready") setStatus("Solve dibatalkan (belum ada gerakan).", "info");
  tracker.selesai(false);
});

// Tampilan awal
renderHistory($("#riwayat"), ambilRiwayat());

// Ekspor untuk debugging di console (opsional)
window.cubingCoach = { infer, hitungStatistik, cube, tracker };
