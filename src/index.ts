#!/usr/bin/env node
// WM MCP server: a read-only proxy over the WM REST API.
// Credentials come from env (WM_BEARER_TOKEN, WM_CLIENT_ID), issued by WM via apiaccess@wm.com.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATALOG, type WmBase } from "./catalog.js";
import { WmClient, loadConfig } from "./wmClient.js";
import { mockFor } from "./fixtures.js";

const config = loadConfig();
const client = new WmClient(config);
const server = new McpServer({ name: "wm-mcp", version: "0.1.0" });

if (config.mock) {
  // Surfaced on the stderr log so it's obvious which mode the server is in.
  console.error("[wm-mcp] MOCK MODE: returning sample payloads, no live WM calls.");
}

const lang = z.string().default("en_US").describe("Locale, e.g. en_US");

function result(r: { status: number; body: unknown }) {
  const isError = r.status >= 400;
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify({ status: r.status, body: r.body }, null, 2) }],
  };
}

// Look up a catalog entry by name so tool paths stay in one place.
function ep(name: string) {
  const e = CATALOG.find((x) => x.name === name);
  if (!e) throw new Error(`Unknown endpoint ${name}`);
  return e;
}

function mockResult(name: string, params: Record<string, string | number | undefined>) {
  return result({ status: 200, body: mockFor(name, params) });
}

async function get(name: string, params: Record<string, string | number | undefined>) {
  if (config.mock) return mockResult(name, params);
  const e = ep(name);
  return result(await client.request({ base: e.base, path: e.path, params }));
}

// --- Health check -----------------------------------------------------------
server.tool("wm_health_check", "Call WM's documented hello-world endpoint to verify credentials and connectivity.", {}, async () => {
  if (config.mock) return mockResult("__helloworld", {});
  return result(await client.request({ base: "ESB", path: "/helloworld" }));
});

// --- Account & billing (read-only) ------------------------------------------
server.tool("wm_get_balance", "Get the current balance for a customer account.",
  { customerId: z.string() },
  async ({ customerId }) => get("BALANCE", { customerId }));

server.tool("wm_get_invoices", "Get invoices for a customer account.",
  { customerId: z.string() },
  async ({ customerId }) => get("INVOICE", { customerId }));

server.tool("wm_get_invoice_charge_details", "Get line-item charges for one invoice.",
  { customerId: z.string(), userId: z.string(), invoiceNum: z.string(), lang },
  async (a) => get("INVOICE_CHARGE_DETAILS", a));

server.tool("wm_get_payment_history", "Get payment history for a customer account.",
  { customerId: z.string() },
  async ({ customerId }) => get("PAYMENT_HISTORY", { customerId }));

server.tool("wm_get_pending_charges", "Get pending (not yet invoiced) charges.",
  { customerId: z.string(), userId: z.string() },
  async (a) => get("PENDING_CHARGES", a));

// --- Services & pickups (read-only) -----------------------------------------
server.tool("wm_list_services", "List the services on a customer account.",
  { customerId: z.string() },
  async ({ customerId }) => get("CUSTOMER_SERVICES", { customerId }));

server.tool("wm_get_pickup_info", "Get next/last pickup info for one service.",
  { customerId: z.string(), serviceId: z.string(), lang, checkAlerts: z.enum(["Y", "N"]).default("Y") },
  async (a) => get("GUEST_PICKUP_INFO", a));

server.tool("wm_get_service_history", "Get pickup history for one service over N days.",
  { customerId: z.string(), serviceId: z.string(), userId: z.string(), numOfDays: z.number().int().default(30), lang },
  async (a) => get("GET_SERVICE_HISTORY", a));

server.tool("wm_get_holidays", "Get holiday schedule impacts for a customer account.",
  { customerId: z.string(), locale: z.string().default("en_US"), type: z.string().default("") },
  async (a) => get("HOLIDAYS_GUEST_BY_CUSTOMER_ID", a));

server.tool("wm_get_account_alerts", "Get service alerts for a customer account.",
  { customerId: z.string(), lang },
  async (a) => get("NOTIFICATIONS_BY_CUSTOMER_ID_GUEST", a));

server.tool("wm_get_facility_contact", "Get the servicing facility's contact info for an account.",
  { customerId: z.string(), locale: z.string().default("en_US") },
  async (a) => get("CONTACT_INFO_GUEST_BY_CUSTOMER_ID", a));

// --- Catalog discovery + escape hatch ---------------------------------------
server.tool("wm_list_endpoints", "List known WM endpoints (name, base, path). Optional substring filter.",
  { filter: z.string().optional() },
  async ({ filter }) => {
    const f = filter?.toLowerCase();
    const rows = CATALOG.filter((e) => !f || e.name.toLowerCase().includes(f) || e.path.toLowerCase().includes(f));
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  });

server.tool("wm_get_endpoint", "GET any catalog endpoint by name, filling {placeholders} from params. Read-only.",
  { name: z.string(), params: z.record(z.union([z.string(), z.number()])).default({}) },
  async ({ name, params }) => get(name, params));

await server.connect(new StdioServerTransport());
