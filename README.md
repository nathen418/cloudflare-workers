## Cloudflare Workers


**Link:** [statusfailover.js](https://github.com/nathen418/cloudflare-workers/blob/main/statusfailover.js)

**How it works:**  
This worker looks at every request to the primary domain ([https://status.antaresnetwork.com](https://status.antaresnetwork.com)), starts 2 promises, and if the real site responds before the promise with a 5-second timeout, the request passes.

Else, if the 5-second timer expires before a response is heard from the primary URL, a request is made to the backup status page ([https://status2.antaresnetwork.com](https://status2.antaresnetwork.com)), and the request is then sent to the client as if it came from the original domain.

This means that even if the primary domain webserver goes down, another webserver can still respond on the same domain.
