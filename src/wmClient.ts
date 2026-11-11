// Thin HTTP client that proxies to the WM REST API, injecting the auth headers
// the API expects (Authorization: Bearer <JWT>, ClientId, Request-Tracking-Id).
//
// Hosts are resolved per logical base so you can point at the test or prod
// environment with env vars. Defaults target the documented test environment.
import { randomUUID } from "node:crypto";
import type { WmBase } from "./catalog.js";

export interface WmConfig {
  bearerToken: string;
  clientId: string;
  bases: Record<WmBase, string>;
  mock: boolean;
}

// Documented + observed hosts. ESB carries the /v1 prefix per the WM docs.
// Override any of these via env (see loadConfig) when you move test -> prod.
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

export function loadConfig(): WmConfig {
  const mock = ["1", "true", "yes"].includes((process.env.WM_MOCK ?? "").toLowerCase());
  const bearerToken = process.env.WM_BEARER_TOKEN ?? "";
  const clientId = process.env.WM_CLIENT_ID ?? "";
  // In mock mode no live calls are made, so credentials are not required.
  if (!mock && (!bearerToken || !clientId)) {
    throw new Error(
      "WM_BEARER_TOKEN and WM_CLIENT_ID must be set (or set WM_MOCK=1 for mock mode). Request credentials via apiaccess@wm.com.",
    );
  }
  const env = (process.env.WM_ENV ?? "test").toLowerCase();
  const base = env === "prod" ? { ...PROD_BASES } : { ...TEST_BASES };

  // Per-base overrides, e.g. WM_BASE_EBIZ=https://apitest.wm.com/v1
  for (const key of Object.keys(base) as WmBase[]) {
    const override = process.env[`WM_BASE_${key}`];
    if (override) base[key] = override;
  }
  return { bearerToken, clientId, bases: base, mock };
}

export interface WmRequestOptions {
  method?: string;
  base: WmBase;
  path: string; // may contain {param} placeholders
  params?: Record<string, string | number | undefined>; // fills {placeholders}
  query?: Record<string, string | number | undefined>; // extra query params
  body?: unknown;
}

function fillPath(path: string, params: Record<string, string | number | undefined> = {}): string {
  return path.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = params[key];
    if (v === undefined || v === "") {
      throw new Error(`Missing required path/query parameter: ${key}`);
    }
    return encodeURIComponent(String(v));
  });
}

export class WmClient {
  constructor(private cfg: WmConfig) {}

  async request(opts: WmRequestOptions): Promise<{ status: number; body: unknown }> {
    const method = (opts.method ?? "GET").toUpperCase();
    const origin = this.cfg.bases[opts.base];
    const url = new URL(origin + fillPath(opts.path, opts.params));

    // Any {query} placeholders already live in the path template; append extras.
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.bearerToken}`,
      ClientId: this.cfg.clientId,
      "Request-Tracking-Id": randomUUID(),
      Accept: "application/json",
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response, keep raw text */
    }
    return { status: res.status, body };
  }
}
