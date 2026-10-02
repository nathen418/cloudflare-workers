// Cloudflare Worker: status.antaresnetwork.com
// Proxies to the first healthy backend, failing over in priority order.
// A backend is skipped for UNHEALTHY_TTL_MS after a failure (per-isolate cache).

const BACKENDS = [
  { host: "status1.antaresnetwork.com", timeoutMs: 2000 },
  { host: "status2.antaresnetwork.com", timeoutMs: 2500 },
  { host: "status3.antaresnetwork.com", timeoutMs: 5000 },
];

const UNHEALTHY_TTL_MS = 30000;

const unhealthyUntil = new Map();

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";

    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    const init = {
      method: request.method,
      headers: request.headers,
      body,
      redirect: "manual",
    };

    const now = Date.now();
    const isHealthy = (b) => (unhealthyUntil.get(b.host) ?? 0) <= now;
    const candidates = [
      ...BACKENDS.filter(isHealthy),
      ...BACKENDS.filter((b) => !isHealthy(b)),
    ];

    let lastError;
    let lastResponse;

    for (const backend of candidates) {
      try {
        const response = await fetchWithTimeout(buildUrl(backend.host, url), init, backend.timeoutMs);

        const ok = isWebSocket
          ? response.status === 101
          : response.status === 200 || (response.status >= 300 && response.status < 400);

        if (!ok) {
          lastResponse?.body?.cancel();
          lastResponse = response;
          throw new Error(`HTTP ${response.status}`);
        }

        unhealthyUntil.delete(backend.host);
        return response;
      } catch (err) {
        lastError = err;
        unhealthyUntil.set(backend.host, Date.now() + UNHEALTHY_TTL_MS);
        console.log(`${backend.host} failed: ${err.message}`);
      }
    }

    if (lastResponse) return lastResponse;
    return new Response(`All backends failed: ${lastError?.message ?? "unknown"}`, { status: 502 });
  },
};

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Timeout after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(host, url) {
  return `https://${host}${url.pathname}${url.search}`;
}
