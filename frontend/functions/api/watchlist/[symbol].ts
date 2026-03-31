import {
  jsonResponse,
  optionsResponse,
  requireUserEmail,
  normalizeSymbol,
  type Env,
} from "../../_lib/auth";

export const onRequestOptions = async () => optionsResponse();

export const onRequestDelete = async (context: {
  request: Request;
  env: Env;
  params: { symbol?: string };
}) => {
  try {
    const email = await requireUserEmail(context.request, context.env);
    const symbol = normalizeSymbol(context.params?.symbol || "");

    if (!symbol) {
      return jsonResponse({ detail: "Symbol is required" }, 400);
    }

    await context.env.DB.prepare(
      `DELETE FROM watchlist_items
       WHERE user_email = ? AND symbol = ?`
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
    return jsonResponse({ symbols, deleted: symbol });
  } catch (error: any) {
    return jsonResponse({ detail: error?.message || "Unauthorized" }, 401);
  }
};
