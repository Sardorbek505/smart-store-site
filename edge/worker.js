const DOMAIN = "metov.store";
const GUIDE = "/programma-dlya-magazina-instrumentov";

function secure(response, request, preview = false) {
  const headers = new Headers(response.headers);
  if (/^text\/html(?:\s*;|$)/i.test(headers.get("Content-Type") || "")) {
    // Keep the reviewed HTML and CSP intact when passing through Cloudflare.
    // This also prevents automatic Web Analytics beacon injection.
    const cache = headers.get("Cache-Control") || "no-cache";
    headers.set("Cache-Control", `${cache}, no-transform`);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  // Independent of the exact script hashes in each HTML document's meta CSP.
  headers.append("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Other metov.store projects are outside this deployment.
  headers.set("Strict-Transport-Security", "max-age=15552000");
  if (preview) headers.set("X-Robots-Tag", "noindex");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canonical =
      url.hostname === DOMAIN || url.hostname === `www.${DOMAIN}`;
    const preview = !canonical;
    if (request.method !== "GET" && request.method !== "HEAD")
      return secure(
        new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } }),
        request,
        preview,
      );

    const destination = new URL(url);
    if (canonical) {
      destination.hostname = DOMAIN;
      destination.protocol = "https:";
      destination.port = "";
    }
    if (["/demo", "/demo/", "/demo/index.html"].includes(url.pathname)) {
      destination.pathname = "/";
      destination.search = "";
      destination.hash = "workspace";
    } else if (url.pathname === "/index.html") destination.pathname = "/";
    else if ([GUIDE, `${GUIDE}/index.html`].includes(url.pathname))
      destination.pathname = `${GUIDE}/`;
    if (destination.href !== url.href)
      return secure(
        new Response(null, {
          status: 301,
          headers: { Location: destination.href, "Cache-Control": "no-cache" },
        }),
        request,
        preview,
      );

    // Explicit directory mapping preserves the current .html canonical URLs.
    const assetUrl = new URL(url);
    if (assetUrl.pathname.endsWith("/")) assetUrl.pathname += "index.html";
    try {
      const upstream = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(upstream.headers);
      const immutable = /^\/assets\/.+\.[a-f0-9]{12}\.(?:css|js)$/.test(
        url.pathname,
      );
      headers.set(
        "Cache-Control",
        upstream.status >= 400
          ? "no-store"
          : immutable
            ? "public, max-age=31536000, immutable"
            : "public, no-cache",
      );
      return secure(
        new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        }),
        request,
        preview,
      );
    } catch {
      return secure(
        new Response("Страница временно недоступна. Попробуйте позже.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "Retry-After": "60",
          },
        }),
        request,
        preview,
      );
    }
  },
};
