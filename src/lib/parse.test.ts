import { describe, expect, it } from "vitest";
import { parseNonNegativeInt, parsePositiveInt, parsePositiveNumber } from "@/lib/parse";

describe("parsePositiveNumber", () => {
  it("数値文字列をそのまま数値にする", () => {
    expect(parsePositiveNumber("300", "単価")).toBe(300);
    expect(parsePositiveNumber("2.5", "単価")).toBe(2.5);
  });

  it("カンマ区切りを正しく解釈する（parseFloat の \"1,000\"→1 を防ぐ）", () => {
    expect(parsePositiveNumber("1,000", "単価")).toBe(1000);
  });

  it("空欄・0以下・数値でない値は入力エラーにする", () => {
    expect(() => parsePositiveNumber("", "単価")).toThrow("単価");
    expect(() => parsePositiveNumber(null, "単価")).toThrow("単価");
    expect(() => parsePositiveNumber("0", "単価")).toThrow("単価");
    expect(() => parsePositiveNumber("-5", "単価")).toThrow("単価");
    expect(() => parsePositiveNumber("100円", "単価")).toThrow("単価");
  });
});

describe("parseNonNegativeInt", () => {
  it("0を許し、小数は切り捨てる", () => {
    expect(parseNonNegativeInt("0", "売れた数")).toBe(0);
    expect(parseNonNegativeInt("12.9", "売れた数")).toBe(12);
    expect(parseNonNegativeInt(30, "売れた数")).toBe(30);
  });

  it("負数・空欄・数値でない値は入力エラーにする", () => {
    expect(() => parseNonNegativeInt("-1", "売れた数")).toThrow("売れた数");
    expect(() => parseNonNegativeInt("", "売れた数")).toThrow("売れた数");
    expect(() => parseNonNegativeInt("abc", "売れた数")).toThrow("売れた数");
  });

  it("integer カラムに収まらない巨大な値を弾く", () => {
    expect(() => parseNonNegativeInt("9e999", "売れた数")).toThrow("売れた数");
    expect(() => parseNonNegativeInt("1e20", "売れた数")).toThrow("大きすぎます");
  });
});

describe("parsePositiveInt", () => {
  it("空欄なら fallback を返す", () => {
    expect(parsePositiveInt("", "作る予定数", 1)).toBe(1);
    expect(parsePositiveInt(null, "作る予定数", 100)).toBe(100);
  });

  it("1以上の整数に丸める", () => {
    expect(parsePositiveInt("100", "作る予定数", 1)).toBe(100);
    expect(parsePositiveInt("3.7", "作る予定数", 1)).toBe(3);
  });

  it("1未満は入力エラーにする", () => {
    expect(() => parsePositiveInt("0", "作る予定数", 1)).toThrow("作る予定数");
    expect(() => parsePositiveInt("-2", "作る予定数", 1)).toThrow("作る予定数");
  });
});
