import { createServer } from "node:http";

// AI 採算診断の相手役（Claude API のふり）。
//
// なぜスタブを立てるか:
// AI 呼び出しは Server Action（src/actions/ai-simulation.ts）の中で起きるので、
// ブラウザ側の page.route では捕まえられない。dev サーバーの外向き通信を
// 差し替えるしかない。@ai-sdk/anthropic の既定プロバイダは ANTHROPIC_BASE_URL を
// 読むので、そこをここへ向ければアプリのコードを1行も変えずに差し替えられる。
//
// 返す中身はテストが指定する。アプリはリクエストに目印を付けてくれないので、
// **プロンプトに載っている商品ID**を鍵にする。
//
// 🔴 「次に返す1件」を持つ形にはしない。スタブは1つで、mobile-webkit と
// desktop-chromium の同じテストが並走しうる。1件だけ持つと後から差し込んだ側が
// 先の1件を上書きし、相手のテストに別の提案が返る。
// テストごとに seed した商品IDで引けば、混ざりようがない。

const PORT = Number(process.env.AI_STUB_PORT ?? 3457);

// 商品ID → 返す提案。テストが /__set で登録する。
const adviceByRecipeId = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

/**
 * Anthropic Messages API の応答を組み立てる。
 *
 * 構造化出力の渡し方はSDKのバージョンで違うので、リクエストを見て合わせる:
 *   - output_config.format（structured outputs）… JSON をそのまま text ブロックで返す
 *   - tools（ツール呼び出し）… tool_use ブロックの input で返す
 * @ai-sdk/anthropic v4 + ai v7 は前者を使う（2026-08-13 実測）。
 */
function messagesResponse(body, advice) {
  const base = {
    id: "msg_e2e_stub",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };

  if (body.output_config?.format?.type === "json_schema") {
    return {
      ...base,
      content: [{ type: "text", text: JSON.stringify(advice) }],
      stop_reason: "end_turn",
    };
  }

  const toolName = body.tools?.[0]?.name ?? "json";
  return {
    ...base,
    content: [{ type: "tool_use", id: "toolu_e2e_stub", name: toolName, input: advice }],
    stop_reason: "tool_use",
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (process.env.AI_STUB_DEBUG) console.log(`[ai-stub] ${req.method} ${url.pathname}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  // テストが「この商品IDを含むプロンプトにはこの提案を返す」を登録する。
  if (url.pathname === "/__set" && req.method === "POST") {
    const { key, advice } = JSON.parse(await readBody(req));
    adviceByRecipeId.set(key, advice);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname.endsWith("/messages") && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    // プロンプトに載っている商品IDで、どのテスト向けの相談かを見分ける。
    const prompt = JSON.stringify(body.messages ?? "");
    let advice = null;
    for (const [key, value] of adviceByRecipeId) {
      if (prompt.includes(key)) {
        advice = value;
        break;
      }
    }

    if (process.env.AI_STUB_DEBUG) {
      console.log("[ai-stub] output_config:", JSON.stringify(body.output_config));
      console.log("[ai-stub] matched:", advice ? "yes" : "no");
    }

    if (!advice) {
      // 登録が無いのに呼ばれたら、黙って既定を返さずエラーにする。
      // 黙って返すと「別のテストの提案が返っていた」ことに気づけない。
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          type: "error",
          error: { type: "e2e_stub_error", message: "この商品IDの提案が登録されていない" },
        }),
      );
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(messagesResponse(body, advice)));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`[ai-stub] listening on http://localhost:${PORT}`);
});
