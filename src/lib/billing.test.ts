import { afterEach, describe, expect, it, vi } from "vitest";
import { assertBillingConfigured, isBillingConfigured, isSubscriptionActive } from "@/lib/billing";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSubscriptionActive", () => {
  const now = new Date("2026-09-26T00:00:00Z");

  it("有効な契約（active・期限が未来）は課金中", () => {
    expect(
      isSubscriptionActive(
        { subscriptionStatus: "active", currentPeriodEnd: "2026-10-26T00:00:00Z" },
        now
      )
    ).toBe(true);
  });

  it("解約済み（canceled）は課金中ではない", () => {
    expect(
      isSubscriptionActive(
        { subscriptionStatus: "canceled", currentPeriodEnd: "2026-10-26T00:00:00Z" },
        now
      )
    ).toBe(false);
  });

  it("期限切れ（statusはactiveのままcurrentPeriodEndを過ぎている）は課金中ではない", () => {
    expect(
      isSubscriptionActive(
        { subscriptionStatus: "active", currentPeriodEnd: "2026-09-01T00:00:00Z" },
        now
      )
    ).toBe(false);
  });

  it("未登録（subscriptionStatusがnull）は課金中ではない", () => {
    expect(
      isSubscriptionActive({ subscriptionStatus: null, currentPeriodEnd: null }, now)
    ).toBe(false);
  });

  it("currentPeriodEndが未設定でもstatusがactiveなら課金中", () => {
    expect(
      isSubscriptionActive({ subscriptionStatus: "active", currentPeriodEnd: null }, now)
    ).toBe(true);
  });
});

describe("isBillingConfigured / assertBillingConfigured", () => {
  it("3つの環境変数がすべて揃っていれば true", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
    vi.stubEnv("STRIPE_PRICE_ID", "price_dummy");
    expect(isBillingConfigured()).toBe(true);
    expect(() => assertBillingConfigured()).not.toThrow();
  });

  it("1つでも未設定なら false・例外を投げる", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_PRICE_ID", "price_dummy");
    expect(isBillingConfigured()).toBe(false);
    expect(() => assertBillingConfigured()).toThrow("課金機能が未設定です");
  });
});
