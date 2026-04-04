import { jwtVerify } from "jose";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

async function ensureSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      symbol TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_email, symbol)
    );
  `).run();
}

function getJwtSecret(env) {
  const secret = env.JWT_SECRET || env.SECRET_KEY;
  if (!secret) {
    throw new HttpError(500, "JWT secret is not configured");
  }
  return secret;
}

async function requireUserEmail(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new HttpError(401, "Missing bearer token");
  }

  try {
    const secret = new TextEncoder().encode(getJwtSecret(env));
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const email = payload.sub;
    if (typeof email !== "string" || !email.trim()) {
      throw new HttpError(401, "Invalid token subject");
    }

    return email.toLowerCase().trim();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "Invalid or expired token");
  }
}

async function listUserSymbols(env, email) {
  const result = await env.DB.prepare(`
    SELECT symbol
    FROM watchlist_items
    WHERE user_email = ?
    ORDER BY created_at ASC, symbol ASC
  `)
    .bind(email)
    .all();

  return (result.results || []).map((row) => String(row.symbol));
}

async function getWatchlist(request, env) {
  const email = await requireUserEmail(request, env);
  await ensureSchema(env);

  const symbols = await listUserSymbols(env, email);
  return json({ symbols });
}

async function addWatchlist(request, env) {
  const email = await requireUserEmail(request, env);
  await ensureSchema(env);

  const body = await request.json().catch(() => ({}));
  const symbol = normalizeSymbol(body?.symbol);

  if (!symbol) {
    return json({ detail: "Symbol is required" }, 400);
  }

  await env.DB.prepare(`
    INSERT OR IGNORE INTO watchlist_items (user_email, symbol)
    VALUES (?, ?)
  `)
    .bind(email, symbol)
    .run();

  const symbols = await listUserSymbols(env, email);
  return json({ symbols, added: symbol });
}

async function deleteWatchlist(request, env, symbolFromPath) {
  const email = await requireUserEmail(request, env);
  await ensureSchema(env);

  const symbol = normalizeSymbol(symbolFromPath);

  if (!symbol) {
    return json({ detail: "Symbol is required" }, 400);
  }

  await env.DB.prepare(`
    DELETE FROM watchlist_items
    WHERE user_email = ? AND symbol = ?
  `)
    .bind(email, symbol)
    .run();

  const symbols = await listUserSymbols(env, email);
  return json({ symbols, deleted: symbol });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: JSON_HEADERS,
      });
    }

    try {
      if (pathname === "/api/watchlist") {
        if (request.method === "GET") {
          return await getWatchlist(request, env);
        }

        if (request.method === "POST") {
          return await addWatchlist(request, env);
        }

        return json({ detail: "Method not allowed" }, 405);
      }

      if (pathname.startsWith("/api/watchlist/")) {
        if (request.method === "DELETE") {
          const symbol = decodeURIComponent(
            pathname.replace("/api/watchlist/", "")
          );
          return await deleteWatchlist(request, env, symbol);
        }

        return json({ detail: "Method not allowed" }, 405);
      }

      if (pathname.startsWith("/api/")) {
        return json({ detail: "Not found" }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = error?.status || 500;
      const message = error?.message || "Internal error";
      return json({ detail: message }, status);
    }
  },
};
