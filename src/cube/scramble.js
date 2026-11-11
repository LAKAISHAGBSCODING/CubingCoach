// Generator acakan 20 gerakan.
// Aturan:
//   1. Tidak boleh sisi yang sama berturut-turut (mis. "R R'").
//   2. Tidak boleh pola "R L R" (sisi sama dipisah sisi lawannya),
//      karena R dan L saling komutatif sehingga sama dengan "R2 L".
const SISI = ["U", "D", "L", "R", "F", "B"];
const MODIFIER = ["", "'", "2"];
const LAWAN = { U: "D", D: "U", L: "R", R: "L", F: "B", B: "F" };

export function buatAcakan(panjang = 20, acak = Math.random) {
  const hasil = [];
  while (hasil.length < panjang) {
    const sisi = SISI[Math.floor(acak() * SISI.length)];
    const s1 = hasil[hasil.length - 1]?.[0]; // sisi gerakan terakhir
    const s2 = hasil[hasil.length - 2]?.[0]; // sisi dua gerakan lalu

    if (sisi === s1) continue; // aturan 1
    if (sisi === s2 && s1 === LAWAN[sisi]) continue; // aturan 2

    hasil.push(sisi + MODIFIER[Math.floor(acak() * MODIFIER.length)]);
  }
  return hasil;
}
