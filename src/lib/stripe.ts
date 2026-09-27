import Stripe from "stripe";

// db.tsのlibSQLクライアントと違い、Stripeクライアントは永続接続を持たないため
// globalThisでの多重生成対策は不要。モジュール読み込み時点ではクライアントを作らず、
// 呼び出し時に初めてSTRIPE_SECRET_KEYを読む（未設定でもビルド・他画面の表示は落とさない。
// 呼び出し側は必ず assertBillingConfigured で先にガードする想定）
let cached: Stripe | undefined;

export function getStripe(): Stripe {
  if (!cached) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("課金機能が未設定です（STRIPE_SECRET_KEY）");
    cached = new Stripe(secretKey);
  }
  return cached;
}
