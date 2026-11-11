import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Path absolut file HTML (multi-page: Beranda + Cara Kerja)
const halaman = (nama) => fileURLToPath(new URL(nama, import.meta.url));

export default defineConfig({
  // Path relatif agar hasil build bisa dibuka dari subfolder hosting mana pun
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: halaman("index.html"),
        perhitungan: halaman("perhitungan.html"),
        metode: halaman("metode.html"),
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
