//This cloudflare worker responds to requests to status.antaresnetwork.com and proxies them to status1.antaresnetwork.com.
//If the request fails after 2 seconds, then the requests are proxied to the alternate page at status2.antaresnetwork.com.
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Attempt to fetch from status1.antaresnetwork.com with a 2-second timeout
  let primaryURL = new URL(request.url);
  primaryURL.hostname = "status1.antaresnetwork.com";

  let fetchPromise = fetch(primaryURL.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  });

  let timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000))
  try {
    let response = await Promise.race([fetchPromise, timeoutPromise]);
    console.log(request.status)

    // If the status code is anything numerically above 500, failover
    if (response.status >= 500) {
      throw new Error('Primary server error');
    }

    // If the status code is less than 500, serve from the primary URL
    return response;
  } catch (error) {
    // Timeout occurred or primary server error, failover to status2.antaresnetwork.com
    let failoverURL = new URL(request.url);
    failoverURL.hostname = "status2.antaresnetwork.com";
    return fetch(failoverURL.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });
  }
}
