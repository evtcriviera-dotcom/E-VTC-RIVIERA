function hasGoogleKey() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY && String(process.env.GOOGLE_MAPS_API_KEY).trim().length > 0);
}

export async function tryEstimateKmGoogle({ fromAddress, toAddress }) {
  if (!hasGoogleKey()) return { ok: false, reason: "missing_google_api_key" };

  const from = String(fromAddress ?? "").trim();
  const to = String(toAddress ?? "").trim();
  if (!from || !to) return { ok: false, reason: "missing_address" };

  const key = String(process.env.GOOGLE_MAPS_API_KEY).trim();

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", from);
  url.searchParams.set("destinations", to);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) return { ok: false, reason: `google_http_${res.status}` };
  const data = await res.json().catch(() => null);

  const element = data?.rows?.[0]?.elements?.[0];
  const meters = element?.distance?.value;

  if (!Number.isFinite(meters)) {
    return { ok: false, reason: `google_no_distance_${element?.status || "unknown"}` };
  }

  const km = meters / 1000;
  return { ok: true, km: Math.max(0, km) };
}

