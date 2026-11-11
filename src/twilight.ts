// Client + mock fixtures for the "twilight" service — a Next.js service-zone
// finder (address -> which WM market/service polygon contains it). Separate
// deployment from the WM REST API; takes no WM auth headers.
export async function twilightRequest(
  baseUrl: string,
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const url = new URL(baseUrl + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
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
    /* keep raw */
  }
  return { status: res.status, body };
}

// --- Mock fixtures (WM_MOCK=1) ----------------------------------------------
export const TWILIGHT_MOCKS = {
  findZone: (address: string) => ({
    success: true,
    data: {
      address,
      coordinates: { lat: 29.7604, lng: -95.3698 },
      zone: {
        gis_id: "TX-HOU-0042",
        zone_nm: "Houston Central Commercial",
        mrkt_area: 4,
        zone_typ: 1,
        zone_type_ind: 1,
        fac_facility_idu: "FAC-HOU-01",
        fac_facility_name: "WM - Houston Hauling",
        marketAreaName: "Texoma",
        geometryAvailable: true,
      },
    },
  }),
  geometry: (gisId: string, marketArea: number) => ({
    success: true,
    data: {
      gisId,
      marketArea,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-95.38, 29.75],
            [-95.36, 29.75],
            [-95.36, 29.77],
            [-95.38, 29.77],
            [-95.38, 29.75],
          ],
        ],
      },
      coordinateSystem: "WGS84",
    },
  }),
  health: () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "healthy", message: "PostGIS reachable (MOCK)" },
      geocoding: { status: "healthy", message: "Mapbox reachable (MOCK)" },
    },
    version: "1.0.0",
    environment: "mock",
  }),
  geocode: (address: string) => ({
    success: true,
    input: address,
    result: {
      address,
      coordinates: { lat: 29.7604, lng: -95.3698 },
      webMercatorCoordinates: { x: -10_618_985.0, y: 3_473_906.0 },
      relevance: 1,
      region: "Texas",
      country: "United States",
    },
  }),
};
