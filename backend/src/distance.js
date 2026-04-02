function clampString(s, maxLen) {
  if (!s) return "";
  const v = String(s).trim();
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

export async function tryEstimateKm({ fromAddress, toAddress }) {
  const from = clampString(fromAddress, 180);
  const to = clampString(toAddress, 180);
  if (!from || !to) return { ok: false, reason: "missing_address" };

  // Best-effort: public services (no API key) for local testing.
  // If they fail or rate-limit, the app still works with manual km fallback.
  const headers = {
    "User-Agent": "E-VTC-Riviera/0.1 (local dev)",
    "Accept": "application/json"
  };

  const geocode = async (q) => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", q);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`geocode_failed_${res.status}`);
    const arr = await res.json();
    const hit = arr?.[0];
    if (!hit) throw new Error("geocode_no_result");
    return { lat: Number(hit.lat), lon: Number(hit.lon) };
  };

  try {
    const [a, b] = await Promise.all([geocode(from), geocode(to)]);
    const url = new URL(
      `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}`
    );
    url.searchParams.set("overview", "false");
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`osrm_failed_${res.status}`);
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (!Number.isFinite(meters)) throw new Error("osrm_no_distance");
    const km = meters / 1000;
    return { ok: true, km: Math.max(0, km) };
  } catch (e) {
    return { ok: false, reason: e?.message || "distance_failed" };
  }
}

