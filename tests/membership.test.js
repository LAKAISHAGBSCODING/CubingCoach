import { describe, it, expect } from "vitest";
import { trap, clamp, fuzzifikasi } from "../src/fuzzy/membership.js";
import { VARIABEL_INPUT } from "../src/fuzzy/config.js";

describe("trap() — fungsi keanggotaan trapesium", () => {
  it.each([
    [0, [0, 0, 1.5, 3], 1],
    [2.25, [0, 0, 1.5, 3], 0.5],
    [3, [1.5, 3, 4, 5.5], 1],
    [10, [4, 5.5, 10, 10], 1],
    [6, [0, 0, 1.5, 3], 0],
  ])("trap(%s, %j) = %s", (x, param, hasil) => {
    expect(trap(x, param)).toBeCloseTo(hasil, 10);
  });

  it("bagian turun dihitung (d − x) / (d − c)", () => {
    expect(trap(4.75, [1.5, 3, 4, 5.5])).toBeCloseTo(0.5, 10);
  });
});

describe("fuzzifikasi()", () => {
  it("nilai di luar semesta di-clamp", () => {
    expect(clamp(200, [20, 150])).toBe(150);
    expect(fuzzifikasi(200, VARIABEL_INPUT.gerakan).boros).toBe(1);
    expect(fuzzifikasi(-5, VARIABEL_INPUT.tps).lambat).toBe(1);
  });
});
