import type Stripe from "stripe";

// Stripe Webhookの1イベントから、usersテーブルへ書き込むべき内容だけを組み立てる純粋ロジック。
// 実際のDB書き込みはルートハンドラ（src/app/api/webhooks/stripe/route.ts）が行う。
// ここではI/Oを一切行わないため、Stripeの実APIを呼ばずにテストできる。

export type BillingUpdate = {
  // stripeCustomerIdが確定する前（checkout.session.completed）はuserId、
  // 確定後（customer.subscription.*）はstripeCustomerIdで対象ユーザーを特定する
  where: { userId: string } | { stripeCustomerId: string };
  set: {
    stripeCustomerId?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: string | null;
  };
};

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

// current_period_endはSubscription本体ではなく明細（items）側に付く
function periodEndIso(subscription: Stripe.Subscription): string | null {
  const seconds = subscription.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * イベントに応じてusersテーブルへの更新内容を返す。対象外のイベント・
 * 必要な情報が欠けているイベントはnullを返す（何も更新しない）。
 */
export function billingUpdateFromEvent(event: Stripe.Event): BillingUpdate | null {
  switch (event.type) {
    // 申し込み完了。契約状態そのものはこの後に届くcustomer.subscription.updatedで入るため、
    // ここではStripe顧客IDとの結びつけだけを行う
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = customerIdOf(session.customer);
      if (!userId || !customerId) return null;
      return { where: { userId }, set: { stripeCustomerId: customerId } };
    }

    // 契約状態の変化（初回有効化・プラン変更・解約予約など）と、解約完了
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdOf(subscription.customer);
      if (!customerId) return null;
      return {
        where: { stripeCustomerId: customerId },
        set: {
          subscriptionStatus: subscription.status,
          currentPeriodEnd: periodEndIso(subscription),
        },
      };
    }

    default:
      return null;
  }
}
