// Render bagian statis halaman Cara Kerja. Semua angka dibaca dari config.js,
// jadi jika config diubah, tabel dan grafik di sini ikut berubah.
import {
  VARIABEL_INPUT,
  VARIABEL_OUTPUT,
  RULES,
  PEMETAAN_POIN,
  AMBANG_REKOMENDASI,
  BATAS_JEDA_MS,
} from "../fuzzy/config.js";
import { fuzzifikasi } from "../fuzzy/membership.js";
import { ATURAN_REKOMENDASI, REKOMENDASI_SEIMBANG } from "../fuzzy/recommendation.js";
import { hitungStatistik } from "../cube/solveTracker.js";
import { gambarKeanggotaan } from "./charts.js";
import { REFERENSI } from "../content/referensi.js";
import { TIM } from "../content/tim.js";
import { f, r, esc, badge } from "./format.js";

const SEMUA_VAR = [
  ["tps", VARIABEL_INPUT.tps, "input"],
  ["gerakan", VARIABEL_INPUT.gerakan, "input"],
  ["jeda", VARIABEL_INPUT.jeda, "input"],
  ["skor", VARIABEL_OUTPUT.skor, "output"],
];

function bentuk([a, b, c, d]) {
  if (a === b) return "bahu kiri";
  if (c === d) return "bahu kanan";
  return "trapesium";
}

// ---------- Bagian 2: contoh batas tegas vs fuzzy ----------
export function renderDemoCrisp(wadah) {
  const v = VARIABEL_INPUT.tps;
  // Batas tegas diambil dari titik awal himpunan "cepat" (a), agar ikut config
  const batas = v.himpunan.cepat.param[0];
  const nilai = [batas - 0.1, batas + 0.1];
  const baris = nilai
    .map((x) => {
      const mu = fuzzifikasi(x, v);
      const crisp = x >= batas ? "cepat" : "sedang";
      const fuzzy = Object.entries(mu)
        .filter(([, m]) => m > 0)
        .map(([n, m]) => `${badge(n, v.himpunan[n].warna)} ${f(m)}`)
        .join(" ");
      return `<tr><td class="num"><b>${r(x)}</b></td><td>${badge(crisp, v.himpunan[crisp].warna)} saja</td><td>${fuzzy}</td></tr>`;
    })
    .join("");
  wadah.innerHTML = `<div class="tabel-wrap"><table class="kecil">
    <thead><tr><th class="num">TPS</th><th>Logika tegas (batas ${r(batas)})</th><th>Logika fuzzy (derajat keanggotaan)</th></tr></thead>
    <tbody>${baris}</tbody></table></div>
    <p class="catatan">Dengan logika fuzzy, perubahan kecil pada input hanya menghasilkan perubahan kecil pada penilaian.</p>`;
}

// ---------- Bagian 4: variabel & himpunan ----------
export function renderVariabel(wadah) {
  wadah.innerHTML = SEMUA_VAR.map(([k, v, jenis]) => {
    const baris = Object.entries(v.himpunan)
      .map(
        ([n, h]) => `<tr><td>${badge(n, h.warna)}</td><td class="mono">${h.param.join("</td><td class=\"mono\">")}</td>
          <td class="catatan">${bentuk(h.param)}</td></tr>`,
      )
      .join("");
    const legenda = Object.entries(v.himpunan)
      .map(([n, h]) => `<span class="leg" style="--c:${h.warna}">${esc(n)}</span>`)
      .join("");
    return `<article class="var-card">
      <h3>${esc(v.label)} <span class="catatan">— ${esc(v.keterangan)}</span></h3>
      <dl class="var-info">
        <div><dt>Jenis</dt><dd>variabel ${jenis}</dd></div>
        <div><dt>Satuan</dt><dd>${esc(v.satuan)}</dd></div>
        <div><dt>Semesta</dt><dd>[${v.semesta.join(", ")}]</dd></div>
      </dl>
      <div class="legenda">${legenda}</div>
      <canvas class="grafik" data-var-statis="${k}" role="img" aria-label="Grafik himpunan fuzzy ${esc(v.label)}"></canvas>
      <div class="tabel-wrap"><table class="kecil">
        <thead><tr><th>Himpunan</th><th>a</th><th>b</th><th>c</th><th>d</th><th>Bentuk</th></tr></thead>
        <tbody>${baris}</tbody></table></div>
      <p class="dasar"><b>Dasar penentuan:</b> ${esc(v.dasar)}</p>
    </article>`;
  }).join("");
  gambarVariabel(wadah);
}

export function gambarVariabel(wadah) {
  const peta = Object.fromEntries(SEMUA_VAR.map(([k, v]) => [k, v]));
  wadah.querySelectorAll("canvas[data-var-statis]").forEach((cv) => {
    gambarKeanggotaan(cv, peta[cv.dataset.varStatis], null);
  });
}

// ---------- Bagian 5: sistem poin & tabel rule ----------
const POIN = (k, n) => VARIABEL_INPUT[k].himpunan[n].poin;

export function renderRule(wadahPoin, wadahTabel) {
  const barisPoin = ["tps", "gerakan", "jeda"]
    .map((k) => {
      const v = VARIABEL_INPUT[k];
      const isi = Object.entries(v.himpunan)
        .sort(([, a], [, b]) => a.poin - b.poin)
        .map(([n, h]) => `${badge(n, h.warna)} = ${h.poin}`)
        .join(" &nbsp; ");
      return `<tr><td>${esc(v.label)}</td><td>${isi}</td></tr>`;
    })
    .join("");
  const pemetaan = PEMETAAN_POIN.map(
    (p) => `${p.min}–${p.max} → ${badge(p.skor, VARIABEL_OUTPUT.skor.himpunan[p.skor].warna)}`,
  ).join(" &nbsp; ");
  wadahPoin.innerHTML = `<div class="tabel-wrap"><table class="kecil">
      <thead><tr><th>Variabel</th><th>Poin kualitas himpunan</th></tr></thead>
      <tbody>${barisPoin}<tr><td><b>Total poin</b></td><td>${pemetaan}</td></tr></tbody></table></div>
    <p class="catatan">Contoh: R14 = sedang (1) + normal (1) + sedang (1) = 3 → menengah.</p>`;

  renderMatriksRule(wadahTabel);
}

// Matriks 27 aturan: satu tabel per himpunan TPS (baris = gerakan, kolom = jeda)
function renderMatriksRule(wadah) {
  const urut = (k) =>
    Object.entries(VARIABEL_INPUT[k].himpunan)
      .sort(([, a], [, b]) => a.poin - b.poin)
      .map(([n]) => n);
  const [tpsUrut, gerUrut, jedaUrut] = ["tps", "gerakan", "jeda"].map(urut);

  wadah.innerHTML = tpsUrut
    .map((t) => {
      const kepala = jedaUrut.map((j) => `<th>${esc(j)}</th>`).join("");
      const baris = gerUrut
        .map((g) => {
          const sel = jedaUrut
            .map((j) => {
              const rl = RULES.find((x) => x.tps === t && x.gerakan === g && x.jeda === j);
              if (!rl) return `<td class="redup">–</td>`;
              const warna = VARIABEL_OUTPUT.skor.himpunan[rl.skor].warna;
              const total = POIN("tps", t) + POIN("gerakan", g) + POIN("jeda", j);
              return `<td class="sel-rule" style="--c:${warna}" title="R${rl.no}: JIKA TPS ${t} DAN gerakan ${g} DAN jeda ${j} MAKA ${rl.skor} (poin ${total})">
                <b>${esc(rl.skor)}</b><span>R${rl.no} · ${total} poin</span></td>`;
            })
            .join("");
          return `<tr><th scope="row">${esc(g)}</th>${sel}</tr>`;
        })
        .join("");
      return `<div class="matriks">
        <p class="matriks-judul">TPS ${badge(t, VARIABEL_INPUT.tps.himpunan[t].warna)}</p>
        <table class="kecil">
          <thead><tr><th class="sudut">Gerakan ↓ / Jeda →</th>${kepala}</tr></thead>
          <tbody>${baris}</tbody></table></div>`;
    })
    .join("");
}

// ---------- Bagian 7: aturan rekomendasi ----------
export function renderRekomendasi(wadah) {
  const grupNama = { kecepatan: "Kecepatan", efisiensi: "Efisiensi gerakan", jeda: "Jeda / lookahead" };
  let grupSebelum = null;
  const baris = ATURAN_REKOMENDASI.map((a) => {
    const v = VARIABEL_INPUT[a.variabel];
    const lanjut = a.grup === grupSebelum;
    grupSebelum = a.grup;
    const syarat = `${lanjut ? "selain itu, " : ""}μ ${esc(v.label)} ${badge(a.himpunan, v.himpunan[a.himpunan].warna)} ≥ ${AMBANG_REKOMENDASI}`;
    return `<tr><td>${lanjut ? "" : esc(grupNama[a.grup] ?? a.grup)}</td><td>${syarat}</td><td>${esc(a.teks)}</td></tr>`;
  }).join("");
  wadah.innerHTML = `<div class="tabel-wrap"><table class="kecil">
    <thead><tr><th>Kelompok</th><th>Syarat</th><th>Rekomendasi</th></tr></thead>
    <tbody class="bungkus-semua">${baris}
      <tr><td>—</td><td>tidak ada syarat yang terpenuhi</td><td>${esc(REKOMENDASI_SEIMBANG)}</td></tr>
    </tbody></table></div>`;
}

// ---------- Bagian 3: dari timestamp smart cube ke tiga input ----------
const CONTOH_TIMESTAMP = [0, 320, 640, 1900, 2200, 2480, 2800, 3900, 4150, 4400];

export function renderTimeline(wadahTimeline, wadahRumus) {
  const t = CONTOH_TIMESTAMP;
  const s = hitungStatistik(t);
  const total = t[t.length - 1] - t[0];

  // Batang waktu: tiap selisih antar-putaran jadi satu segmen; segmen > batas = jeda
  const segmen = t
    .slice(1)
    .map((ti, i) => {
      const d = ti - t[i];
      const jeda = d > BATAS_JEDA_MS;
      return `<div class="seg ${jeda ? "jeda" : ""}" style="flex:${d}" title="${d} ms${jeda ? " (jeda)" : ""}"><span>${d}</span></div>`;
    })
    .join("");
  wadahTimeline.innerHTML = `<div class="timeline" role="img"
      aria-label="Garis waktu ${t.length} putaran selama ${total} ms, selisih lebih dari ${BATAS_JEDA_MS} ms ditandai sebagai jeda">
      ${segmen}</div>
    <div class="timeline-legenda"><span class="leg-seg"></span> selisih ≤ ${BATAS_JEDA_MS} ms (memutar)
      <span class="leg-seg jeda"></span> selisih &gt; ${BATAS_JEDA_MS} ms (dihitung jeda) · angka = ms</div>
    <p class="catatan mono">timestamp (ms) = [${t.join(", ")}]</p>`;

  const jedaList = t
    .slice(1)
    .map((ti, i) => ti - t[i])
    .filter((d) => d > BATAS_JEDA_MS);
  wadahRumus.innerHTML = `<pre class="rumus">waktu   = (t_terakhir − t_pertama) / 1000 = (${t[t.length - 1]} − ${t[0]}) / 1000 = ${f(s.waktu, 2)} s
gerakan = jumlah timestamp = ${s.gerakan}
TPS     = gerakan / waktu = ${s.gerakan} / ${f(s.waktu, 2)} = ${f(s.tps, 2)} putaran/detik
jedaMs  = Σ selisih &gt; ${BATAS_JEDA_MS} ms = ${jedaList.join(" + ")} = ${s.jedaMs} ms
jeda    = jedaMs / (waktu × 1000) × 100 = ${s.jedaMs} / ${total} × 100 = ${f(s.jeda, 1)} %</pre>`;
}

// ---------- Bagian 10: referensi (format APA) ----------
function formatApa(it) {
  const url = it.url ? ` <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.url)}</a>` : "";
  if (it.teksBebas) return `${esc(it.teksBebas)}${url}`;
  // Judul yang sudah diakhiri tanda tanya/seru tidak diberi titik lagi
  const judul = /[?!]$/.test(it.judul) ? esc(it.judul) : `${esc(it.judul)}.`;
  return `${esc(it.penulis)} (${esc(it.tahun)}). ${judul} <i>${esc(it.terbitan)}</i>${esc(it.detail ?? "")}.${url}`;
}

export function renderReferensi(wadah) {
  let no = 0;
  wadah.innerHTML = REFERENSI.map(
    (g) => `<h3>${esc(g.grup)}</h3>
      <ol class="referensi" start="${no + 1}">
        ${g.item
          .map((it) => {
            no++;
            const todo = it.todo ? `<span class="tanda-todo">TODO</span> ` : "";
            const catatan = it.catatan ? `<div class="catatan">${esc(it.catatan)}</div>` : "";
            return `<li class="${it.todo ? "todo" : ""}">${todo}${formatApa(it)}${catatan}</li>`;
          })
          .join("")}
      </ol>`,
  ).join("");
}

// ---------- Bagian 11: tim ----------
export function renderTim(wadah) {
  wadah.innerHTML = TIM.map(
    (a, i) => `<div class="tim-card">
      <span class="tim-avatar" aria-hidden="true">${i + 1}</span>
      <b>${esc(a.nama)}</b>
      <span class="mono">${esc(a.nim)}</span>
      <span class="catatan">${esc(a.peran)}</span>
    </div>`,
  ).join("");
}
