import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | FesKit",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. 取得する情報",
    body: [
      "当社は、本サービスの提供にあたり、以下の情報を取得します。",
      "・アカウント情報（メールアドレス、氏名、プロフィール画像など。認証基盤 Clerk を通じて取得）",
      "・出店プロジェクトの情報（材料・レシピ・価格・スケジュール・試作記録の写真等、ユーザーが入力する情報）",
      "・お支払いに関する情報（決済代行事業者を通じて処理し、当社はカード番号そのものを保持しません）",
    ],
  },
  {
    title: "2. 利用目的",
    body: [
      "取得した情報は、以下の目的で利用します。",
      "・本サービスの提供・維持・改善のため",
      "・お問い合わせへの対応のため",
      "・有料プランの契約管理・課金処理のため",
      "・利用規約に違反する行為への対応のため",
    ],
  },
  {
    title: "3. 外部サービスの利用",
    body: [
      "本サービスは、以下の外部サービスを利用して情報を処理します。各社のプライバシーポリシーも併せてご確認ください。",
      "・Clerk（認証・アカウント管理）",
      "・Turso（データベース）",
      "・Cloudflare R2（試作写真の保存）",
      "・Anthropic（AIによる価格提案・採算診断。商品名や原価等の情報を送信します。機能を無効化している場合は送信されません）",
      "・Vercel（アプリケーションのホスティング）",
    ],
  },
  {
    title: "4. 第三者提供",
    body: [
      "当社は、法令に基づく場合を除き、ユーザーの同意なく取得した情報を第三者に提供しません。",
    ],
  },
  {
    title: "5. 安全管理措置",
    body: [
      "当社は、取得した情報の漏えい、滅失またはき損の防止その他の安全管理のために必要かつ適切な措置を講じます。",
    ],
  },
  {
    title: "6. 開示・訂正・削除等の請求",
    body: [
      "ユーザーは、当社が保有する自己の情報について、開示・訂正・利用停止・削除を請求することができます。ご希望の場合は下記のお問い合わせ先までご連絡ください。",
    ],
  },
  {
    title: "7. プライバシーポリシーの変更",
    body: [
      "当社は、必要に応じて本ポリシーを変更することがあります。変更後の内容は、本サービス上に掲示した時点から効力を生じます。",
    ],
  },
  {
    title: "お問い合わせ",
    body: ["本ポリシーに関するお問い合わせは、【要記入】までお願いいたします。"],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-lg font-bold text-foreground">プライバシーポリシー</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        ※このページはひな形です。【要記入】の項目、および内容は事業者が確認のうえ確定します。
      </p>

      <div className="flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
