import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, UserPlus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getValidInvitation } from "@/db/queries/invitations";
import { getMyRole } from "@/db/queries/projects";
import { acceptInvitation } from "@/actions/invitation";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, PILL_CLASS, formatDate } from "@/lib/format";

// 招待リンクの受諾ページ。
// proxy.ts の保護により未ログイン時はサインイン後にここへ戻ってくる。
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const userId = await requireAuth();

  const invitation = await getValidInvitation(token);

  if (!invitation) {
    return (
      <InviteShell>
        <h1 className="text-lg font-bold text-foreground">この招待リンクは使えません</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          リンクの有効期限（72時間）が切れているか、すでに使用済みです。
          <br />
          プロジェクトのオーナーに新しいリンクを発行してもらってください。
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/dashboard">ホームへ戻る</Link>
        </Button>
      </InviteShell>
    );
  }

  // すでにメンバーならそのままプロジェクトへ
  const myRole = await getMyRole(invitation.projectId, userId);
  if (myRole) redirect(`/projects/${invitation.projectId}`);

  const accept = acceptInvitation.bind(null, token);

  return (
    <InviteShell>
      <p className="text-sm text-muted-foreground">プロジェクトへの招待が届いています</p>
      <h1 className="text-xl font-bold text-foreground">{invitation.projectName}</h1>
      {invitation.eventDate && (
        <p className="text-sm text-muted-foreground inline-flex items-center justify-center gap-1">
          <CalendarDays className="w-4 h-4" /> イベント日 {formatDate(invitation.eventDate)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <span className={PILL_CLASS}>
          {ROLE_LABEL[invitation.role]}
        </span>
        <span className="ml-1.5">として参加します</span>
      </p>
      <form action={accept} className="mt-2 w-full">
        <Button type="submit" className="w-full" size="lg">
          <UserPlus className="w-4 h-4" /> このプロジェクトに参加する
        </Button>
      </form>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-sm px-6 py-8 flex flex-col items-center gap-3 text-center">
        <Image
          src="/mascot.png"
          alt="FesKit マスコット"
          width={72}
          height={72}
          className="h-18 w-18 object-contain"
        />
        {children}
      </div>
    </div>
  );
}
