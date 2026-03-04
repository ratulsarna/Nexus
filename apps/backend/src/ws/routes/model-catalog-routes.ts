import type { IncomingMessage, ServerResponse } from "node:http";
import { ManagerModelCatalogService } from "../../swarm/manager-model-catalog.js";
import { applyCorsHeaders, sendJson } from "../http-utils.js";
import type { HttpRoute } from "./http-route.js";

const MANAGER_MODEL_CATALOG_ENDPOINT_PATH = "/api/models/manager-catalog";

export function createModelCatalogRoutes(options?: {
  catalogService?: ManagerModelCatalogService;
}): HttpRoute[] {
  const service = options?.catalogService ?? new ManagerModelCatalogService();

  return [
    {
      methods: "GET, OPTIONS",
      matches: (pathname) => pathname === MANAGER_MODEL_CATALOG_ENDPOINT_PATH,
      handle: async (request, response) => {
        await handleManagerModelCatalogRequest(service, request, response);
      }
    }
  ];
}

async function handleManagerModelCatalogRequest(
  service: ManagerModelCatalogService,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const methods = "GET, OPTIONS";

  if (request.method === "OPTIONS") {
    applyCorsHeaders(request, response, methods);
    response.statusCode = 204;
    response.end();
    return;
  }

  applyCorsHeaders(request, response, methods);

  if (request.method !== "GET") {
    response.setHeader("Allow", methods);
    sendJson(response, 405, { error: "Method Not Allowed" });
    return;
  }

  const catalog = await service.getCatalog();
  sendJson(response, 200, catalog as unknown as Record<string, unknown>);
}
