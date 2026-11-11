// Titik masuk halaman Cara Kerja (metode.html) — penjelasan teori.
// Simulasi interaktif ada di halaman terpisah: perhitungan.html.
import "./style.css";
import { VARIABEL_INPUT, VARIABEL_OUTPUT, RULES, LANGKAH_CENTROID, AMBANG_REKOMENDASI } from "./fuzzy/config.js";
import {
  renderDemoCrisp,
  renderTimeline,
  renderVariabel,
  gambarVariabel,
  renderRule,
  renderRekomendasi,
  renderReferensi,
  renderTim,
} from "./ui/renderMethodPage.js";
// Kode sumber asli ditampilkan apa adanya (Vite "?raw"), jadi selalu sama dengan yang dijalankan
import srcMembership from "./fuzzy/membership.js?raw";
import srcMamdani from "./fuzzy/mamdani.js?raw";

const $ = (sel) => document.querySelector(sel);

// Angka-angka di teks diambil dari config agar selalu sinkron
const [zMin, zMax] = VARIABEL_OUTPUT.skor.semesta;
document.querySelectorAll("[data-jumlah-rule]").forEach((el) => (el.textContent = RULES.length));
document.querySelectorAll("[data-sampel]").forEach((el) => (el.textContent = `${zMin}, ${zMin + LANGKAH_CENTROID}, …, ${zMax}`));
document.querySelectorAll("[data-ambang]").forEach((el) => (el.textContent = AMBANG_REKOMENDASI));
$('[data-stat="input"]').textContent = Object.keys(VARIABEL_INPUT).length;
$('[data-stat="rule"]').textContent = RULES.length;
$('[data-stat="sampel"]').textContent = Math.round((zMax - zMin) / LANGKAH_CENTROID) + 1;

renderDemoCrisp($("#demo-crisp"));
renderTimeline($("#timeline-contoh"), $("#rumus-statistik"));
renderVariabel($("#daftar-variabel"));
renderRule($("#tabel-poin"), $("#matriks-rule"));
renderRekomendasi($("#tabel-rekomendasi"));
renderReferensi($("#daftar-referensi"));
renderTim($("#daftar-tim"));

// Potongan kode: fungsi trap() saja dari membership.js
{
  const awal = srcMembership.indexOf("// Fungsi keanggotaan trapesium");
  const akhir = srcMembership.indexOf("\n}\n", srcMembership.indexOf("export function trap")) + 2;
  $("#kode-trap").textContent = srcMembership.slice(Math.max(0, awal), akhir);
  $("#kode-infer").textContent = srcMamdani;
}

// Gambar ulang grafik saat ukuran layar / tema berubah
let tunda = 0;
window.addEventListener("resize", () => {
  clearTimeout(tunda);
  tunda = setTimeout(() => gambarVariabel($("#daftar-variabel")), 120);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => gambarVariabel($("#daftar-variabel")));

// Konten dibangkitkan setelah halaman dimuat, jadi lompat ulang ke anchor jika ada
if (location.hash) {
  requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
}
