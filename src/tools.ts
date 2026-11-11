// Registers all WM + twilight tools on an McpServer instance.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CATALOG } from "./catalog";
import type { AppConfig } from "./config";
import { mockFor } from "./fixtures";
import { WmClient } from "./wmClient";
import { TWILIGHT_MOCKS, twilightRequest } from "./twilight";

type Params = Record<string, string | number | undefined>;

function toResult(r: { status: number; body: unknown }) {
  return {
    isError: r.status >= 400,
    content: [{ type: "text" as const, text: JSON.stringify({ status: r.status, body: r.body }, null, 2) }],
  };
}

export function registerTools(server: McpServer, cfg: AppConfig): void {
  const client = new WmClient(cfg.wm);

  const ep = (name: string) => {
    const e = CATALOG.find((x) => x.name === name);
    if (!e) throw new Error(`Unknown endpoint ${name}`);
    return e;
  };

  const getWm = async (name: string, params: Params) => {
    if (cfg.mock) return toResult({ status: 200, body: mockFor(name, params) });
    const e = ep(name);
    return toResult(await client.request({ base: e.base, path: e.path, params }));
  };

  // --- Health ---------------------------------------------------------------
  server.registerTool(
    "wm_health_check",
    { description: "Call WM's documented hello-world endpoint to verify credentials and connectivity.", inputSchema: {} },
    async () => {
      if (cfg.mock) return toResult({ status: 200, body: mockFor("__helloworld", {}) });
      return toResult(await client.request({ base: "ESB", path: "/helloworld" }));
    },
  );

  // --- Account & billing (read-only) ---------------------------------------
  server.registerTool("wm_get_balance", { description: "Get the current balance for a customer account.", inputSchema: { customerId: z.string() } },
    async ({ customerId }) => getWm("BALANCE", { customerId }));

  server.registerTool("wm_get_invoices", { description: "Get invoices for a customer account.", inputSchema: { customerId: z.string() } },
    async ({ customerId }) => getWm("INVOICE", { customerId }));

  server.registerTool("wm_get_invoice_charge_details", { description: "Get line-item charges for one invoice.", inputSchema: { customerId: z.string(), userId: z.string(), invoiceNum: z.string(), lang: z.string().default("en_US") } },
    async (a) => getWm("INVOICE_CHARGE_DETAILS", a));

  server.registerTool("wm_get_payment_history", { description: "Get payment history for a customer account.", inputSchema: { customerId: z.string() } },
    async ({ customerId }) => getWm("PAYMENT_HISTORY", { customerId }));

  server.registerTool("wm_get_pending_charges", { description: "Get pending (not yet invoiced) charges.", inputSchema: { customerId: z.string(), userId: z.string() } },
    async (a) => getWm("PENDING_CHARGES", a));

  // --- Services & pickups (read-only) --------------------------------------
  server.registerTool("wm_list_services", { description: "List the services on a customer account.", inputSchema: { customerId: z.string() } },
    async ({ customerId }) => getWm("CUSTOMER_SERVICES", { customerId }));

  server.registerTool("wm_get_pickup_info", { description: "Get next/last pickup info for one service.", inputSchema: { customerId: z.string(), serviceId: z.string(), lang: z.string().default("en_US"), checkAlerts: z.enum(["Y", "N"]).default("Y") } },
    async (a) => getWm("GUEST_PICKUP_INFO", a));

  server.registerTool("wm_get_service_history", { description: "Get pickup history for one service over N days.", inputSchema: { customerId: z.string(), serviceId: z.string(), userId: z.string(), numOfDays: z.number().int().default(30), lang: z.string().default("en_US") } },
    async (a) => getWm("GET_SERVICE_HISTORY", a));

  server.registerTool("wm_get_holidays", { description: "Get holiday schedule impacts for a customer account.", inputSchema: { customerId: z.string(), locale: z.string().default("en_US"), type: z.string().default("") } },
    async (a) => getWm("HOLIDAYS_GUEST_BY_CUSTOMER_ID", a));

  server.registerTool("wm_get_account_alerts", { description: "Get service alerts for a customer account.", inputSchema: { customerId: z.string(), lang: z.string().default("en_US") } },
    async (a) => getWm("NOTIFICATIONS_BY_CUSTOMER_ID_GUEST", a));

  server.registerTool("wm_get_facility_contact", { description: "Get the servicing facility's contact info for an account.", inputSchema: { customerId: z.string(), locale: z.string().default("en_US") } },
    async (a) => getWm("CONTACT_INFO_GUEST_BY_CUSTOMER_ID", a));

  // --- Twilight: service-zone finder ---------------------------------------
  server.registerTool("twilight_find_zone", { description: "Find which WM service zone/polygon contains an address (twilight service).", inputSchema: { address: z.string().min(5), marketArea: z.number().int().min(0).max(26).optional() } },
    async ({ address, marketArea }) => {
      if (cfg.twilightMock) return toResult({ status: 200, body: TWILIGHT_MOCKS.findZone(address) });
      return toResult(await twilightRequest(cfg.twilightBase, "POST", "/api/geocode-and-query", { body: { address, marketArea } }));
    });

  server.registerTool("twilight_get_zone_geometry", { description: "Fetch polygon geometry (WGS84) for a zone's GIS id in a market area.", inputSchema: { gisId: z.string(), marketArea: z.number().int().min(0).max(26) } },
    async ({ gisId, marketArea }) => {
      if (cfg.twilightMock) return toResult({ status: 200, body: TWILIGHT_MOCKS.geometry(gisId, marketArea) });
      return toResult(await twilightRequest(cfg.twilightBase, "GET", `/api/geometry/${encodeURIComponent(gisId)}`, { query: { marketArea } }));
    });

  server.registerTool("twilight_geocode", { description: "Geocode an address via twilight (Mapbox), returning coordinates.", inputSchema: { address: z.string().min(5) } },
    async ({ address }) => {
      if (cfg.twilightMock) return toResult({ status: 200, body: TWILIGHT_MOCKS.geocode(address) });
      return toResult(await twilightRequest(cfg.twilightBase, "GET", "/api/test-geocoding", { query: { address } }));
    });

  server.registerTool("twilight_health", { description: "Check twilight's database and geocoding health.", inputSchema: {} },
    async () => {
      if (cfg.twilightMock) return toResult({ status: 200, body: TWILIGHT_MOCKS.health() });
      return toResult(await twilightRequest(cfg.twilightBase, "GET", "/api/health"));
    });

  // --- Catalog discovery + escape hatch ------------------------------------
  server.registerTool("wm_list_endpoints", { description: "List known WM endpoints (name, base, path). Optional substring filter.", inputSchema: { filter: z.string().optional() } },
    async ({ filter }) => {
      const f = filter?.toLowerCase();
      const rows = CATALOG.filter((e) => !f || e.name.toLowerCase().includes(f) || e.path.toLowerCase().includes(f));
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    });

  server.registerTool("wm_get_endpoint", { description: "GET any catalog endpoint by name, filling {placeholders} from params. Read-only.", inputSchema: { name: z.string(), params: z.record(z.string(), z.union([z.string(), z.number()])).default({}) } },
    async ({ name, params }) => getWm(name, params as Params));
}
