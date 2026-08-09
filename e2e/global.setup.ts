import { clerkSetup } from "@clerk/testing/playwright";

// Clerk の Testing Token を取得してテスト全体で使えるようにする。
//
// なぜ要るか: このインスタンスは bot_protection.captcha_enabled = true なので、
// 素のヘッドレスブラウザはサインイン画面でボット検知に弾かれる。
// Testing Token は Clerk が検証用に用意している正規の仕組みで、
// この開発インスタンスに対してのみ有効（本番インスタンスでは効かない）。
export default async function globalSetup() {
  await clerkSetup();
}
