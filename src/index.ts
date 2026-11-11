// Cloudflare Worker entry: a remote MCP server (Streamable HTTP at /mcp)
// exposing the WM + twilight tools. Add it to Claude as a custom connector
// with the URL https://<worker>.<subdomain>.workers.dev/mcp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { buildConfig, type Env } from "./config";
import { registerTools } from "./tools";

export class WmMCP extends McpAgent<Env, Record<string, never>, Record<string, never>> {
  server = new McpServer({ name: "wm-mcp", version: "0.2.0" });

  async init() {
    registerTools(this.server, buildConfig(this.env));
  }
}

// Optional static-bearer gate. This is a simple lock, not full OAuth — when
// MCP_BEARER_TOKEN is set, callers must send `Authorization: Bearer <token>`.
// For production OAuth, front this with @cloudflare/workers-oauth-provider.
function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
  });
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ name: "wm-mcp", status: "ok", endpoint: "/mcp", mock: buildConfig(env).mock }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/mcp")) {
      if (env.MCP_BEARER_TOKEN) {
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${env.MCP_BEARER_TOKEN}`) return unauthorized();
      }
      return WmMCP.serve("/mcp", { binding: "WM_MCP" }).fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
