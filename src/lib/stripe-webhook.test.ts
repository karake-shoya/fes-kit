import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { billingUpdateFromEvent } from "@/lib/stripe-webhook";

// 実際のStripeイベントのうち、billingUpdateFromEventが参照するフィールドだけを持つ最小フィクスチャ。
function event(type: Stripe.Event.Type, object: unknown): Stripe.Event {
  return { type, data: { object } } as unknown as Stripe.Event;
}

describe("billingUpdateFromEvent", () => {
  it("checkout.session.completed: userIdとcustomerIdが揃っていればstripeCustomerIdを結びつける", () => {
    const update = billingUpdateFromEvent(
      event("checkout.session.completed", {
        client_reference_id: "user_1",
        customer: "cus_1",
      })
    );
    expect(update).toEqual({
      where: { userId: "user_1" },
      set: { stripeCustomerId: "cus_1" },
    });
  });

  it("checkout.session.completed: customerがオブジェクトの場合はidを使う", () => {
    const update = billingUpdateFromEvent(
      event("checkout.session.completed", {
        client_reference_id: "user_1",
        customer: { id: "cus_1" },
      })
    );
    expect(update?.set.stripeCustomerId).toBe("cus_1");
  });

  it("checkout.session.completed: client_reference_idが無ければ更新しない", () => {
    const update = billingUpdateFromEvent(
      event("checkout.session.completed", {
        client_reference_id: null,
        customer: "cus_1",
      })
    );
    expect(update).toBeNull();
  });

  it("customer.subscription.updated: statusとcurrentPeriodEndを更新する", () => {
    const update = billingUpdateFromEvent(
      event("customer.subscription.updated", {
        customer: "cus_1",
        status: "active",
        items: { data: [{ current_period_end: 1798761600 }] }, // 2027-01-01T00:00:00Z
      })
    );
    expect(update).toEqual({
      where: { stripeCustomerId: "cus_1" },
      set: { subscriptionStatus: "active", currentPeriodEnd: "2027-01-01T00:00:00.000Z" },
    });
  });

  it("customer.subscription.deleted: statusをcanceledとして更新する", () => {
    const update = billingUpdateFromEvent(
      event("customer.subscription.deleted", {
        customer: "cus_1",
        status: "canceled",
        items: { data: [] },
      })
    );
    expect(update).toEqual({
      where: { stripeCustomerId: "cus_1" },
      set: { subscriptionStatus: "canceled", currentPeriodEnd: null },
    });
  });

  it("customer.subscription.updated: customerが無ければ更新しない", () => {
    const update = billingUpdateFromEvent(
      event("customer.subscription.updated", {
        customer: null,
        status: "active",
        items: { data: [] },
      })
    );
    expect(update).toBeNull();
  });

  it("対象外のイベントはnullを返す", () => {
    const update = billingUpdateFromEvent(event("invoice.paid", {}));
    expect(update).toBeNull();
  });
});
