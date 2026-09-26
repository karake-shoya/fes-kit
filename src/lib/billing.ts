// 有料プラン（月額500円のサブスクリプション）の課金状態に関する純粋ロジック。
// DBの値（Stripe Webhookが書き込むsubscriptionStatus・currentPeriodEnd）だけを見て判定する。

// 課金中とみなすStripeのsubscription.status
// active   = 通常の契約中
// trialing = 無料トライアル中（このアプリでは使わない想定だが、来た場合も課金中として扱う）
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export type BillingInfo = {
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
};

/**
 * 課金中かどうかを判定する。
 * - 未登録（subscriptionStatusがnull）は課金中ではない
 * - 解約済み（status !== active/trialing）は課金中ではない
 * - 期限切れ（currentPeriodEndを過ぎている）は課金中ではない
 *   （「解約したのに期間終了まで有効」の間はstatusがまだactiveのままcurrentPeriodEndで判定するため必要）
 */
export function isSubscriptionActive(billing: BillingInfo, now: Date = new Date()): boolean {
  if (!billing.subscriptionStatus || !ACTIVE_STATUSES.has(billing.subscriptionStatus)) {
    return false;
  }
  if (billing.currentPeriodEnd && new Date(billing.currentPeriodEnd) <= now) {
    return false;
  }
  return true;
}

// 課金機能に必要な環境変数が揃っているか
export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_ID
  );
}

// 未設定時は課金のUIを出させない（src/lib/ai-pricing.ts の assertAiConfigured と同じ考え方）
export function assertBillingConfigured(): void {
  if (!isBillingConfigured()) {
    throw new Error(
      "課金機能が未設定です（STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID）"
    );
  }
}
