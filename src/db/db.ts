import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const syncUrl = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN!;

// Embedded Replica 用のローカルレプリカパス。
// 設定されている場合のみローカルレプリカ方式に切り替える。
// Vercel では書き込み可能な /tmp 配下を指定すること（例: file:/tmp/feskit-replica.db）。
const replicaPath = process.env.TURSO_REPLICA_PATH;

// バックグラウンド同期の間隔（秒）。未設定なら 60 秒。
const syncInterval = process.env.TURSO_SYNC_INTERVAL
  ? Number(process.env.TURSO_SYNC_INTERVAL)
  : 60;

function createDbClient(): Client {
  // Embedded Replica モード:
  //   読み取りはローカルレプリカから（高速）、書き込みはプライマリへ転送し pull で反映。
  //   read_your_writes はデフォルト有効なので、自分の書き込みは即座にローカルへ反映される。
  if (replicaPath) {
    return createClient({
      url:          replicaPath,
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
