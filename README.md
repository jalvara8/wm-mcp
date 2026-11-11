# wm-mcp

A **remote MCP server** running on a Cloudflare Worker. It exposes the WM REST API and the twilight service-zone finder as MCP tools over Streamable HTTP, so it can be added to Claude (or any MCP client) as a custom connector.

- Endpoint: `https://<worker>.<your-subdomain>.workers.dev/mcp`
- Health: `GET /` → `{ name, status, endpoint, mock }`
- Runtime: Cloudflare Worker + Durable Object (`McpAgent`)

## Tools (18, all read-only)

**WM** — `wm_health_check`, `wm_get_balance`, `wm_get_invoices`, `wm_get_invoice_charge_details`, `wm_get_payment_history`, `wm_get_pending_charges`, `wm_list_services`, `wm_get_pickup_info`, `wm_get_service_history`, `wm_get_holidays`, `wm_get_account_alerts`, `wm_get_facility_contact`, `wm_list_endpoints`, `wm_get_endpoint`.

**Twilight** (service-zone finder) — `twilight_find_zone`, `twilight_get_zone_geometry`, `twilight_geocode`, `twilight_health`.

The WM endpoint catalog (211 entries) is in `src/catalog.ts`. These paths were reverse-engineered from the My WM web app; verify against WM's internal API spec before relying on them. No write tools yet.

## Configuration

Non-secret values live in `wrangler.jsonc` `vars`; secrets are set with `wrangler secret put`.

| Name | Kind | Purpose |
| --- | --- | --- |
| `WM_MOCK` | var | `1` = sample payloads, no live calls, no creds needed (default) |
| `WM_ENV` | var | `test` (default) or `prod` — picks WM base hosts |
| `TWILIGHT_BASE_URL` | var | twilight deployment base URL |
| `WM_CLIENT_ID` | secret | WM API client id (from apiaccess@wm.com) |
| `WM_BEARER_TOKEN` | secret | WM API JWT |
| `MCP_BEARER_TOKEN` | secret | optional — if set, callers must send `Authorization: Bearer <token>` |
| `WM_BASE_*` | var | optional per-host overrides (EBIZ/ESB/MULESOFT/RO_LEADS) |

Ships in **mock mode** (`WM_MOCK: "1"`) so it works end-to-end with no credentials. The twilight tools call the live `TWILIGHT_BASE_URL` when mock is off.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in only if testing live WM calls
npm run dev                      # wrangler dev on http://localhost:8787
# in another shell:
npm run inspect                  # MCP Inspector → connect Streamable HTTP to http://localhost:8787/mcp
```

Quick check without the inspector:
```bash
curl http://localhost:8787/                      # health
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
```

## Deploy to Cloudflare

```bash
npx wrangler login              # one-time, in a browser
npm run deploy                  # wrangler deploy
```

To go beyond mock mode, set secrets after the first deploy:
```bash
wrangler secret put WM_CLIENT_ID
wrangler secret put WM_BEARER_TOKEN
# then flip WM_MOCK to "0" in wrangler.jsonc (or `wrangler secret put` an override) and redeploy
```

Add to Claude as a custom connector using the deployed URL with `/mcp` appended.

## Security

The endpoint is **unauthenticated by default** — fine for mock mode, not for live customer data. Options before going live:
- Set `MCP_BEARER_TOKEN` (simple shared-secret lock), or
- Front it with OAuth via [`@cloudflare/workers-oauth-provider`](https://developers.cloudflare.com/agents/api-reference/securing-mcp-servers/) (the production path; Claude's connector supports OAuth).

Decide which before pointing it at real WM credentials.
