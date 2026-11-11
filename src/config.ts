// Worker environment bindings and runtime config.
// Secrets (WM_CLIENT_ID, WM_BEARER_TOKEN, MCP_BEARER_TOKEN) are set with
// `wrangler secret put`; non-secret values can live in wrangler.jsonc `vars`.
import type { WmBase } from "./catalog";

export interface Env {
  // Durable Object namespace backing the McpAgent
  WM_MCP: DurableObjectNamespace;

  // WM API credentials (secrets) — not required in mock mode
  WM_CLIENT_ID?: string;
  WM_BEARER_TOKEN?: string;

  // "test" (default) or "prod"
  WM_ENV?: string;
  // "1" | "true" | "yes" to serve sample payloads with no live calls
  WM_MOCK?: string;

  // Twilight service-zone finder base URL
  TWILIGHT_BASE_URL?: string;

  // Optional per-base host overrides
  WM_BASE_EBIZ?: string;
  WM_BASE_ESB?: string;
  WM_BASE_MULESOFT?: string;
  WM_BASE_RO_LEADS?: string;

  // Optional static bearer token to gate the endpoint (simple lock, not OAuth)
  MCP_BEARER_TOKEN?: string;
}

export interface AppConfig {
  mock: boolean;
  wm: {
    bearerToken: string;
    clientId: string;
    bases: Record<WmBase, string>;
  };
  twilightBase: string;
}

const TEST_BASES: Record<WmBase, string> = {
  EBIZ: "https://apitest.wm.com/v1",
  ESB: "https://apitest.wm.com/v1",
  MULESOFT: "https://apitest.wm.com",
  RO_LEADS: "https://apitest.wm.com",
};

const PROD_BASES: Record<WmBase, string> = {
  EBIZ: "https://rest-api.wm.com",
  ESB: "https://webapi.wm.com/v1",
  MULESOFT: "https://cloudwebapi.wm.com",
  RO_LEADS: "https://api-graph-leads.wm.com",
};

export function buildConfig(env: Env): AppConfig {
  const mock = ["1", "true", "yes"].includes((env.WM_MOCK ?? "").toLowerCase());
  const bases = (env.WM_ENV ?? "test").toLowerCase() === "prod" ? { ...PROD_BASES } : { ...TEST_BASES };
  if (env.WM_BASE_EBIZ) bases.EBIZ = env.WM_BASE_EBIZ;
  if (env.WM_BASE_ESB) bases.ESB = env.WM_BASE_ESB;
  if (env.WM_BASE_MULESOFT) bases.MULESOFT = env.WM_BASE_MULESOFT;
  if (env.WM_BASE_RO_LEADS) bases.RO_LEADS = env.WM_BASE_RO_LEADS;

  return {
    mock,
    wm: {
      bearerToken: env.WM_BEARER_TOKEN ?? "",
      clientId: env.WM_CLIENT_ID ?? "",
      bases,
    },
    twilightBase: env.TWILIGHT_BASE_URL ?? "http://localhost:3000",
  };
}
