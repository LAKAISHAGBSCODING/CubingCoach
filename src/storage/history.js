// Simpan & ambil riwayat solve dari localStorage.
// Semua akses dibungkus try/catch: localStorage bisa diblokir
// (mode privat, pengaturan browser), dan aplikasi harus tetap jalan.
const KEY = "cubingCoach.history";
const KEY_LAMA = "fuzzyCubeCoach.history"; // key versi pertama, dipindahkan otomatis
const KEY_INPUT_TERAKHIR = "cubingCoach.lastInput";
const MAKS_ITEM = 50;

export function ambilRiwayat() {
  try {
    let mentah = localStorage.getItem(KEY);
    // Migrasi sekali dari key lama
    if (mentah === null && localStorage.getItem(KEY_LAMA) !== null) {
      mentah = localStorage.getItem(KEY_LAMA);
      localStorage.setItem(KEY, mentah);
      localStorage.removeItem(KEY_LAMA);
    }
    const data = JSON.parse(mentah ?? "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function simpanRiwayat(daftar) {
  try {
    localStorage.setItem(KEY, JSON.stringify(daftar));
    return true;
  } catch {
    return false;
  }
}

/**
 * Tambahkan satu item riwayat dari hasil infer().
 * @param {object} hasil - output infer()
 * @param {{sumber:string, waktu:number, moves?:string}} info
 */
export function tambahRiwayat(hasil, { sumber, waktu, moves = "" }) {
  const sekarang = new Date();
  const item = {
    id: String(sekarang.getTime()),
    waktuISO: sekarang.toISOString(),
    sumber,
    waktu: bulat(waktu, 2),
    gerakan: hasil.input.gerakan,
    tps: bulat(hasil.input.tps, 2),
    jeda: bulat(hasil.input.jeda, 1),
    skor: bulat(hasil.skor, 2),
    kategori: hasil.kategori,
    moves,
  };
  // Item terbaru di depan, simpan maksimal 50 item
  const daftar = [item, ...ambilRiwayat()].slice(0, MAKS_ITEM);
  const ok = simpanRiwayat(daftar);
  return { item, ok };
}

export function hapusRiwayat() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

// Input penilaian terakhir — dibaca halaman Cara Kerja (bagian Simulasi)
export function simpanInputTerakhir({ tps, gerakan, jeda, waktu, sumber }) {
  try {
    localStorage.setItem(KEY_INPUT_TERAKHIR, JSON.stringify({ tps, gerakan, jeda, waktu, sumber }));
  } catch {
    /* abaikan: fitur ini opsional */
  }
}

export function ambilInputTerakhir() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY_INPUT_TERAKHIR) ?? "null");
    return d && [d.tps, d.gerakan, d.jeda].every(Number.isFinite) ? d : null;
  } catch {
    return null;
  }
}

function bulat(x, digit) {
  const f = 10 ** digit;
  return Math.round(x * f) / f;
}
