import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | FesKit",
};

// 特定商取引法（通信販売）に基づく表記。ひな形段階のため、
// 事業者情報など個人情報にあたる項目はすべて【要記入】のままにしている。
const ROWS: { term: string; description: string }[] = [
  { term: "販売事業者", description: "【要記入】" },
  { term: "運営責任者", description: "【要記入】" },
  { term: "所在地", description: "【要記入】" },
  { term: "電話番号", description: "【要記入】" },
  { term: "メールアドレス", description: "【要記入】" },
  { term: "販売価格", description: "月額500円（税込／税別：【要記入】）" },
  {
    term: "商品代金以外の必要料金",
    description: "本サービスのご利用にあたるインターネット通信料はお客様のご負担となります。",
  },
  { term: "支払方法", description: "クレジットカード" },
  {
    term: "支払時期",
    description: "ご契約時に初回のお支払いが発生し、以降は1か月ごとに自動更新・自動課金されます。",
  },
  { term: "提供時期", description: "お支払い手続き完了後、直ちにご利用いただけます。" },
  {
    term: "解約の方法",
    description:
      "アプリ内の設定画面、またはメールアドレス（上記【要記入】）よりご連絡ください。次回更新日の前日までにお手続きいただいた場合、次回以降の請求は発生しません。",
  },
  {
    term: "返金の扱い",
    description:
      "サービスの性質上、お支払い済みの料金は日割りを含め返金いたしません。ただし法令により返金が必要と判断される場合はこの限りではありません。",
  },
];

export default function TokushohoPage() {
  return (
    <>
      <h1 className="text-lg font-bold text-foreground">特定商取引法に基づく表記</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        特定商取引法第11条（通信販売についての広告）に基づき、以下のとおり表示します。
        <br />
        ※このページはひな形です。【要記入】の項目は準備が整い次第、事業者が記入します。
      </p>

      <dl className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border bg-card">
        {ROWS.map((row) => (
          <div key={row.term} className="flex flex-col gap-1 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{row.term}</dt>
            <dd className="text-sm text-foreground leading-relaxed">{row.description}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
