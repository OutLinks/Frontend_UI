import { NextRequest, NextResponse } from "next/server";

const ALLOWED_GET = [
  /^v1\/config$/,
  /^v1\/campaigns$/,
  /^v1\/campaigns\/[^/]+$/,
  /^v1\/jobs$/,
  /^v1\/jobs\/[^/]+$/,
  /^v1\/leads$/,
  /^v1\/health$/,
  /^v1\/report$/,
];

const ALLOWED_POST = [
  /^v1\/campaigns$/,
  /^v1\/campaigns\/[^/]+\/activate$/,
  /^v1\/jobs\/find$/,
  /^v1\/jobs\/cycle$/,
  /^v1\/jobs\/stages\/(find|research|write|send|followup|reply)$/,
];

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST") {
  const baseUrl = (process.env.AUTOREACH_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const secret = process.env.AUTOREACH_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { detail: "AutoReach is not configured. Set AUTOREACH_API_SECRET in the Next.js server environment." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const cleanPath = path.join("/");
  const allowed = (method === "GET" ? ALLOWED_GET : ALLOWED_POST).some((pattern) => pattern.test(cleanPath));
  if (!allowed) return NextResponse.json({ detail: "This AutoReach operation is not exposed to the browser." }, { status: 404 });

  const upstreamUrl = `${baseUrl}/${cleanPath}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? await request.text() || undefined : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    return NextResponse.json({ detail: `Unable to reach the AutoReach API: ${message}` }, { status: 502 });
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}

