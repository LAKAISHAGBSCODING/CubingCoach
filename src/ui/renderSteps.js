// Menampilkan setiap tahap perhitungan Mamdani dengan angka asli dari infer().
// Dipakai oleh bagian "Simulasi Perhitungan" di halaman Cara Kerja.
import { VARIABEL_INPUT, VARIABEL_OUTPUT, LANGKAH_CENTROID } from "../fuzzy/config.js";
import { clamp } from "../fuzzy/membership.js";
import { gambarKeanggotaan, gambarOutput } from "./charts.js";
import { renderResult } from "./renderResult.js";
import { f, r, esc, badge } from "./format.js";

const NAMA_VAR = ["tps", "gerakan", "jeda"];

// Uraian rumus trapesium dengan angka yang disubstitusi.
// Untuk 0 < μ < 1 ditampilkan lengkap: μ_nama(x) = (…) / (…) = hasil
export function uraianTrap(nama, x, [a, b, c, d], mu) {
  const X = r(x, 3);
  if (mu === 0) return x <= a ? `${X} ≤ ${a} → 0` : `${X} ≥ ${d} → 0`;
  if (mu === 1) return `${b} ≤ ${X} ≤ ${c} → 1`;
  const rumus = x < b ? `(${X} − ${a}) / (${b} − ${a})` : `(${d} − ${X}) / (${d} − ${c})`;
  return `μ_${nama}(${X}) = ${rumus} = ${f(mu)}`;
}

// Langkah 1 — tabel input tegas
function htmlInput(hasil, waktu) {
  const baris = NAMA_VAR.map((k) => {
    const v = VARIABEL_INPUT[k];
    const x = hasil.input[k];
    const xc = clamp(x, v.semesta);
    let ket = `semesta [${v.semesta.join(", ")}]`;
    if (k === "tps" && Number.isFinite(waktu) && waktu > 0) {
      ket = `gerakan ÷ waktu = ${r(hasil.input.gerakan, 3)} ÷ ${r(waktu, 3)} = ${f(x)}`;
    }
    if (xc !== x) ket += ` · di-clamp dari ${r(x, 3)} ke batas semesta`;
    return `<tr><td>${esc(v.label)} <span class="catatan">(${esc(v.satuan)})</span></td>
      <td class="num"><b>${f(xc)}</b></td><td class="mono bungkus">${esc(ket)}</td></tr>`;
  }).join("");
  const baris_waktu = Number.isFinite(waktu)
    ? `<tr><td>Waktu solve <span class="catatan">(detik)</span></td><td class="num">${f(waktu)}</td>
       <td class="catatan">hanya untuk menghitung TPS, bukan input fuzzy</td></tr>`
    : "";
  return `<div class="tabel-wrap"><table>
    <thead><tr><th>Variabel</th><th class="num">Nilai tegas</th><th>Keterangan</th></tr></thead>
    <tbody>${baris}${baris_waktu}</tbody></table></div>`;
}

// Langkah 2 — grafik + tabel μ untuk satu variabel input
function htmlFuzz(k, hasil) {
  const v = VARIABEL_INPUT[k];
  const x = clamp(hasil.input[k], v.semesta);
  const legenda = Object.entries(v.himpunan)
    .map(([n, h]) => `<span class="leg" style="--c:${h.warna}">${esc(n)}</span>`)
    .join("");
  const baris = Object.entries(v.himpunan)
    .map(([n, h]) => {
      const m = hasil.mu[k][n];
      return `<tr class="${m > 0 ? "aktif" : ""}">
        <td>${badge(n, h.warna)}<div class="mono catatan">[${h.param.join(", ")}]</div></td>
        <td class="mono bungkus">${esc(uraianTrap(n, x, h.param, m))}</td>
        <td class="num"><b>${f(m)}</b></td></tr>`;
    })
    .join("");
  return `<div class="fuzz-card">
    <h4>${esc(v.label)} <span class="catatan">x = ${r(x, 3)}</span></h4>
    <div class="legenda">${legenda}</div>
    <canvas class="grafik" data-var="${k}" role="img"
      aria-label="Grafik fungsi keanggotaan ${esc(v.label)} dengan nilai input ${r(x, 3)}"></canvas>
    <div class="tabel-wrap"><table class="kecil">
      <thead><tr><th>Himpunan [a, b, c, d]</th><th>Perhitungan</th><th class="num">μ</th></tr></thead>
      <tbody>${baris}</tbody></table></div>
  </div>`;
}

// Langkah 3 — tabel rule (aktif saja atau semua 27)
function htmlRules(hasil, semua) {
  const sel = (k, n) => {
    const m = hasil.mu[k][n];
    return `<td class="${m > 0 ? "" : "redup"}">${esc(n)} <span class="mono">(${f(m)})</span></td>`;
  };
  const baris = hasil.rules
    .filter((rl) => semua || rl.alpha > 0)
    .map((rl) => {
      const warna = VARIABEL_OUTPUT.skor.himpunan[rl.skor].warna;
      const m = [hasil.mu.tps[rl.tps], hasil.mu.gerakan[rl.gerakan], hasil.mu.jeda[rl.jeda]];
      return `<tr class="${rl.alpha > 0 ? "aktif" : ""}">
        <td>R${rl.no}</td>${sel("tps", rl.tps)}${sel("gerakan", rl.gerakan)}${sel("jeda", rl.jeda)}
        <td class="mono">min(${m.map((x) => f(x)).join(", ")}) = <b>${f(rl.alpha)}</b></td>
        <td>${badge(rl.skor, warna)}</td></tr>`;
    })
    .join("");
  const kosong = `<tr><td colspan="6" class="catatan">Tidak ada rule aktif.</td></tr>`;
  return `<div class="tabel-wrap"><table class="kecil rules">
    <thead><tr><th>R</th><th>JIKA TPS</th><th>DAN Gerakan</th><th>DAN Jeda</th><th>α = min(…)</th><th>MAKA Skor</th></tr></thead>
    <tbody>${baris || kosong}</tbody></table></div>`;
}

// Langkah 4 — komposisi: α_k = max(α rule yang MAKA-nya k)
function htmlKomposisi(hasil) {
  return Object.entries(VARIABEL_OUTPUT.skor.himpunan)
    .map(([n, h]) => {
      const aktif = hasil.rules.filter((rl) => rl.skor === n && rl.alpha > 0);
      const isi = aktif.length
        ? `max(${aktif.map((rl) => `R${rl.no}: ${f(rl.alpha)}`).join(", ")})`
        : "tidak ada rule aktif";
      return `<li>${badge(n, h.warna, "α_" + n)} = ${isi} = <b>${f(hasil.alphaOut[n])}</b></li>`;
    })
    .join("");
}

// Langkah 6 — rumus centroid dengan angka asli
function htmlCentroid(hasil) {
  const muSkor = Object.entries(hasil.muSkor)
    .map(([n, m]) => `μ_${n}(z*) = ${f(m)}`)
    .join("\n");
  const [zMin, zMax] = VARIABEL_OUTPUT.skor.semesta;
  const titik = Math.round((zMax - zMin) / LANGKAH_CENTROID) + 1;
  const rumus =
    hasil.den === 0
      ? `Σμ(z) = 0 → tidak ada rule aktif, skor = 0`
      : `z* = Σ(z·μ(z)) / Σμ(z) = ${f(hasil.num)} / ${f(hasil.den)} = ${f(hasil.skor, 2)}`;
  return `<p class="catatan">Sampel z = ${zMin}, ${zMin + LANGKAH_CENTROID}, …, ${zMax}
      (langkah ${LANGKAH_CENTROID}, ${titik} titik).</p>
    <pre class="rumus">${esc(rumus)}

${esc(muSkor)}
→ μ terbesar: kategori ${esc(hasil.kategori)}</pre>`;
}

/**
 * Render seluruh langkah perhitungan.
 * @param {Record<string, HTMLElement>} el - wadah tiap langkah
 * @param {object} hasil - output infer()
 * @param {{semuaRule?:boolean, waktu?:number, sumber?:string}} opsi
 */
export function renderSteps(el, hasil, { semuaRule = false, waktu, sumber } = {}) {
  el.input.innerHTML = htmlInput(hasil, waktu);
  el.fuzz.innerHTML = NAMA_VAR.map((k) => htmlFuzz(k, hasil)).join("");
  renderRules(el, hasil, semuaRule);
  el.komposisi.innerHTML = htmlKomposisi(hasil);
  el.centroid.innerHTML = htmlCentroid(hasil);
  renderResult(el.output, hasil, { sumber, waktu });
  gambarSemua(el, hasil);
}

// Dipisah agar toggle "tampilkan semua rule" tidak perlu render ulang semuanya
export function renderRules(el, hasil, semuaRule) {
  el.rules.innerHTML = htmlRules(hasil, semuaRule);
  const n = hasil.rules.filter((rl) => rl.alpha > 0).length;
  el.jumlahAktif.textContent = `${n} dari ${hasil.rules.length} rule aktif (α > 0)`;
}

// Gambar (ulang) grafik — dipanggil juga saat ukuran layar / tema berubah
export function gambarSemua(el, hasil) {
  el.fuzz.querySelectorAll("canvas[data-var]").forEach((cv) => {
    const k = cv.dataset.var;
    gambarKeanggotaan(cv, VARIABEL_INPUT[k], hasil.input[k]);
  });
  gambarOutput(el.grafikOutput, VARIABEL_OUTPUT.skor, hasil);
}
