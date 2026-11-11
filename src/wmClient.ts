// HTTP client that proxies to the WM REST API, injecting the auth headers the
// API expects (Authorization: Bearer <JWT>, ClientId, Request-Tracking-Id).
// Runs on the Workers runtime (global fetch, crypto.randomUUID).
import type { WmBase } from "./catalog";

export interface WmClientConfig {
  bearerToken: string;
  clientId: string;
  bases: Record<WmBase, string>;
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
  constructor(private cfg: WmClientConfig) {}

  async request(opts: WmRequestOptions): Promise<{ status: number; body: unknown }> {
    if (!this.cfg.bearerToken || !this.cfg.clientId) {
      throw new Error(
        "WM credentials missing: set WM_CLIENT_ID and WM_BEARER_TOKEN (or WM_MOCK=1). Request credentials via apiaccess@wm.com.",
      );
    }
    const method = (opts.method ?? "GET").toUpperCase();
    const origin = this.cfg.bases[opts.base];
    const url = new URL(origin + fillPath(opts.path, opts.params));
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.bearerToken}`,
      ClientId: this.cfg.clientId,
      "Request-Tracking-Id": crypto.randomUUID(),
      Accept: "application/json",
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON, keep raw text */
    }
    return { status: res.status, body };
  }
}
