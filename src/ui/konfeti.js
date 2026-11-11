// Animasi konfeti sederhana dengan Canvas (tanpa library).
// Warna = 6 warna stiker rubik. Menghormati pengaturan "kurangi gerakan" (prefers-reduced-motion).

const WARNA = ["#ffffff", "#ffd500", "#ff5800", "#c41e3a", "#0051ba", "#009e60"];

/**
 * Tembakkan konfeti di canvas (memenuhi layar).
 * @returns fungsi untuk menghentikan animasi lebih awal
 */
export function tembakKonfeti(canvas, { jumlah = 160, durasiMs = 3500 } = {}) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Dua "meriam" dari pojok kiri & kanan bawah, ditembak ke atas-tengah
  const partikel = Array.from({ length: jumlah }, (_, i) => {
    const kiri = i % 2 === 0;
    const sudut = (kiri ? -60 : -120) + (Math.random() - 0.5) * 40; // derajat
    const laju = 9 + Math.random() * 9;
    return {
      x: kiri ? w * 0.05 : w * 0.95,
      y: h + 10,
      vx: Math.cos((sudut * Math.PI) / 180) * laju,
      vy: Math.sin((sudut * Math.PI) / 180) * laju * (h / 700),
      ukuran: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      warna: WARNA[i % WARNA.length],
      tunda: Math.random() * 300, // ms, supaya tidak keluar bersamaan
    };
  });

  const mulai = performance.now();
  let aktif = true;
  const langkah = (t) => {
    if (!aktif) return;
    const lewat = t - mulai;
    ctx.clearRect(0, 0, w, h);
    const pudar = Math.max(0, Math.min(1, (durasiMs - lewat) / 800)); // memudar di akhir
    for (const p of partikel) {
      if (lewat < p.tunda) continue;
      p.vy += 0.22; // gravitasi
      p.vx *= 0.99; // hambatan udara
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.globalAlpha = pudar;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.warna;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      // Kotak kecil seperti stiker rubik; "skala x" berubah agar tampak berputar 3D
      const sx = Math.abs(Math.cos(p.rot * 2));
      ctx.scale(sx || 0.1, 1);
      ctx.fillRect(-p.ukuran / 2, -p.ukuran / 2, p.ukuran, p.ukuran);
      ctx.strokeRect(-p.ukuran / 2, -p.ukuran / 2, p.ukuran, p.ukuran);
      ctx.restore();
    }
    if (lewat < durasiMs) requestAnimationFrame(langkah);
    else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(langkah);

  return () => {
    aktif = false;
    ctx.clearRect(0, 0, w, h);
  };
}
