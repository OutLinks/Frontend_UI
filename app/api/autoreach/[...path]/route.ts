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
  const configuredBaseUrl = process.env.AUTOREACH_API_URL;
  const secret = process.env.AUTOREACH_API_SECRET;
  if (!configuredBaseUrl || !secret) {
    return NextResponse.json(
      { detail: "AutoReach server configuration is incomplete." },
      { status: 503 },
    );
  }

  let baseUrl: string;
  try {
    const parsedUrl = new URL(configuredBaseUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported protocol");
    baseUrl = parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return NextResponse.json({ detail: "AutoReach server configuration is invalid." }, { status: 500 });
  }

  const { path } = await context.params;
  const cleanPath = path.join("/");
  const allowed = (method === "GET" ? ALLOWED_GET : ALLOWED_POST).some((pattern) => pattern.test(cleanPath));
  if (!allowed) return NextResponse.json({ detail: "This AutoReach operation is not exposed to the browser." }, { status: 404 });

  const requestBody = method === "POST" ? await request.text() : undefined;
  if (requestBody && requestBody.length > 25_000) {
    return NextResponse.json({ detail: "Request body is too large." }, { status: 413 });
  }

  const upstreamUrl = `${baseUrl}/${cleanPath}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: requestBody || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the AutoReach API." }, { status: 502 });
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}
