import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CreditCard } from "lucide-react";
import { db } from "@/db/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { isBillingConfigured, isSubscriptionActive } from "@/lib/billing";
import { openBillingPortal, startCheckout } from "@/actions/billing";
import { AppHeader } from "@/components/app/app-header";
import { PageMain } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default async function BillingPage() {
  // STRIPE_SECRET_KEY等が未設定の環境ではこの画面自体を出さない
  if (!isBillingConfigured()) notFound();

  const userId = await requireAuth();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();

  const active = isSubscriptionActive(user);

  return (
    <>
      <AppHeader title="有料プラン" backHref="/dashboard" />

      <PageMain gap={6}>
        <section className="bg-card rounded-2xl border border-border px-4 py-4 flex flex-col gap-4">
          <h2 className="font-semibold text-foreground inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> 有料プラン（月額500円）
          </h2>

          {active ? (
            <>
              <p className="text-sm text-muted-foreground">
                ご契約中です。
                {user.currentPeriodEnd && (
                  <>次回更新日：{formatDate(user.currentPeriodEnd.slice(0, 10))}</>
                )}
              </p>
              <form action={openBillingPortal}>
                <Button type="submit" variant="outline" className="w-full">
                  解約・支払い方法の変更
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                月額500円で有料プランに申し込めます。いつでも解約できます。
              </p>
              <form action={startCheckout}>
                <Button type="submit" className="w-full">
                  有料プランに申し込む
                </Button>
              </form>
            </>
          )}
        </section>
      </PageMain>
    </>
  );
}
