import { jwtVerify } from "jose";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function normalizeSymbol(symbol: string): string {
  return String(symbol || "").trim().toUpperCase();
}

export async function requireUserEmail(request: Request, env: Env): Promise<string> {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new Error("Missing bearer token");
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  const email = payload.sub;
  if (typeof email !== "string" || !email) {
    throw new Error("Invalid token subject");
  }

  return email.toLowerCase().trim();
}
