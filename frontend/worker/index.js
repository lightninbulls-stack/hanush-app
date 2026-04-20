const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
});

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
  return String(symbol ?? "").trim().toUpperCase();
}

function getBackendBaseUrl(env) {
  const value = String(env.BACKEND_BASE_URL ?? "").trim();
  if (!value) {
    throw new HttpError(500, "BACKEND_BASE_URL is not configured");
  }
  return value.replace(/\/+$/, "");
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new HttpError(401, "Missing bearer token");
  }

  return token;
}

async function requireUserEmail(request, env) {
  const token = getBearerToken(request);
  const meUrl = `${getBackendBaseUrl(env)}/auth/me`;

  let response;
  try {
    response = await fetch(meUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new HttpError(502, "Auth service is unavailable");
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload?.detail || "Invalid or expired token",
    );
  }

  const email = String(payload?.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new HttpError(502, "Auth service returned no user email");
  }

  return email;
}

async function listUserSymbols(env, email) {
  const result = await env.DB.prepare(
    `
      SELECT symbol
      FROM watchlist_items
      WHERE user_email = ?
      ORDER BY created_at DESC, symbol ASC
    `,
  )
    .bind(email)
    .all();

  return (result.results || []).map((row) => String(row.symbol));
}

async function getWatchlist(request, env) {
  const email = await requireUserEmail(request, env);
  const symbols = await listUserSymbols(env, email);
  return json({ symbols });
}

async function addWatchlist(request, env) {
  const email = await requireUserEmail(request, env);

  const body = await request.json().catch(() => ({}));
  const symbol = normalizeSymbol(body?.symbol);

  if (!symbol) {
    return json({ detail: "Symbol is required" }, 400);
  }

  if (symbol.length > 50) {
    return json({ detail: "Symbol is too long" }, 400);
  }

  await env.DB.prepare(
    `
      INSERT INTO watchlist_items (user_email, symbol)
      VALUES (?, ?)
      ON CONFLICT(user_email, symbol) DO NOTHING
    `,
  )
    .bind(email, symbol)
    .run();

  const symbols = await listUserSymbols(env, email);
  return json({ symbols, added: symbol });
}

async function deleteWatchlist(request, env, symbolFromPath) {
  const email = await requireUserEmail(request, env);
  const symbol = normalizeSymbol(symbolFromPath);

  if (!symbol) {
    return json({ detail: "Symbol is required" }, 400);
  }

  await env.DB.prepare(
    `
      DELETE FROM watchlist_items
      WHERE user_email = ? AND symbol = ?
    `,
  )
    .bind(email, symbol)
    .run();

  const symbols = await listUserSymbols(env, email);
  return json({ symbols, deleted: symbol });
}

async function proxyIntradaySpreads(env) {
  const backendUrl = `${getBackendBaseUrl(env)}/intraday-spreads/all`;

  let response;
  try {
    response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new HttpError(502, "Intraday spreads backend is unavailable");
  }

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      ...JSON_HEADERS,
      "content-type":
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
    },
  });
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
        if (request.method === "GET") return await getWatchlist(request, env);
        if (request.method === "POST") return await addWatchlist(request, env);
        return json({ detail: "Method not allowed" }, 405);
      }

      if (pathname.startsWith("/api/watchlist/")) {
        if (request.method === "DELETE") {
          const symbol = decodeURIComponent(
            pathname.replace("/api/watchlist/", ""),
          );
          return await deleteWatchlist(request, env, symbol);
        }
        return json({ detail: "Method not allowed" }, 405);
      }

      if (pathname === "/api/intraday-spreads/all") {
        if (request.method === "GET") {
          return await proxyIntradaySpreads(env);
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
