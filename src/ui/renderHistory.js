// Tabel riwayat solve.
import { VARIABEL_OUTPUT } from "../fuzzy/config.js";
import { esc, r, badge } from "./format.js";

export function renderHistory(wadah, daftar) {
  if (daftar.length === 0) {
    wadah.innerHTML = `<p class="catatan">Belum ada riwayat. Hitung dari input manual atau lakukan solve.</p>`;
    return;
  }
  const baris = daftar
    .map((it) => {
      const jam = new Date(it.waktuISO);
      const tgl = jam.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const pukul = jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const warna = VARIABEL_OUTPUT.skor.himpunan[it.kategori]?.warna ?? "#888";
      return `<tr>
        <td>${esc(tgl)} <span class="catatan">${esc(pukul)}</span></td>
        <td>${esc(it.sumber)}</td>
        <td class="num">${r(it.waktu)}</td>
        <td class="num">${r(it.gerakan, 0)}</td>
        <td class="num">${r(it.tps)}</td>
        <td class="num">${r(it.jeda, 1)}%</td>
        <td class="num"><b>${r(it.skor, 1)}</b></td>
        <td>${badge(it.kategori, warna)}</td>
        <td><button type="button" class="btn kecil" data-lihat="${esc(it.id)}">Lihat</button></td>
      </tr>`;
    })
    .join("");
  wadah.innerHTML = `<div class="tabel-wrap"><table class="kecil">
    <thead><tr><th>Jam</th><th>Sumber</th><th class="num">Waktu (s)</th><th class="num">Gerakan</th>
      <th class="num">TPS</th><th class="num">Jeda</th><th class="num">Skor</th><th>Kategori</th><th></th></tr></thead>
    <tbody>${baris}</tbody></table></div>`;
}
