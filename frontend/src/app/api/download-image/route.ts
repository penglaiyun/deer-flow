import type { NextRequest } from "next/server";

function sanitizeFilename(raw: string) {
  const trimmed = raw.trim();
  const safe = trimmed.replace(/[\\/:*?"<>|\r\n]+/g, "_");
  return safe.length > 0 ? safe : "image.png";
}

function inferFilenameFromUrl(url: URL) {
  const lastSegment = url.pathname.split("/").pop() ?? "";
  if (!lastSegment) {
    return "image.png";
  }
  const decoded = decodeURIComponent(lastSegment);
  return sanitizeFilename(decoded);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawUrl = searchParams.get("url");
  if (!rawUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return new Response("Unsupported url protocol", { status: 400 });
  }

  const upstreamResponse = await fetch(parsedUrl.toString(), {
    cache: "no-store",
  });
  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response("Failed to download image", {
      status: 502,
    });
  }

  const filename = sanitizeFilename(
    searchParams.get("filename") ?? inferFilenameFromUrl(parsedUrl),
  );
  const contentType =
    upstreamResponse.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = upstreamResponse.headers.get("content-length");
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(upstreamResponse.body, {
    status: 200,
    headers,
  });
}
