export function formatEur(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function formatDateTime(date, time) {
  if (!date || !time) return "—";
  return `${date} ${time}`;
}

export function buildTripText(r) {
  return `${r?.trip?.fromAddress ?? ""} → ${r?.trip?.toAddress ?? ""}`.trim();
}

