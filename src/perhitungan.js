// Titik masuk halaman Detail Perhitungan (perhitungan.html).
// Menampilkan 7 langkah Mamdani dengan angka asli dari infer().
import "./style.css";
import { infer } from "./fuzzy/mamdani.js";
import { VARIABEL_INPUT, VARIABEL_OUTPUT } from "./fuzzy/config.js";
import { renderSteps, renderRules, gambarSemua } from "./ui/renderSteps.js";
import { ambilRiwayat, ambilInputTerakhir } from "./storage/history.js";
import { r, esc } from "./ui/format.js";

const $ = (sel) => document.querySelector(sel);
const CONTOH ={ tps: 3.5, gerakan: 70, jeda: 20, waktu: 20, sumber: "contoh" };

const elSim = {
  input: $("#sim-input"),
  fuzz: $("#sim-fuzz"),
  rules: $("#sim-rules"),
  jumlahAktif: $("#sim-jumlah-aktif"),
  komposisi: $("#sim-komposisi"),
  grafikOutput: $("#sim-grafik-output"),
  centroid: $("#sim-centroid"),
  output: $("#sim-output"),
};

$("#sim-legenda").innerHTML = Object.entries(VARIABEL_OUTPUT.skor.himpunan)
  .map(([n, h]) => `<span class="leg" style="--c:${h.warna}">${n}</span>`)
  .join("");

let dataSim = null; // { tps, gerakan, jeda, waktu?, sumber }
let hasilSim = null;

// Ringkasan skor di bagian atas (langsung terlihat tanpa menggulir)
function renderRingkas(h) {
  const warna = VARIABEL_OUTPUT.skor.himpunan[h.kategori].warna;
  const aktif = h.rules.filter((rl) => rl.alpha > 0).length;
  $("#ringkas-skor").innerHTML = `
    <span class="catatan">Skor akhir</span>
    <span class="skor-angka" style="--c:${warna}">${h.skor.toFixed(2)}</span>
    <span class="kategori" style="--c:${warna}">${esc(h.kategori)}</span>
    <dl class="ringkas-mini">
      <div><dt>TPS</dt><dd>${r(h.input.tps, 3)}</dd></div>
      <div><dt>Gerakan</dt><dd>${r(h.input.gerakan, 3)}</dd></div>
      <div><dt>Jeda</dt><dd>${r(h.input.jeda, 3)}%</dd></div>
      <div><dt>Rule aktif</dt><dd>${aktif}</dd></div>
    </dl>`;
}

function hitung(data) {
  dataSim = data;
  hasilSim = infer({ tps: data.tps, gerakan: data.gerakan, jeda: data.jeda });
  renderRingkas(hasilSim);
  renderSteps(elSim, hasilSim, { semuaRule: $("#semua-rule").checked, waktu: data.waktu, sumber: data.sumber });
}

$("#semua-rule").addEventListener("change", (e) => {
  if (hasilSim) renderRules(elSim, hasilSim, e.target.checked);
});

// ---------- Sumber: Solve terakhir ----------
// Prioritas: data di URL (link dari Beranda / Cara Kerja) → lastInput → contoh
function bacaDataTerakhir() {
  const q = new URLSearchParams(location.search);
  const nilai = ["tps", "gerakan", "jeda"].map((k) => Number(q.get(k)));
  if (q.has("tps") && nilai.every(Number.isFinite)) {
    const sumber = q.get("sumber") || "beranda";
    const waktu = q.has("waktu") ? Number(q.get("waktu")) : undefined;
    const info = sumber === "contoh" ? "Kasus contoh perhitungan manual (TPS 3.5, gerakan 70, jeda 20%)." : `Penilaian yang dibuka dari Beranda (sumber: ${sumber}).`;
    return { data: { tps: nilai[0], gerakan: nilai[1], jeda: nilai[2], waktu, sumber }, info };
  }
  const t = ambilInputTerakhir();
  if (t) return { data: t, info: `Penilaian terakhir (sumber: ${t.sumber ?? "–"}).` };
  return { data: CONTOH, info: "Belum ada solve yang dinilai. Menampilkan contoh: TPS 3.5, gerakan 70, jeda 20%." };
}

// ---------- Sumber: Dari riwayat ----------
const riwayat = ambilRiwayat();
const pilihRiwayat = $("#pilih-riwayat");
if (riwayat.length === 0) {
  pilihRiwayat.innerHTML = `<option>Riwayat masih kosong</option>`;
  pilihRiwayat.disabled = true;
} else {
  pilihRiwayat.innerHTML = riwayat
    .map((it) => {
      const jam = new Date(it.waktuISO).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      return `<option value="${esc(it.id)}">${esc(jam)} · ${esc(it.sumber)} · skor ${r(it.skor, 1)} (${esc(it.kategori)})</option>`;
    })
    .join("");
}
function dataDariRiwayat() {
  const it = riwayat.find((x) => x.id === pilihRiwayat.value);
  return it && { tps: it.tps, gerakan: it.gerakan, jeda: it.jeda, waktu: it.waktu, sumber: it.sumber };
}
pilihRiwayat.addEventListener("change", () => {
  const d = dataDariRiwayat();
  if (d) hitung(d);
});

// ---------- Sumber: Coba sendiri (slider) ----------
const SLIDER = {
  tps: { semesta: VARIABEL_INPUT.tps.semesta, step: 0.01 },
  gerakan: { semesta: VARIABEL_INPUT.gerakan.semesta, step: 1 },
  jeda: { semesta: VARIABEL_INPUT.jeda.semesta, step: 0.1 },
};
for (const [k, s] of Object.entries(SLIDER)) {
  for (const el of [$(`[data-slider="${k}"]`), $(`[data-angka="${k}"]`)]) {
    el.min = s.semesta[0];
    el.max = s.semesta[1];
    el.step = s.step;
  }
}
function isiSlider({ tps, gerakan, jeda }) {
  const nilai = { tps, gerakan: Math.round(gerakan), jeda };
  for (const k of Object.keys(SLIDER)) {
    const [min, max] = SLIDER[k].semesta;
    const v = Math.min(max, Math.max(min, nilai[k]));
    $(`[data-slider="${k}"]`).value = v;
    $(`[data-angka="${k}"]`).value = +v.toFixed(2);
  }
}
function dataDariSlider() {
  const ambil = (k) => Number($(`[data-slider="${k}"]`).value);
  return { tps: ambil("tps"), gerakan: ambil("gerakan"), jeda: ambil("jeda"), waktu: undefined, sumber: "coba sendiri" };
}
// Slider digeser → angka & hasil langsung diperbarui
document.querySelectorAll("[data-slider]").forEach((el) =>
  el.addEventListener("input", () => {
    $(`[data-angka="${el.dataset.slider}"]`).value = +Number(el.value).toFixed(2);
    hitung(dataDariSlider());
  }),
);
// Angka diketik → slider ikut (nilai di luar semesta dibatasi)
document.querySelectorAll("[data-angka]").forEach((el) =>
  el.addEventListener("input", () => {
    const v = Number(el.value);
    if (el.value === "" || !Number.isFinite(v)) return;
    $(`[data-slider="${el.dataset.angka}"]`).value = v;
    hitung(dataDariSlider());
  }),
);

// ---------- Tab sumber data ----------
function pilihMode(mode) {
  document.querySelectorAll(".segmen [data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
  document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== mode));
  if (mode === "terakhir") {
    const t = bacaDataTerakhir();
    $("#info-terakhir").textContent = t.info;
    hitung(t.data);
  } else if (mode === "riwayat") {
    const d = dataDariRiwayat();
    if (d) hitung(d);
  } else {
    // Slider dimulai dari data yang sedang tampil
    isiSlider(dataSim ?? CONTOH);
    hitung(dataDariSlider());
  }
}
document.querySelectorAll(".segmen [data-mode]").forEach((b) => b.addEventListener("click", () => pilihMode(b.dataset.mode)));

// ---------- Gambar ulang grafik saat ukuran layar / tema berubah ----------
let tunda = 0;
window.addEventListener("resize", () => {
  clearTimeout(tunda);
  tunda = setTimeout(() => hasilSim && gambarSemua(elSim, hasilSim), 120);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => hasilSim && gambarSemua(elSim, hasilSim));

pilihMode("terakhir");
