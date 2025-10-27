//This cloudflare worker responds to requests to status.antaresnetwork.com and proxies them to status1.antaresnetwork.com.
//If the request fails after 2 seconds, then the requests are proxied to the alternate page at status2.antaresnetwork.com.

// In-memory health cache (per Cloudflare Worker isolate)
let primaryIsHealthy = true;
let lastHealthCheck = 0;

const PRIMARY_HOST = "status1.antaresnetwork.com";
const SECONDARY_HOST = "status2.antaresnetwork.com";
const HEALTH_CACHE_TTL = 30_000; // 30 seconds
const FETCH_TIMEOUT_MS = 2000;   // 2 seconds

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const now = Date.now();

  // If we recently marked primary as down, skip it for TTL period
  if (!primaryIsHealthy && now - lastHealthCheck < HEALTH_CACHE_TTL) {
    return fetchFromHost(request, SECONDARY_HOST);
  }

  try {
    const response = await fetchFromHost(request, PRIMARY_HOST, true);
    // Primary worked, mark it healthy
    primaryIsHealthy = true;
    lastHealthCheck = now;
    return response;
  } catch (err) {
    // Primary failed — mark unhealthy and switch to failover
    primaryIsHealthy = false;
    lastHealthCheck = now;
    return fetchFromHost(request, SECONDARY_HOST);
  }
}

async function fetchFromHost(request, host, useTimeout = false) {
  const isWebSocket = request.headers.get("Upgrade") === "websocket";
  const url = new URL(request.url);
  url.hostname = host;

  const reqInit = {
    method: request.method,
    headers: request.headers,
    redirect: "follow",
    body: request.bodyUsed ? null : request.body
  };

  if (isWebSocket) {
    // WebSocket mode: connect directly, no timeout
    const wsResponse = await fetch(`https://${host}${url.pathname}${url.search}`, reqInit);
    if (!wsResponse.ok || wsResponse.status >= 500) {
      throw new Error(`WebSocket connection failed to ${host}`);
    }
    return wsResponse;
  }

  // HTTP(S) mode
  const targetUrl = `https://${host}${url.pathname}${url.search}`;
  const response = useTimeout
    ? await fetchWithTimeout(targetUrl, reqInit, FETCH_TIMEOUT_MS)
    : await fetch(targetUrl, reqInit);

  if (!response.ok || response.status >= 500) {
    throw new Error(`Primary server error ${response.status}`);
  }

  return response;
}

function fetchWithTimeout(url, options, timeoutMs) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
  ]);
}
