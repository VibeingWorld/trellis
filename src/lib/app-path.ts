const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const appBasePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

export function appPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${appBasePath}${normalized}`;
}

export function publicOrigin(request: { headers: Headers; nextUrl: URL }) {
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "");
  if (configured) {
    try { return new URL(configured).origin; } catch { /* Fall back to proxy headers. */ }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : request.nextUrl.protocol.replace(":", "");
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return request.nextUrl.origin;
  return `${protocol}://${host}`;
}
