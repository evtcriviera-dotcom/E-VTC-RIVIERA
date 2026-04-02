function isNight(dateTimeIso) {
  const dt = dateTimeIso ? new Date(dateTimeIso) : null;
  if (!dt || Number.isNaN(dt.getTime())) return false;
  const hour = dt.getHours();
  return hour >= 22 || hour < 6;
}

function isWeekend(dateTimeIso) {
  const dt = dateTimeIso ? new Date(dateTimeIso) : null;
  if (!dt || Number.isNaN(dt.getTime())) return false;
  const day = dt.getDay(); // 0=Sun..6=Sat
  return day === 0 || day === 6;
}

/**
 * Returns:
 * - priceCents: final price in cents (minimum applied)
 * - breakdown: structured steps for UI
 */
export function computePriceCents({ km, vehicleType, dateTimeIso, urgency }) {
  const minCents = 30_00;
  const perKmCents = vehicleType === "VAN" ? 3_00 : 2_00;

  const kmSafe = Number.isFinite(Number(km)) ? Number(km) : 0;
  const baseCents = Math.round(kmSafe * perKmCents);

  let currentCents = baseCents;
  const steps = [];

  const night = isNight(dateTimeIso);
  const weekend = isWeekend(dateTimeIso);
  const urgent = Boolean(urgency);

  const applyFactor = (label, factor) => {
    const nextCents = Math.round(currentCents * factor);
    const deltaCents = nextCents - currentCents;
    steps.push({
      label,
      factor,
      fromCents: currentCents,
      toCents: nextCents,
      deltaCents
    });
    currentCents = nextCents;
  };

  if (night) applyFactor("Nuit (22h–6h)", 1.2);
  if (weekend) applyFactor("Week-end", 1.1);
  if (urgent) applyFactor("Urgence (moins de 2h)", 1.15);

  let minApplied = false;
  if (currentCents < minCents) {
    steps.push({
      label: "Prix minimum",
      factor: null,
      fromCents: currentCents,
      toCents: minCents,
      deltaCents: minCents - currentCents
    });
    currentCents = minCents;
    minApplied = true;
  }

  const priceCents = currentCents;

  return {
    priceCents,
    breakdown: {
      vehicleType,
      perKmCents,
      baseCents,
      night,
      weekend,
      urgent,
      minApplied,
      steps: steps.map((s) => ({
        label: s.label,
        factor: s.factor,
        deltaEur: Math.round((s.deltaCents / 100) * 100) / 100,
        fromEur: Math.round((s.fromCents / 100) * 100) / 100,
        toEur: Math.round((s.toCents / 100) * 100) / 100
      })),
      finalEur: Math.round((priceCents / 100) * 100) / 100
    }
  };
}

