# wm-mcp

A read-only MCP server that proxies to the WM REST API. It's a starting point for the modernization work: the tools are wired up and the auth plumbing is in place. Real credentials and verified response schemas still need to be added.

## Where the endpoints came from

`src/catalog.ts` lists 211 endpoints. They were reverse-engineered from the My WM web app bundle (`www.wm.com/static/index-*.js`), so they reflect what the live site calls. This is **not** an official contract. Check paths, methods and response shapes against WM's internal API spec (OpenAPI, Swagger or Postman) before relying on them.

Hosts the live app uses (prod):

| Base | Host | Notes |
| --- | --- | --- |
| EBIZ | `rest-api.wm.com` | Main customer API: account, billing, services, pickups, payments |
| ESB | `webapi.wm.com/v1` | Customers, contacts, locations, products, orders, token |
| MULESOFT | `cloudwebapi.wm.com` | Communication preferences, contacts, callback |
| RO_LEADS | `api-graph-leads.wm.com` | Roll-off leads (GraphQL) |

The public docs at `api.wm.com` describe `apitest.wm.com/v1` (test) and `api.wm.com/v1` (prod). The only test endpoint they confirm is `/helloworld`. The test hosts for EBIZ, MuleSoft and RO_LEADS in `wmClient.ts` are placeholders. Set the real ones with `WM_BASE_*` env vars once you have them.

## Auth

Every call sends these headers, as the WM docs specify:

- `Authorization: Bearer <JWT>`
- `ClientId: <id>`
- `Request-Tracking-Id: <uuid>`

Request a token and ClientId for this project through **apiaccess@wm.com**. Don't reuse the client IDs or tokens embedded in the public web app. Those belong to WM's own front end, and this server should run under its own credential so it can be scoped, monitored and revoked.

## Setup

```bash
npm install
cp .env.example .env   # fill in WM_BEARER_TOKEN, WM_CLIENT_ID
npm run build
set -a; . ./.env; set +a
npm run inspect        # opens MCP Inspector; run wm_health_check first
```

### Mock mode (no credentials)

Set `WM_MOCK=1` to run with sample payloads and no live calls — useful for building the UI before a real token exists. Every read tool returns an illustrative shape from `src/fixtures.ts`:

```bash
WM_MOCK=1 npm run inspect
```

The fixtures are made-up shapes, not real responses or real customer data. Replace them with verified schemas once the live API is reachable. Claude Desktop / Claude Code: add `"WM_MOCK": "1"` to the server's `env` block.

Claude Desktop / Claude Code config:

```json
{
  "mcpServers": {
    "wm": {
      "command": "node",
      "args": ["/path/to/wm-mcp/dist/index.js"],
      "env": { "WM_BEARER_TOKEN": "...", "WM_CLIENT_ID": "...", "WM_ENV": "test" }
    }
  }
}
```

## Tools (all read-only)

- `wm_health_check`: calls `/helloworld`
- `wm_get_balance`, `wm_get_invoices`, `wm_get_invoice_charge_details`, `wm_get_payment_history`, `wm_get_pending_charges`
- `wm_list_services`, `wm_get_pickup_info`, `wm_get_service_history`, `wm_get_holidays`, `wm_get_account_alerts`, `wm_get_facility_contact`
- `wm_list_endpoints`: searches the catalog
- `wm_get_endpoint`: sends a GET to any catalog endpoint by name

There are no write tools yet (payments, pickup scheduling, service changes). Add them deliberately, with confirmation prompts, once the read path works against the test environment.

## Next steps

1. Get a test ClientId and token, then get `wm_health_check` returning 200.
2. Get the internal API spec, then replace `JSON.stringify(body)` with typed, trimmed responses.
3. Confirm the test hosts for each base.
4. Decide on per-user auth (Okta / `ssologin.wm.com`) versus a service credential.
