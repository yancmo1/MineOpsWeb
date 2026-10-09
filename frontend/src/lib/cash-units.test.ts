import { describe, expect, it } from "vitest";
import { formatCashValue, parseCashValue, suffixStep } from "./cash-units";

describe("Idle Miner cash suffix conversion", () => {
  it("converts alpha suffixes at x1000 per step", () => {
    expect(suffixStep("T")).toBe(4);
    expect(suffixStep("aa")).toBe(5);
    expect(suffixStep("aj")).toBe(14);
    expect(parseCashValue("1 aa")).toBe(1e15);
    expect((parseCashValue("6.84 aj") ?? 0) / 6.84e42).toBeCloseTo(1, 12);
    expect((parseCashValue("122 ak") ?? 0) / 122e45).toBeCloseTo(1, 12);
  });

  it("formats base values back into game notation", () => {
    expect(formatCashValue(6.84e42)).toBe("6.84 aj");
    expect(formatCashValue(122e42)).toBe("122 aj");
    expect(formatCashValue(1500)).toBe("1.50 K");
  });
});
