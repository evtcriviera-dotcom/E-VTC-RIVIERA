async function jsonFetch(url, opts) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error ? String(data.error) : `http_${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const API_BASE = import.meta?.env?.VITE_API_BASE ?? "";

export const api = {
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),
  quote: (payload) =>
    jsonFetch(`${API_BASE}/api/quote`, { method: "POST", body: JSON.stringify(payload) }),
  createRequest: (payload) =>
    jsonFetch(`${API_BASE}/api/requests`, { method: "POST", body: JSON.stringify(payload) }),
  listRequests: () => jsonFetch(`${API_BASE}/api/requests`),
  patchRequest: (id, payload) =>
    jsonFetch(`${API_BASE}/api/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  listDrivers: () => jsonFetch(`${API_BASE}/api/drivers`),
  addDriver: (payload) =>
    jsonFetch(`${API_BASE}/api/drivers`, { method: "POST", body: JSON.stringify(payload) }),
  dispatch: (id) =>
    jsonFetch(`${API_BASE}/api/requests/${encodeURIComponent(id)}/dispatch`, { method: "POST" }),
  accept: (id, driverId) =>
    jsonFetch(`${API_BASE}/api/requests/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      body: JSON.stringify({ driverId })
    })
};

function normalizePhoneToE164(phone) {
  let s = String(phone || "").trim();
  if (!s) return "";
  s = s.replace(/[^\d+]/g, "");

  // France common cases:
  // - 0780390730  -> +33780390730
  // - 33XXXXXXXXX -> +33...
  // - +33XXXXXXXXX stays
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  if (s.startsWith("33")) return `+${s}`;
  if (/^0\d{9}$/.test(s)) return `+33${s.slice(1)}`;

  return s;
}

export function waLink(phone, text) {
  const clean = normalizePhoneToE164(phone);
  const digits = clean.startsWith("+") ? clean.slice(1) : clean;
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text || "")}`;
}

