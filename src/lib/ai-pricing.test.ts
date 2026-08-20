import { afterEach, describe, expect, it, vi } from "vitest";
import { PRICE_FLOOR, PRICE_STEP, assertAiConfigured, buildProjectLines, roundPrice } from "@/lib/ai-pricing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("roundPrice", () => {
  it(`${PRICE_STEP}円単位に丸める`, () => {
    expect(roundPrice(123)).toBe(120);
    expect(roundPrice(125)).toBe(130);
  });

  it(`${PRICE_FLOOR}円未満にはならない`, () => {
    expect(roundPrice(0)).toBe(PRICE_FLOOR);
    expect(roundPrice(-50)).toBe(PRICE_FLOOR);
  });
});

describe("assertAiConfigured", () => {
  it("ANTHROPIC_API_KEY未設定なら例外を投げる", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => assertAiConfigured()).toThrow("AI機能が未設定です（ANTHROPIC_API_KEY）");
  });

  it("ANTHROPIC_API_KEY設定済みなら何もしない", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-dummy");
    expect(() => assertAiConfigured()).not.toThrow();
  });
});

describe("buildProjectLines", () => {
  it("プロジェクトがnullなら空配列", () => {
    expect(buildProjectLines(null)).toEqual([]);
  });

  it("名前・説明・イベント日をすべて行にする", () => {
    expect(
      buildProjectLines({ name: "夏祭り", description: "たこ焼き屋台", eventDate: "2026-08-20" })
    ).toEqual([
      "出店・イベント名：夏祭り",
      "出店の説明・メモ：たこ焼き屋台",
      "イベント日：2026-08-20",
    ]);
  });

  it("説明・イベント日が無ければその行を含めない", () => {
    expect(buildProjectLines({ name: "夏祭り", description: null, eventDate: null })).toEqual([
      "出店・イベント名：夏祭り",
    ]);
  });
});
