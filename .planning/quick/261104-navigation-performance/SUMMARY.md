# Navigation performance — 2026-11-04

## Findings and changes

- The production response for `/login` reported `gru1::iad1`: traffic entered São Paulo and executed in the US. The linked database's pooler is in `sa-east-1`. `vercel.json` now selects `gru1` to put compute near the database. Production subsequently reported `gru1::gru1`.
- The navigation proxy previously called `auth.getUser()` for every request. It now uses `getClaims()` to validate signatures with cached JWKS, including SDK refresh and symmetric-key fallback. The linked project's public JWKS endpoint returned HTTP 200 and ES256 keys.
- Page and mutation authorization still verifies the current user and database permissions. Session-bound data is not cached across users. Refresh responses preserve private cache headers and cookies, including login redirects.
- Public images skip the auth proxy. Events, volunteers and finance pages reuse request-scoped identity/profile lookups. Independent event permission checks run alongside event queries.

## Public-route measurement

Same client and URL (`https://painel.ectolab.org/login`), sequential HTTPS requests, milliseconds to response headers:

| Configuration | Samples | Median |
| --- | --- | --- |
| US function (`gru1::iad1`) | 1080, 439, 408 | 439 ms |
| São Paulo function (`gru1::gru1`) | 396, 268, 287 | 287 ms |

This small sample suggests lower warm response latency; it does not measure authenticated navigation, browser rendering, or all routes. A separate first request after publication took 1377 ms, so cold-start latency remains relevant.

Detailed deployment/observability access returned HTTP 403 for the connected Vercel team. No authenticated browser session was available; database-heavy route timings remain unmeasured.

## Cloudflare

Keep Vercel as the HTTP delivery layer. Another reverse proxy does not remove server/database round trips and complicates caching for authenticated RSC responses. Cloudflare can still host DNS with the application record set to DNS-only.

References: [Vercel region configuration](https://vercel.com/docs/functions/configuring-functions/region), [Vercel reverse proxy guidance](https://vercel.com/kb/guide/can-i-use-a-proxy-on-top-of-my-vercel-deployment), [Supabase SSR authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
