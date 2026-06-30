import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const syncUrl = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN!;

// Embedded Replica 用のローカルレプリカパス。
// 設定されている場合のみローカルレプリカ方式に切り替える。
const replicaPath = process.env.TURSO_REPLICA_PATH;

// 埋め込みレプリカを実際に使うかどうか。
// Vercel などのサーバーレスはリクエストごとに別インスタンス＝別ローカルレプリカに
// なり得る。read_your_writes は「同じクライアント接続内」しか保証しないため、
// 「プロジェクト/レシピを作成 → 別インスタンスで遷移先を表示」したときに、
// まだ同期されていないレプリカを読んで存在チェックに失敗し notFound()（404）が頻発する。
// 埋め込みレプリカは常駐サーバー向けの仕組みなので、サーバーレスでは無効化して
// 常にプライマリ直結（=常に最新）で読む。環境変数の設定ミスでも安全側に倒すため、
// TURSO_REPLICA_PATH が設定されていても Vercel 上では使わない。
const isServerless = Boolean(process.env.VERCEL);
const useReplica = Boolean(replicaPath) && !isServerless;

// バックグラウンド同期の間隔（秒）。未設定なら 60 秒。
const syncInterval = process.env.TURSO_SYNC_INTERVAL
  ? Number(process.env.TURSO_SYNC_INTERVAL)
  : 60;

function createDbClient(): Client {
  // Embedded Replica モード:
  //   読み取りはローカルレプリカから（高速）、書き込みはプライマリへ転送し pull で反映。
  //   read_your_writes はデフォルト有効なので、自分の書き込みは即座にローカルへ反映される。
  if (useReplica) {
    return createClient({
      url:          replicaPath!,
      syncUrl,
      authToken,
      syncInterval,
    });
  }

  // 通常モード（ローカル開発・レプリカ未設定時）: リモートに直結。
  return createClient({
    url: syncUrl,
    authToken,
  });
}

// 開発時の HMR やサーバーレスのモジュール再評価で
// クライアント（＝ローカルレプリカファイル）が多重に開かれるのを防ぐためシングルトン化する。
const globalForDb = globalThis as unknown as {
  libsqlClient?: Client;
};

const client = globalForDb.libsqlClient ?? createDbClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.libsqlClient = client;
}

export const db = drizzle(client, { schema });
