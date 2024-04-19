addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
async function handleRequest(request) {
  let fetchPromise = fetch(request)
  let timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000))
  let response = await Promise.race([fetchPromise, timeoutPromise])

  if (response) {
    if ((response.status >= 500)){
      var failoverURL = new URL(request.url)
      failoverURL.hostname = "status2.antaresnetwork.com"
      return fetch(failoverURL, request, { cf: { resolveOverride: 'status.antaresnetwork.com' } })
    }
    return response;
    
  } else {
      var failoverURL = new URL(request.url)
      failoverURL.hostname = "status2.antaresnetwork.com"
    return fetch(failoverURL, request, { cf: { resolveOverride: 'status.antaresnetwork.com' } })
}}
