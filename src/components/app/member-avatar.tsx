type Props = {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  className?: string;
};

// アバター丸の共通見た目（+N オーバーフロー表示など、丸型フォールバックを流用する箇所と共有する）
export const AVATAR_FALLBACK_CLASS =
  "w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground";

// メンバー1人分のアバター丸（画像がなければ名前/メールの頭文字）
export function MemberAvatar({ name, email, avatarUrl, className = "" }: Props) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`w-8 h-8 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`${AVATAR_FALLBACK_CLASS} ${className}`}>
      {(name ?? email)[0].toUpperCase()}
    </div>
  );
}
