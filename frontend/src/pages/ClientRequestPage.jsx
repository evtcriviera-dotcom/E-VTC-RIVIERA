import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, waLink } from "../api.js";
import { formatEur } from "../utils.js";

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
    passengers: 1,
    bagages: 0,
    urgency: false,
    vehicleType: "BERLINE",
    km: ""
  });

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const [submitted, setSubmitted] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const canAutoQuote =
    Boolean(form.date) &&
    Boolean(form.time) &&
    Boolean(form.vehicleType) &&
    form.fromAddress.trim().length > 2 &&
    form.toAddress.trim().length > 2;

  const canSubmit =
    form.name.trim() &&
    form.phone.trim() &&
    canAutoQuote;

  const canReserve = canSubmit && !quoteLoading && Boolean(quote);

  const quoteSeq = useRef(0);

  async function fetchQuote() {
    const seq = ++quoteSeq.current;
    setQuoteError("");
    setQuoteLoading(true);
    try {
      const km =
        form.km.trim() === "" ? undefined : Number(String(form.km).replace(",", "."));
      const r = await api.quote({
        date: form.date,
        time: form.time,
        fromAddress: form.fromAddress,
        toAddress: form.toAddress,
        passengers: Number(form.passengers) || 1,
        urgency: Boolean(form.urgency),
        vehicleType: form.vehicleType,
        km
      });
      if (seq !== quoteSeq.current) return;
      setQuote(r);
    } catch (_e) {
      if (seq !== quoteSeq.current) return;
      setQuote(null);
      setQuoteError("Impossible de calculer le devis pour le moment.");
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false);
    }
  }

  useEffect(() => {
    if (!canAutoQuote) {
      setQuote(null);
      setQuoteError("");
      setQuoteLoading(false);
      return;
    }

    const t = setTimeout(() => {
      fetchQuote();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoQuote, form.date, form.time, form.fromAddress, form.toAddress, form.vehicleType, form.km, form.urgency]);

  async function onSubmit() {
    setSubmitError("");
    setSubmitLoading(true);
    try {
      const payload = {
        ...form,
        passengers: Number(form.passengers) || 1,
        bagages: Number(form.bagages) || 0,
        km: quote?.km ?? (Number(form.km) || 0),
        priceEur: quote?.priceEur
      };
      const r = await api.createRequest(payload);
      setSubmitted(r.request);
    } catch (e) {
      setSubmitError("Erreur lors de l’envoi. Vérifie les champs puis réessaie.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const clientWaText = useMemo(() => {
    const vehicleLabel = form.vehicleType === "VAN" ? "Van" : "Berline";
    const priceLabel = quote?.priceEur != null ? `${quote.priceEur} €` : "à confirmer";
    const trajet = `${form.fromAddress} → ${form.toAddress}`;

    return [
      "Bonjour, je souhaite réserver un transport :",
      `Date : ${form.date}`,
      `Heure : ${form.time}`,
      `Départ : ${form.fromAddress}`,
      `Arrivée : ${form.toAddress}`,
      `Passagers : ${form.passengers}`,
      `Véhicule : ${vehicleLabel}`,
      `Prix estimé : ${priceLabel}`,
      "",
      "Merci de confirmer la disponibilité."
    ].join("\n");
  }, [form, quote]);

  return (
    <div className="stack">
      <section className="card hero">
        <div className="heroTitle">Service premium Côte d’Azur</div>
        <div className="heroSub">Réponse en moins de 2 minutes</div>
        <div className="heroPrice">
          <div className="heroPriceLabel">Prix</div>
          <div className="heroPriceValue">
            {quote && !quoteLoading ? formatEur(quote.priceEur) : quoteLoading ? "Calcul en cours..." : "—"}
          </div>
          <div className="heroPriceMeta">
            {quote && !quoteLoading
              ? quote.kmSource === "google"
                ? `Distance réelle: ${quote.km} km`
                : `Distance: ${quote.km} km`
              : ""}
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
            <div className="label">Passagers</div>
            <input type="number" min="1" max="8" value={form.passengers} onChange={(e) => update("passengers", e.target.value)} />
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
            <div className="label">Distance (option)</div>
            <input
              inputMode="decimal"
              placeholder="Auto si vide"
              value={form.km}
              onChange={(e) => update("km", e.target.value)}
            />
          </label>

          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={Boolean(form.urgency)}
              onChange={(e) => update("urgency", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--gold2)" }}
            />
            <div>
              <div className="label" style={{ marginTop: -2 }}>
                Urgence (moins de 2h) +15%
              </div>
            </div>
          </label>
        </div>

        <div className="actions">
          <button className="btn gold" disabled={!canReserve || submitLoading} onClick={onSubmit}>
            {submitLoading ? "Réservation..." : "Réserver maintenant"}
          </button>
          <button
            className="btn ghost"
            disabled={!canReserve || !clientWaText}
            onClick={() => {
              window.open(waLink(COMPANY_WHATSAPP, clientWaText), "_blank", "noreferrer");
            }}
          >
            Recevoir le devis sur WhatsApp
          </button>
        </div>

        {quoteError ? <div className="alert error">{quoteError}</div> : null}
        {submitted ? (
          <div className="alert ok" style={{ marginTop: 10 }}>
            Demande envoyée. Référence: <b>{submitted.id}</b>
          </div>
        ) : null}

        {quote ? (
          <div className="quoteBox" style={{ marginTop: 12 }}>
            <div className="quoteLabel">Détails du devis</div>
            <div className="quoteMeta" style={{ marginTop: 6 }}>
              Distance: <b style={{ color: "var(--gold2)" }}>{quote.km} km</b> • Prix final:{" "}
              <b style={{ color: "var(--gold2)" }}>{formatEur(quote.priceEur)}</b>
            </div>
            {quote.breakdown ? (
              <div className="quoteBreakdown">
                <div className="breakRow">
                  <span>Base</span>
                  <b style={{ color: "var(--gold2)" }}>
                    {(quote.breakdown.baseCents / 100).toFixed(2).replace(".", ",")} €
                  </b>
                </div>
                {quote.breakdown.steps.length > 0 ? (
                  quote.breakdown.steps.map((s, i) => (
                    <div key={`${s.label}_${i}`} className="breakRow">
                      <span>{s.label}</span>
                      <b style={{ color: "var(--gold2)" }}>
                        {s.deltaEur >= 0
                          ? `+${s.deltaEur.toFixed(2).replace(".", ",")} €`
                          : `${s.deltaEur.toFixed(2).replace(".", ",")} €`}
                      </b>
                    </div>
                  ))
                ) : (
                  <div className="breakNote">Aucun coefficient appliqué.</div>
                )}
              </div>
            ) : null}
          </div>
        ) : quoteLoading ? (
          <div className="quoteBox" style={{ marginTop: 12 }}>
            <div className="quoteLabel">Détails du devis</div>
            <div className="quoteMeta">Calcul en cours...</div>
          </div>
        ) : null}
        {submitError ? <div className="alert error">{submitError}</div> : null}
      </section>
    </div>
  );
}

