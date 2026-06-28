import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: { email_address: string; primary: boolean }[];
    first_name: string | null;
    last_name:  string | null;
    image_url:  string | null;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No secret" }, { status: 500 });

  const headerPayload = await headers();
  const svixId        = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature)
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });

  const payload = await req.text();
  let event: ClerkUserEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;
  const email = data.email_addresses.find((e) => e.primary)?.email_address ?? "";
  const name  = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  try {
    if (type === "user.created") {
      await db.insert(users)
        .values({ id: data.id, email, name, avatarUrl: data.image_url })
        .onConflictDoNothing();                 // 冪等性：重複INSERT防止
    } else if (type === "user.updated") {
      await db.update(users)
        .set({ email, name, avatarUrl: data.image_url, updatedAt: new Date().toISOString() })
        .where(eq(users.id, data.id));
    } else if (type === "user.deleted") {
      await db.delete(users).where(eq(users.id, data.id)); // CASCADEで関連データも削除
    }
  } catch (err) {
    console.error("[clerk-webhook]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 }); // 500でClerkがリトライ
  }

  return NextResponse.json({ ok: true });
}
