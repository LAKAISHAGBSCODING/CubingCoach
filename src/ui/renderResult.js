// Kartu hasil: skor besar, badge kategori, ringkasan input, rekomendasi.
// Dipakai di halaman utama dan di langkah terakhir Simulasi (halaman Cara Kerja).
import { VARIABEL_OUTPUT } from "../fuzzy/config.js";
import { esc, r } from "./format.js";

export function renderResult(wadah, hasil, { sumber, waktu } = {}) {
  const warna = VARIABEL_OUTPUT.skor.himpunan[hasil.kategori].warna;
  const { tps, gerakan, jeda } = hasil.input;
  const teksWaktu = Number.isFinite(waktu) ? `${r(waktu)} s` : "–";

  wadah.innerHTML = `
    <div class="hasil-atas">
      <div class="skor" style="--c:${warna}">
        <span class="skor-angka">${hasil.skor.toFixed(1)}</span>
        <span class="skor-dari">/ 100</span>
      </div>
      <div class="hasil-kat">
        <span class="kategori" style="--c:${warna}">${esc(hasil.kategori)}</span>
        ${sumber ? `<span class="sumber">sumber: ${esc(sumber)}</span>` : ""}
      </div>
    </div>
    <dl class="ringkas">
      <div><dt>Waktu</dt><dd>${teksWaktu}</dd></div>
      <div><dt>Gerakan</dt><dd>${r(gerakan, 0)}</dd></div>
      <div><dt>TPS</dt><dd>${r(tps)}</dd></div>
      <div><dt>Jeda</dt><dd>${r(jeda, 1)}%</dd></div>
    </dl>
    <h3>Rekomendasi latihan</h3>
    <ul class="rekomendasi">
      ${hasil.rekomendasi.map((s) => `<li>${esc(s)}</li>`).join("")}
    </ul>`;
}
