import {
  jsonResponse,
  optionsResponse,
  requireUserEmail,
  normalizeSymbol,
  type Env,
} from "../../_lib/auth";

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const email = await requireUserEmail(context.request, context.env);

    const result = await context.env.DB.prepare(
      `SELECT symbol
       FROM watchlist_items
       WHERE user_email = ?
       ORDER BY created_at ASC, symbol ASC`
    )
      .bind(email)
      .all();

    const symbols = (result.results || []).map((row: any) => String(row.symbol));
    return jsonResponse({ symbols });
  } catch (error: any) {
    return jsonResponse({ detail: error?.message || "Unauthorized" }, 401);
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const email = await requireUserEmail(context.request, context.env);
    const body = await context.request.json();
    const symbol = normalizeSymbol(body?.symbol);

    if (!symbol) {
      return jsonResponse({ detail: "Symbol is required" }, 400);
    }

    await context.env.DB.prepare(
      `INSERT OR IGNORE INTO watchlist_items (user_email, symbol)
       VALUES (?, ?)`
    )
      .bind(email, symbol)
      .run();

    const result = await context.env.DB.prepare(
      `SELECT symbol
       FROM watchlist_items
       WHERE user_email = ?
       ORDER BY created_at ASC, symbol ASC`
    )
      .bind(email)
      .all();

    const symbols = (result.results || []).map((row: any) => String(row.symbol));
    return jsonResponse({ symbols, added: symbol });
  } catch (error: any) {
    return jsonResponse({ detail: error?.message || "Unauthorized" }, 401);
  }
};
