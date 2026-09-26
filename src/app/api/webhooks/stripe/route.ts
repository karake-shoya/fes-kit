import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { billingUpdateFromEvent } from "@/lib/stripe-webhook";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No secret" }, { status: 500 });

  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const update = billingUpdateFromEvent(event);
  if (!update) return NextResponse.json({ ok: true });

  const set = { ...update.set, updatedAt: new Date().toISOString() };

  try {
    if ("userId" in update.where) {
      await db.update(users).set(set).where(eq(users.id, update.where.userId));
    } else {
      await db.update(users).set(set).where(eq(users.stripeCustomerId, update.where.stripeCustomerId));
    }
  } catch (err) {
    console.error("[stripe-webhook]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 }); // 500でStripeがリトライ
  }

  return NextResponse.json({ ok: true });
}
