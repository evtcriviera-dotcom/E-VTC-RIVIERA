import React, { useEffect, useMemo, useRef, useState } from "react";
import { waLink } from "../api.js";
import { estimateKmFromAddresses } from "../distance.js";

const COMPANY_WHATSAPP = "0780390730";

const vehicles = [
  { id: "BERLINE", label: "Berline" },
  { id: "VAN", label: "Van" }
];

function toDateValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ClientRequestPage() {
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    date: toDateValue(now),
    time: toTimeValue(now),
    fromAddress: "",
    toAddress: "",
    adults: 1,
    children: 0,
    bagages: 0,
    babySeat: false,
    booster: false,
    vehicleType: "BERLINE",
    km: ""
  });

  const [distanceState, setDistanceState] = useState({
    status: "idle", // idle | loading | ok | error
    message: ""
  });
  const kmTouchedRef = useRef(false);
  const lastAutoKeyRef = useRef("");

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-distance (frontend-only): Nominatim -> OSRM
  useEffect(() => {
    const from = form.fromAddress.trim();
    const to = form.toAddress.trim();
    const canAuto = from.length > 2 && to.length > 2;

    if (!canAuto) {
      setDistanceState({ status: "idle", message: "" });
      lastAutoKeyRef.current = "";
      return;
    }

    const key = `${from}__${to}`;
    if (key === lastAutoKeyRef.current) return;

    const controller = new AbortController();
    setDistanceState({ status: "loading", message: "Calcul de distance..." });

    const t = setTimeout(async () => {
      try {
        const km = await estimateKmFromAddresses({
          fromAddress: from,
          toAddress: to,
          signal: controller.signal
        });
        const km1 = Math.round(km * 10) / 10;

        lastAutoKeyRef.current = key;
        setDistanceState({ status: "ok", message: `Distance calculée: ${km1} km` });

        // Fill the input unless user manually changed it.
        if (!kmTouchedRef.current) {
          setForm((f) => ({ ...f, km: String(km1).replace(".", ",") }));
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setDistanceState({
          status: "error",
          message: "Distance automatique indisponible, saisissez-la manuellement"
        });
      }
    }, 650);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [form.fromAddress, form.toAddress]);

  // If addresses change after manual km edit, allow auto-fill again.
  useEffect(() => {
    kmTouchedRef.current = false;
  }, [form.fromAddress, form.toAddress]);

  const totalPassengers = useMemo(() => {
    const a = Number(form.adults);
    const c = Number(form.children);
    const total = (Number.isFinite(a) ? a : 0) + (Number.isFinite(c) ? c : 0);
    return total > 0 ? total : 1;
  }, [form.adults, form.children]);

  const pricing = useMemo(() => {
    const vehicleLabel = form.vehicleType === "VAN" ? "Van" : "Berline";
    const vehicleRate = form.vehicleType === "VAN" ? 3 : 2;

    const kmRaw = String(form.km ?? "").trim().replace(",", ".");
    const km = Number(kmRaw);
    const hasKm = Number.isFinite(km) && km > 0;

    // Distance is the mandatory input for a precise quote in the frontend.
    if (!hasKm) {
      return {
        ready: false,
        message: "Renseignez la distance pour obtenir un devis précis"
      };
    }

    if (!form.date || !form.time || !form.vehicleType) {
      return {
        ready: false,
        message: "Complétez les informations pour calculer votre devis"
      };
    }

    const dt = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(dt.getTime())) {
      return {
        ready: false,
        message: "Complétez les informations pour calculer votre devis"
      };
    }

    const hour = dt.getHours();
    const day = dt.getDay(); // 0=Sun..6=Sat
    const night = hour >= 22 || hour < 6;
    const weekend = day === 0 || day === 6;

    let price = km * vehicleRate;
    if (night) price *= 1.2;
    if (weekend) price *= 1.1;

    price = Math.max(price, 30);
    const priceFinalTTC = Math.ceil(price); // round up to the next euro

    const distanceUsed = Math.round(km * 10) / 10;

    return {
      ready: true,
      message: "",
      distanceUsed,
      vehicleLabel,
      vehicleRate,
      night,
      weekend,
      priceFinalTTC
    };
  }, [form.date, form.time, form.vehicleType, form.km]);

  const canSubmit =
    form.name.trim() &&
    form.phone.trim() &&
    form.date &&
    form.time &&
    form.fromAddress.trim().length > 2 &&
    form.toAddress.trim().length > 2 &&
    form.vehicleType;

  const canReserve = Boolean(canSubmit && pricing.ready);

  const quoteWaText = useMemo(() => {
    if (!pricing.ready) return "";
    const distanceStr = `${pricing.distanceUsed} km`;
    const priceStr = `${pricing.priceFinalTTC} €`;

    return [
      "Bonjour, je souhaite obtenir un devis pour un transport :",
      `Nom : ${form.name}`,
      `Téléphone : ${form.phone}`,
      `Email : ${form.email || "-"}`,
      `Date : ${form.date}`,
      `Heure : ${form.time}`,
      `Départ : ${form.fromAddress}`,
      `Arrivée : ${form.toAddress}`,
      `Adultes : ${form.adults}`,
      `Enfants : ${form.children}`,
      `Passagers (total) : ${totalPassengers}`,
      `Bagages : ${form.bagages}`,
      `Siège bébé : ${form.babySeat ? "Oui" : "Non"}`,
      `Rehausseur : ${form.booster ? "Oui" : "Non"}`,
      `Véhicule : ${pricing.vehicleLabel}`,
      `Distance : ${distanceStr}`,
      `Prix estimé : ${priceStr}`,
      "",
      "Merci de me confirmer ce devis."
    ].join("\n");
  }, [form, pricing]);

  const reserveWaText = useMemo(() => {
    if (!pricing.ready) return "";
    const distanceStr = `${pricing.distanceUsed} km`;
    const priceStr = `${pricing.priceFinalTTC} €`;

    return [
      "Bonjour, je souhaite confirmer cette réservation :",
      `Nom : ${form.name}`,
      `Téléphone : ${form.phone}`,
      `Email : ${form.email || "-"}`,
      `Date : ${form.date}`,
      `Heure : ${form.time}`,
      `Départ : ${form.fromAddress}`,
      `Arrivée : ${form.toAddress}`,
      `Adultes : ${form.adults}`,
      `Enfants : ${form.children}`,
      `Passagers (total) : ${totalPassengers}`,
      `Bagages : ${form.bagages}`,
      `Siège bébé : ${form.babySeat ? "Oui" : "Non"}`,
      `Rehausseur : ${form.booster ? "Oui" : "Non"}`,
      `Véhicule : ${pricing.vehicleLabel}`,
      `Distance : ${distanceStr}`,
      `Prix estimé : ${priceStr}`,
      "",
      "Je souhaite confirmer cette réservation.",
      "Merci de me confirmer la disponibilité."
    ].join("\n");
  }, [form, pricing]);

  function handleReserveClick() {
    // Validation champs essentiels avant d'ouvrir WhatsApp
    if (!canSubmit || !pricing.ready) {
      setSubmitError("Complétez les informations pour confirmer votre réservation.");
      return;
    }

    setSubmitError("");
    setSubmitted(false);

    const msg = reserveWaText;
    if (!msg) {
      setSubmitError("Impossible de préparer le message de réservation. Vérifiez les champs.");
      return;
    }

    window.open(waLink(COMPANY_WHATSAPP, msg), "_blank", "noreferrer");
    setSubmitted(true);
  }

  return (
    <div className="stack">
      <section className="card hero">
        <div className="heroTitle">Service premium Côte d’Azur</div>
        <div className="heroSub">Réponse en moins de 2 minutes</div>
        <div className="heroPrice">
          <div className="heroPriceLabel">Prix</div>
          <div className="heroPriceValue">
            {pricing.ready ? `${pricing.priceFinalTTC} €` : pricing.message}
          </div>
          <div className="heroPriceMeta">
            {pricing.ready ? (
              <div>
                <div>Distance utilisée : {pricing.distanceUsed} km</div>
                <div>
                  Tarif véhicule : {pricing.vehicleRate} €/km ({pricing.vehicleLabel})
                </div>
                <div>Majoration nuit : {pricing.night ? "Oui" : "Non"}</div>
                <div>Majoration week-end : {pricing.weekend ? "Oui" : "Non"}</div>
                <div style={{ marginTop: 6 }}>
                  Prix final TTC : <b style={{ color: "var(--gold2)" }}>{pricing.priceFinalTTC} €</b>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardTitle">Réserver maintenant</div>
        <div className="grid">
          <label className="field">
            <div className="label">Nom</div>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </label>
          <label className="field">
            <div className="label">Téléphone</div>
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </label>
          <label className="field">
            <div className="label">Email (option)</div>
            <input value={form.email} onChange={(e) => update("email", e.target.value)} />
          </label>

          <label className="field">
            <div className="label">Date</div>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
          </label>
          <label className="field">
            <div className="label">Heure</div>
            <input type="time" value={form.time} onChange={(e) => update("time", e.target.value)} />
          </label>

          <label className="field col2">
            <div className="label">Départ</div>
            <input
              value={form.fromAddress}
              onChange={(e) => update("fromAddress", e.target.value)}
              placeholder="Ex: Nice Gare"
            />
          </label>
          <label className="field col2">
            <div className="label">Arrivée</div>
            <input
              value={form.toAddress}
              onChange={(e) => update("toAddress", e.target.value)}
              placeholder="Ex: Aéroport Nice"
            />
          </label>

          <label className="field">
            <div className="label">Adultes</div>
            <input
              type="number"
              min="0"
              max="8"
              value={form.adults}
              onChange={(e) => update("adults", e.target.value)}
            />
          </label>
          <label className="field">
            <div className="label">Enfants</div>
            <input
              type="number"
              min="0"
              max="8"
              value={form.children}
              onChange={(e) => update("children", e.target.value)}
            />
          </label>
          <label className="field">
            <div className="label">Bagages</div>
            <input type="number" min="0" max="10" value={form.bagages} onChange={(e) => update("bagages", e.target.value)} />
          </label>

          <label className="field">
            <div className="label">Véhicule</div>
            <select value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="label">Distance (km)</div>
            <input
              inputMode="decimal"
              placeholder="Ex: 12,5"
              value={form.km}
              onChange={(e) => {
                kmTouchedRef.current = true;
                update("km", e.target.value);
              }}
            />
            {distanceState.status === "loading" ? (
              <div className="muted" style={{ marginTop: 6 }}>
                Calcul de distance...
              </div>
            ) : distanceState.status === "error" ? (
              <div className="muted" style={{ marginTop: 6 }}>
                {distanceState.message}
              </div>
            ) : distanceState.status === "ok" ? (
              <div className="muted" style={{ marginTop: 6 }}>
                {distanceState.message}
              </div>
            ) : null}
          </label>

          <label className="field">
            <div className="label">Équipements</div>
            <div className="checksRow">
              <label className="checkItem">
                <input
                  type="checkbox"
                  checked={Boolean(form.babySeat)}
                  onChange={(e) => update("babySeat", e.target.checked)}
                />
                <span>Siège bébé</span>
              </label>
              <label className="checkItem">
                <input
                  type="checkbox"
                  checked={Boolean(form.booster)}
                  onChange={(e) => update("booster", e.target.checked)}
                />
                <span>Rehausseur</span>
              </label>
            </div>
          </label>
        </div>

        <div className="actions">
          <button className="btn gold" disabled={!canReserve} onClick={handleReserveClick}>
            Réserver maintenant
          </button>
          <button
            className="btn ghost"
            disabled={!canReserve || !quoteWaText}
            onClick={() => {
              window.open(waLink(COMPANY_WHATSAPP, quoteWaText), "_blank", "noreferrer");
            }}
          >
            Recevoir le devis sur WhatsApp
          </button>
        </div>

        {submitted ? (
          <div className="alert ok" style={{ marginTop: 10 }}>
            Votre message de réservation est prêt dans WhatsApp.
          </div>
        ) : null}
        {submitError ? <div className="alert error">{submitError}</div> : null}
      </section>
    </div>
  );
}

