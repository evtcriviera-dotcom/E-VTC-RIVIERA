function clampString(s, maxLen) {
  const v = String(s ?? "").trim();
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

async function geocodeNominatim(query, { signal } = {}) {
  const q = clampString(query, 180);
  if (!q) throw new Error("missing_query");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  // In browsers we can't set a custom User-Agent; keep requests minimal.
  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json"
    }
  });
  if (!res.ok) throw new Error(`geocode_http_${res.status}`);

  const arr = await res.json().catch(() => null);
  const hit = arr?.[0];
  const lat = hit?.lat != null ? Number(hit.lat) : NaN;
  const lon = hit?.lon != null ? Number(hit.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("geocode_no_result");
  return { lat, lon };
}

async function routeKmOsrm(from, to, { signal } = {}) {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`
  );
  url.searchParams.set("overview", "false");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json"
    }
  });
  if (!res.ok) throw new Error(`osrm_http_${res.status}`);

  const data = await res.json().catch(() => null);
  const meters = data?.routes?.[0]?.distance;
  if (!Number.isFinite(meters)) throw new Error("osrm_no_distance");

  return Math.max(0, meters / 1000);
}

export async function estimateKmFromAddresses({ fromAddress, toAddress, signal }) {
  const fromQ = clampString(fromAddress, 180);
  const toQ = clampString(toAddress, 180);
  if (!fromQ || !toQ) throw new Error("missing_address");

  const [from, to] = await Promise.all([
    geocodeNominatim(fromQ, { signal }),
    geocodeNominatim(toQ, { signal })
  ]);

  const km = await routeKmOsrm(from, to, { signal });
  return km;
}

