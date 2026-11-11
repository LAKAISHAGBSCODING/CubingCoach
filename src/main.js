// Titik masuk halaman utama: menghubungkan modul fuzzy, smart cube, UI, dan riwayat.
// Catatan: teks yang terlihat pengguna di halaman ini sengaja tidak memakai istilah
// teknis fuzzy. Penjelasan lengkap metode ada di halaman Cara Kerja (metode.html).
import "./style.css";
import { infer } from "./fuzzy/mamdani.js";
import { SolveTracker, hitungStatistik } from "./cube/solveTracker.js";
import { SmartCube, bluetoothDidukung } from "./cube/smartcube.js";
import { buatAcakan } from "./cube/scramble.js";
import { renderResult } from "./ui/renderResult.js";
import { renderHistory } from "./ui/renderHistory.js";
import { ambilRiwayat, tambahRiwayat, hapusRiwayat, simpanInputTerakhir } from "./storage/history.js";

const $ = (sel) => document.querySelector(sel);

// =====================================================================
// Hitung penilaian lalu tampilkan hasil
// =====================================================================
function nilaiDanTampilkan(input, info, { simpan = true } = {}) {
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
  $("#hasil-bagian").scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (tracker.state === "solving") perbaruiDaftarGerakan();
  },
  // Dipanggil setelah tiap kelompok putaran: cek ke kubus apakah sudah solved
  onCekSolved: async () => {
    if (tracker.state !== "solving" || tracker.catatan.length <= 1) return;
    tracker.cobaSelesaiOtomatis(await cube.cekSolved());
  },
});

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
    if (state === "solving") jalankanTimer();
  },
  onSelesai: (h) => {
    tampilkanLive(h.waktu, h.gerakan);
    setStatus("Menilai solve…", "info");
    nilaiDanTampilkan(
      { tps: h.tps, gerakan: h.gerakan, jeda: h.jeda },
      { sumber: "smart cube", waktu: h.waktu, moves: h.moves.join(" ") },
    );
    setStatus(
      h.otomatis ? `Kubus solved! ${h.gerakan} gerakan dalam ${h.waktu.toFixed(2)} s.` : "Solve diakhiri manual.",
      "ok",
    );
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
function perbaruiDaftarGerakan() {
  $("#daftar-gerakan").textContent = tracker.catatan.map((c) => c.move).join(" ");
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

// --- tombol ---
if (!bluetoothDidukung()) {
  btn.hubung.disabled = true;
  setStatus(
    window.isSecureContext
      ? "Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge (desktop atau Android), atau pakai Input manual."
      : "Web Bluetooth butuh HTTPS atau localhost. Buka lewat `npm run dev`, atau pakai Input manual.",
    "error",
  );
} else {
  // Muat modul bluetooth lebih awal; jika gagal, tombol akan mencoba lagi
  cube.pramuat().catch(() => (cube.modulBluetooth = null));
}

btn.hubung.addEventListener("click", async () => {
  btn.hubung.disabled = true;
  const ok = await cube.hubungkan($("#player"));
  btn.hubung.disabled = false;
  if (ok) {
    btn.hubung.textContent = "Hubungkan ulang";
    btn.solved.disabled = false;
    btn.mulai.disabled = tracker.state !== "idle";
  }
});

btn.solved.addEventListener("click", () => cube.tandaiSolved());

btn.acak.addEventListener("click", () => {
  const el = $("#acakan");
  el.textContent = buatAcakan().join(" ");
  el.hidden = false;
});

btn.mulai.addEventListener("click", () => {
  tracker.mulai();
  if (!cube.deteksiOtomatis) {
    setStatus('Deteksi selesai otomatis mati (belum menekan "Kubus sudah solved"). Akhiri dengan tombol "Selesai".', "info");
  }
});

btn.selesai.addEventListener("click", () => {
  if (tracker.state === "ready") setStatus("Solve dibatalkan (belum ada gerakan).", "info");
  tracker.selesai(false);
});

// Tampilan awal
renderHistory($("#riwayat"), ambilRiwayat());

// Ekspor untuk debugging di console (opsional)
window.cubingCoach = { infer, hitungStatistik };
