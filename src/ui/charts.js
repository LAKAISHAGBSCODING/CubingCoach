// Grafik fungsi keanggotaan & output, digambar manual dengan Canvas API.
import { trap, clamp } from "../fuzzy/membership.js";

const PAD = { kiri: 34, kanan: 14, atas: 28, bawah: 26 };

// Ambil warna tema (terang/gelap) dari variabel CSS
function warnaTema() {
  const css = getComputedStyle(document.documentElement);
  return {
    teks: css.getPropertyValue("--fg").trim() || "#222",
    redup: css.getPropertyValue("--fg-muted").trim() || "#777",
    grid: css.getPropertyValue("--grid").trim() || "#ddd",
    latar: css.getPropertyValue("--surface").trim() || "#fff",
  };
}

// "#rrggbb" → "rgba(r,g,b,a)"
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Siapkan canvas dengan resolusi layar (HiDPI) dan fungsi pemetaan koordinat
function siapkan(canvas, [xMin, xMax]) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = canvas.clientHeight || 180;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const lebarPlot = w - PAD.kiri - PAD.kanan;
  const tinggiPlot = h - PAD.atas - PAD.bawah;
  const px = (x) => PAD.kiri + ((x - xMin) / (xMax - xMin)) * lebarPlot;
  const py = (y) => PAD.atas + (1 - y) * tinggiPlot;
  return { ctx, w, h, px, py };
}

// Sumbu, garis bantu μ = 0 / 0.5 / 1, dan label sumbu-x pada titik parameter
function gambarSumbu(g, semesta, himpunan, tema) {
  const { ctx, px, py } = g;
  ctx.font = "11px system-ui, sans-serif";
  ctx.lineWidth = 1;

  // Garis horizontal μ
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const y of [0, 0.5, 1]) {
    ctx.strokeStyle = tema.grid;
    ctx.beginPath();
    ctx.moveTo(px(semesta[0]), py(y));
    ctx.lineTo(px(semesta[1]), py(y));
    ctx.stroke();
    ctx.fillStyle = tema.redup;
    ctx.fillText(String(y), PAD.kiri - 6, py(y));
  }

  // Label sumbu-x: semua titik a, b, c, d yang unik (memudahkan penjelasan)
  const titik = new Set(semesta);
  for (const h of Object.values(himpunan)) h.param.forEach((p) => titik.add(p));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let xTerakhir = -Infinity;
  for (const x of [...titik].sort((a, b) => a - b)) {
    const X = px(x);
    ctx.strokeStyle = tema.grid;
    ctx.beginPath();
    ctx.moveTo(X, py(0));
    ctx.lineTo(X, py(0) + 4);
    ctx.stroke();
    // Lewati label yang terlalu rapat agar tidak bertumpuk
    if (X - xTerakhir < 18) continue;
    ctx.fillStyle = tema.redup;
    ctx.fillText(String(x), X, py(0) + 6);
    xTerakhir = X;
  }
}

// Garis trapesium satu himpunan (a,0) → (b,1) → (c,1) → (d,0)
function jalurTrapesium(ctx, [a, b, c, d], px, py) {
  ctx.beginPath();
  ctx.moveTo(px(a), py(a === b ? 1 : 0));
  ctx.lineTo(px(b), py(1));
  ctx.lineTo(px(c), py(1));
  ctx.lineTo(px(d), py(c === d ? 1 : 0));
}

/**
 * Grafik fungsi keanggotaan satu variabel + garis nilai input (opsional).
 * @param {number|null} [nilai] - null → hanya kurva himpunan
 */
export function gambarKeanggotaan(canvas, variabel, nilai) {
  const tema = warnaTema();
  const g = siapkan(canvas, variabel.semesta);
  const { ctx, px, py } = g;
  gambarSumbu(g, variabel.semesta, variabel.himpunan, tema);

  // Kurva setiap himpunan
  for (const h of Object.values(variabel.himpunan)) {
    jalurTrapesium(ctx, h.param, px, py);
    ctx.strokeStyle = h.warna;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Isi tipis di bawah kurva
    ctx.lineTo(px(h.param[3]), py(0));
    ctx.lineTo(px(h.param[0]), py(0));
    ctx.closePath();
    ctx.fillStyle = rgba(h.warna, 0.1);
    ctx.fill();
  }

  // Tanpa nilai input (grafik statis di bagian Variabel) → selesai di sini
  if (nilai === null || nilai === undefined) return;

  // Garis vertikal nilai input (di-clamp ke semesta)
  const x = clamp(nilai, variabel.semesta);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = tema.teks;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px(x), py(0));
  ctx.lineTo(px(x), py(1.08));
  ctx.stroke();
  ctx.setLineDash([]);

  // Titik potong dengan tiap himpunan + nilai μ
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const kanan = px(x) > g.w - 70;
  ctx.textAlign = kanan ? "right" : "left";
  for (const h of Object.values(variabel.himpunan)) {
    const m = trap(x, h.param);
    if (m <= 0) continue;
    ctx.fillStyle = h.warna;
    ctx.beginPath();
    ctx.arc(px(x), py(m), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tema.latar;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillText(m.toFixed(3), px(x) + (kanan ? -8 : 8), py(m));
  }

  // Label nilai input di atas garis (di luar area plot agar tidak menimpa label μ)
  ctx.fillStyle = tema.teks;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "600 11px system-ui, sans-serif";
  const label = `x = ${+x.toFixed(2)}`;
  const lx = Math.min(Math.max(px(x), PAD.kiri + 20), g.w - PAD.kanan - 20);
  ctx.fillText(label, lx, 2);
}

/**
 * Grafik output: himpunan output (garis putus), area agregasi
 * (tiap himpunan dipotong setinggi α), dan garis centroid z*.
 */
export function gambarOutput(canvas, varOut, hasil) {
  const tema = warnaTema();
  const g = siapkan(canvas, varOut.semesta);
  const { ctx, px, py } = g;
  gambarSumbu(g, varOut.semesta, varOut.himpunan, tema);

  // 1. Himpunan output asli (garis putus-putus)
  ctx.setLineDash([5, 4]);
  for (const h of Object.values(varOut.himpunan)) {
    jalurTrapesium(ctx, h.param, px, py);
    ctx.strokeStyle = rgba(h.warna, 0.75);
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 2. Area tiap himpunan setelah dipotong α_k: min(α_k, μ_k(z))
  for (const [nama, h] of Object.entries(varOut.himpunan)) {
    const alpha = hasil.alphaOut[nama];
    if (alpha <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(px(hasil.xs[0]), py(0));
    hasil.xs.forEach((z) => ctx.lineTo(px(z), py(Math.min(alpha, trap(z, h.param)))));
    ctx.lineTo(px(hasil.xs[hasil.xs.length - 1]), py(0));
    ctx.closePath();
    ctx.fillStyle = rgba(h.warna, 0.35);
    ctx.fill();
  }

  // 3. Garis kurva agregasi μ_agg(z)
  ctx.beginPath();
  hasil.xs.forEach((z, i) => (i ? ctx.lineTo(px(z), py(hasil.ys[i])) : ctx.moveTo(px(z), py(hasil.ys[i]))));
  ctx.strokeStyle = tema.teks;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Garis centroid z*
  if (hasil.den > 0) {
    const X = px(hasil.skor);
    ctx.strokeStyle = tema.teks;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X, py(0));
    ctx.lineTo(X, py(1.08));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tema.teks;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lx = Math.min(Math.max(X, PAD.kiri + 30), g.w - PAD.kanan - 30);
    ctx.fillText(`z* = ${hasil.skor.toFixed(2)}`, lx, 2);
  }
}
