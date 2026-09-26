"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { requireAuth, requireUser } from "@/lib/auth";
import { assertBillingConfigured } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

// Server ActionはVercel/localhostどちらでも動くよう、リクエストヘッダーから自分のオリジンを組み立てる
// （このアプリはNEXT_PUBLIC_APP_URLのような固定のベースURLを持たない）
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// 有料プラン（月額500円）の申し込み。Stripe Checkoutへ遷移する
export async function startCheckout(): Promise<void> {
  assertBillingConfigured();
  const user = await requireUser();
  const baseUrl = await getBaseUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    // 既にStripe顧客なら再利用し、無ければメールアドレスから新規に作らせる
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    // Webhook側でこのユーザーとStripe顧客を結びつけるために使う
    client_reference_id: user.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/account/billing?checkout=success`,
    cancel_url: `${baseUrl}/account/billing?checkout=cancel`,
  });

  if (!session.url) throw new Error("Stripe Checkoutセッションの作成に失敗しました");
  redirect(session.url);
}

// 解約・支払い方法の変更。Stripeカスタマーポータルへ遷移する
export async function openBillingPortal(): Promise<void> {
  assertBillingConfigured();
  const userId = await requireAuth();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.stripeCustomerId) throw new Error("有料プランの申し込みが見つかりません");

  const baseUrl = await getBaseUrl();
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/account/billing`,
  });

  redirect(portalSession.url);
}
