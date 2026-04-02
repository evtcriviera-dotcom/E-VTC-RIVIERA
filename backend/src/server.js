import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { computePriceCents } from "./pricing.js";
import { getDrivers, getRequests, saveRequests, saveDrivers } from "./storage.js";
import { tryEstimateKm } from "./distance.js";
import { tryEstimateKmGoogle } from "./googleDistance.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

function nowIso() {
  return new Date().toISOString();
}

function rid() {
  return `req_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizePhone(p) {
  return String(p ?? "").trim();
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "e-vtc-riviera-backend" }));

app.post("/api/quote", async (req, res) => {
  const {
    date,
    time,
    fromAddress,
    toAddress,
    passengers,
    vehicleType,
    urgency,
    km: kmRaw
  } = req.body ?? {};

  const dateTimeIso = date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
  const km = Number(kmRaw);

  let effectiveKm = null;
  let kmSource = "none";

  // 1) Google Maps (distance réelle), si clé fournie
  const g = await tryEstimateKmGoogle({ fromAddress, toAddress });
  if (g.ok) {
    effectiveKm = g.km;
    kmSource = "google";
  }

  // 2) Si Google indisponible: km manuel (si fourni)
  if (effectiveKm === null && Number.isFinite(km)) {
    effectiveKm = km;
    kmSource = "manual";
  }

  // 3) Si Google et km manuel indisponibles: fallback (OSRM via public services)
  if (effectiveKm === null) {
    const est = await tryEstimateKm({ fromAddress, toAddress });
    if (est.ok) {
      effectiveKm = est.km;
      kmSource = "osrm";
    }
  }

  if (effectiveKm === null) effectiveKm = 0;

  const { priceCents, breakdown } = computePriceCents({
    km: effectiveKm,
    vehicleType: String(vehicleType).trim(),
    dateTimeIso,
    urgency
  });

  res.json({
    ok: true,
    km: Math.round(effectiveKm * 10) / 10,
    kmSource,
    priceEur: Math.round(priceCents) / 100,
    breakdown
  });
});

app.post("/api/requests", async (req, res) => {
  const body = req.body ?? {};
  const {
    name,
    phone,
    email,
    date,
    time,
    fromAddress,
    toAddress,
    passengers,
    bagages,
    vehicleType,
    urgency,
    km,
    priceEur
  } = body;

  if (!name || !phone || !date || !time || !fromAddress || !toAddress || !vehicleType) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const dateTimeIso = new Date(`${date}T${time}:00`).toISOString();
  const { priceCents: computedPriceCents, breakdown } = computePriceCents({
    km: Number(km) || 0,
    vehicleType: String(vehicleType).trim(),
    dateTimeIso,
    urgency
  });

  const finalPriceEur =
    typeof priceEur === "number" && Number.isFinite(priceEur)
      ? priceEur
      : Math.round(computedPriceCents) / 100;

  const newReq = {
    id: rid(),
    createdAt: nowIso(),
    client: {
      name: String(name).trim(),
      phone: normalizePhone(phone),
      email: String(email ?? "").trim()
    },
    trip: {
      date,
      time,
      dateTimeIso,
      fromAddress: String(fromAddress).trim(),
      toAddress: String(toAddress).trim(),
      passengers: Number(passengers) || 1,
      bagages: Number(bagages) || 0,
      vehicleType: String(vehicleType).trim(),
      km: Number(km) || 0
    },
    pricing: {
      priceEur: Number(finalPriceEur),
      computedPriceEur: Number(finalPriceEur),
      breakdown
    },
    status: "EN_ATTENTE",
    dispatch: {
      sentAt: null,
      assignedDriverId: null,
      acceptedAt: null
    }
  };

  const requests = await getRequests();
  requests.unshift(newReq);
  await saveRequests(requests);
  res.json({ ok: true, request: newReq });
});

app.get("/api/requests", async (_req, res) => {
  const requests = await getRequests();
  res.json({ ok: true, requests });
});

app.patch("/api/requests/:id", async (req, res) => {
  const { id } = req.params;
  const { priceEur, status } = req.body ?? {};
  const allowed = new Set(["EN_ATTENTE", "ENVOYE", "CONFIRME"]);

  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "not_found" });

  const updated = { ...requests[idx] };
  if (typeof priceEur === "number" && Number.isFinite(priceEur)) {
    updated.pricing = { ...updated.pricing, priceEur };
  }
  if (status && allowed.has(status)) {
    updated.status = status;
    if (status === "CONFIRME") {
      updated.dispatch = { ...(updated.dispatch ?? {}), confirmedAt: nowIso() };
    }
  }

  requests[idx] = updated;
  await saveRequests(requests);
  res.json({ ok: true, request: updated });
});

app.get("/api/drivers", async (_req, res) => {
  const drivers = await getDrivers();
  res.json({ ok: true, drivers });
});

app.post("/api/drivers", async (req, res) => {
  const { name, phone } = req.body ?? {};
  if (!name || !phone) return res.status(400).json({ ok: false, error: "missing_fields" });
  const drivers = await getDrivers();
  const d = {
    id: `drv_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
    name: String(name).trim(),
    phone: normalizePhone(phone)
  };
  drivers.push(d);
  await saveDrivers(drivers);
  res.json({ ok: true, driver: d });
});

app.post("/api/requests/:id/dispatch", async (req, res) => {
  const { id } = req.params;
  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "not_found" });

  const r = { ...requests[idx] };
  r.status = "ENVOYE";
  r.dispatch = { ...r.dispatch, sentAt: nowIso() };

  requests[idx] = r;
  await saveRequests(requests);
  res.json({ ok: true, request: r });
});

app.post("/api/requests/:id/accept", async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body ?? {};

  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "not_found" });

  const r0 = requests[idx];
  if (r0.dispatch?.assignedDriverId) {
    return res.status(409).json({ ok: false, error: "already_assigned" });
  }

  const drivers = await getDrivers();
  const d = drivers.find((x) => x.id === driverId);
  if (!d) return res.status(400).json({ ok: false, error: "unknown_driver" });

  const r = { ...r0 };
  // On ne marque pas la course "CONFIRMÉE" ici :
  // - accept = affectation du chauffeur
  // - l'admin confirmera ensuite (bouton "Marquer comme confirmé")
  r.status = r0.status === "EN_ATTENTE" ? "ENVOYE" : r0.status;
  r.dispatch = {
    ...r.dispatch,
    assignedDriverId: driverId,
    acceptedAt: nowIso()
  };

  requests[idx] = r;
  await saveRequests(requests);
  res.json({ ok: true, request: r, driver: d });
});

const port = process.env.PORT ? Number(process.env.PORT) : 5175;
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});

