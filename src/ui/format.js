// Fungsi bantu tampilan kecil yang dipakai banyak renderer.

// Format angka dengan n desimal (titik sebagai pemisah desimal, seperti di rumus)
export const f = (x, n = 3) => Number(x).toFixed(n);

// Angka ringkas: buang nol di belakang (3.50 → 3.5)
export const r = (x, n = 2) => String(+Number(x).toFixed(n));

// Escape teks agar aman dimasukkan ke innerHTML
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Badge berwarna untuk nama himpunan
export function badge(nama, warna, teks = nama) {
  return `<span class="badge" style="--c:${warna}">${esc(teks)}</span>`;
}
