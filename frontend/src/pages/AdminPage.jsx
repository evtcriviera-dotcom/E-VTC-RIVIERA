import React, { useEffect, useMemo, useState } from "react";
import { api, waLink } from "../api.js";
import { buildTripText, formatDateTime, formatEur } from "../utils.js";

function StatusPill({ status }) {
  const label =
    status === "EN_ATTENTE" ? "EN ATTENTE" : status === "ENVOYE" ? "ENVOYÉ" : "CONFIRMÉ";
  const cls = status === "CONFIRME" ? "pill ok" : status === "ENVOYE" ? "pill warn" : "pill";
  return <span className={cls}>{label}</span>;
}

function driverDispatchText(r) {
  const v = r?.trip?.vehicleType === "VAN" ? "Van" : "Berline";
  return [
    "Nouvelle course - E VTC Riviera",
    `Réf: ${r.id}`,
    `Date/Heure: ${formatDateTime(r.trip.date, r.trip.time)}`,
    `Départ: ${r.trip.fromAddress}`,
    `Arrivée: ${r.trip.toAddress}`,
    `Passagers: ${r.trip.passengers}`,
    `Bagages: ${r.trip.bagages ?? 0}`,
    `Véhicule: ${v}`,
    `Prix: ${r.pricing.priceEur} €`,
    "",
    "Réponds 'OK' pour accepter."
  ].join("\n");
}

export default function AdminPage() {
  const [requests, setRequests] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [newDriver, setNewDriver] = useState({ name: "", phone: "" });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignDriverById, setAssignDriverById] = useState({});

  const driverById = useMemo(() => {
    const m = new Map();
    for (const d of drivers) m.set(d.id, d);
    return m;
  }, [drivers]);

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const [rq, dr] = await Promise.all([api.listRequests(), api.listDrivers()]);
      setRequests(rq.requests || []);
      setDrivers(dr.drivers || []);
    } catch (e) {
      setErr("Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function patch(r, payload) {
    const prev = requests;
    setRequests((xs) => xs.map((x) => (x.id === r.id ? { ...x, ...payload } : x)));
    try {
      const out = await api.patchRequest(r.id, payload);
      setRequests((xs) => xs.map((x) => (x.id === r.id ? out.request : x)));
    } catch (e) {
      setRequests(prev);
      alert("Action impossible.");
    }
  }

  async function sendDispatch(r) {
    try {
      await api.dispatch(r.id);
      await refresh();
      console.log("[dispatch] to drivers:", drivers.map((d) => ({ to: d.phone, text: driverDispatchText(r) })));
      alert("Dispatch simulé + liens WhatsApp disponibles.");
    } catch (e) {
      alert("Erreur dispatch.");
    }
  }

  async function accept(r, driverId) {
    try {
      await api.accept(r.id, driverId);
      await refresh();
      alert("Course acceptée. Client à confirmer (WhatsApp).");
    } catch (e) {
      alert("Impossible d’accepter (déjà assignée ou erreur).");
    }
  }

  async function addDriver() {
    if (!newDriver.name.trim() || !newDriver.phone.trim()) return;
    try {
      await api.addDriver(newDriver);
      setNewDriver({ name: "", phone: "" });
      await refresh();
    } catch (e) {
      alert("Erreur ajout chauffeur.");
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const d = r?.trip?.date;
      if (!d) {
        // Si on filtre par une période, on ignore les demandes dont la date est absente.
        return !(dateFrom || dateTo);
      }
      if (dateFrom && String(d) < dateFrom) return false;
      if (dateTo && String(d) > dateTo) return false;
      return true;
    });
  }, [requests, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = requests.length;
    const confirmed = requests.filter((r) => r?.status === "CONFIRME");
    const confirmedCount = confirmed.length;

    const conversionRate = total > 0 ? confirmedCount / total : 0;
    const revenue = confirmed.reduce((sum, r) => {
      const v = r?.pricing?.computedPriceEur ?? r?.pricing?.priceEur ?? 0;
      const n = Number(v);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    return {
      total,
      confirmedCount,
      conversionRate,
      revenue
    };
  }, [requests]);

  const historyRequests = useMemo(() => {
    return requests
      .slice()
      .sort((a, b) => new Date(b?.createdAt ?? 0).getTime() - new Date(a?.createdAt ?? 0).getTime());
  }, [requests]);

  function formatIsoTime(iso) {
    if (!iso) return "—";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <div>
            <div className="cardTitle">Tableau de bord</div>
            <div className="muted">Demandes • Dispatch • Confirmation</div>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={refresh} disabled={loading}>
              Rafraîchir
            </button>
          </div>
        </div>
        {err ? <div className="alert error">{err}</div> : null}
      </section>

      <section className="card">
        <div className="cardTitle">Indicateurs</div>
        <div className="statsGrid">
          <div className="statCard">
            <div className="statLabel">Demandes</div>
            <div className="statValue">{stats.total}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Taux de conversion</div>
            <div className="statValue">{Math.round(stats.conversionRate * 100)}%</div>
            <div className="statSub">{stats.confirmedCount} confirmées</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Chiffre d’affaires estimé</div>
            <div className="statValue">{formatEur(stats.revenue)}</div>
            <div className="statSub">sur confirmées</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Courses confirmées</div>
            <div className="statValue">{stats.confirmedCount}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="cardTitle">Chauffeurs</div>
        <div className="grid">
          <label className="field">
            <div className="label">Nom</div>
            <input
              value={newDriver.name}
              onChange={(e) => setNewDriver((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          <label className="field">
            <div className="label">Téléphone</div>
            <input
              value={newDriver.phone}
              onChange={(e) => setNewDriver((d) => ({ ...d, phone: e.target.value }))}
            />
          </label>
          <div className="field">
            <div className="label">&nbsp;</div>
            <button className="btn" onClick={addDriver}>
              Ajouter
            </button>
          </div>
        </div>

        <div className="driverList">
          {drivers.map((d) => (
            <div key={d.id} className="driverItem">
              <div className="driverName">{d.name}</div>
              <div className="driverPhone">{d.phone}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="cardTitle">Demandes</div>
        {loading ? <div className="muted">Chargement...</div> : null}
        <div className="filters">
          <div className="grid2">
            <label className="field">
              <div className="label">Date du</div>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="field">
              <div className="label">Date au</div>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <div className="filtersActions">
            <button
              className="btn ghost"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              disabled={!dateFrom && !dateTo}
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <div className="table">
          <div className="thead">
            <div>Client</div>
            <div>Trajet</div>
            <div>Date/Heure</div>
            <div>Prix calculé</div>
            <div>Statut</div>
            <div>Actions</div>
          </div>
          {filteredRequests.map((r) => {
            const assigned = r.dispatch?.assignedDriverId ? driverById.get(r.dispatch.assignedDriverId) : null;
            const clientText = [
              "Votre chauffeur est confirmé.",
              assigned ? `Chauffeur: ${assigned.name}` : "",
              `Heure: ${formatDateTime(r.trip.date, r.trip.time)}`,
              `Trajet: ${buildTripText(r)}`,
              `Détails: ${r.trip.passengers} passagers • ${r.trip.bagages ?? 0} bagages • ${
                r.trip.vehicleType === "VAN" ? "Van" : "Berline"
              }`
            ]
              .filter(Boolean)
              .join("\n");

            return (
              <div className="trow" key={r.id}>
                <div>
                  <div className="strong">{r.client.name}</div>
                  <div className="muted">{r.client.phone}</div>
                </div>
                <div>
                  <div className="mono">{buildTripText(r)}</div>
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.3 }}>
                    {r.trip.passengers} passagers • {r.trip.bagages ?? 0} bagages •{" "}
                    {r.trip.vehicleType === "VAN" ? "Van" : "Berline"}
                  </div>
                </div>
                <div className="mono">{formatDateTime(r.trip.date, r.trip.time)}</div>
                <div className="priceCell">
                  <div className="muted">
                    Calculé: <b style={{ color: "var(--gold2)" }}>{formatEur(r.pricing.computedPriceEur ?? r.pricing.priceEur)}</b>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Prix actuel (modif possible)
                  </div>
                  <input
                    className="priceInput"
                    inputMode="decimal"
                    value={String(r.pricing.priceEur)}
                    onChange={(e) =>
                      setRequests((xs) =>
                        xs.map((x) =>
                          x.id === r.id ? { ...x, pricing: { ...x.pricing, priceEur: Number(e.target.value) } } : x
                        )
                      )
                    }
                    onBlur={() => patch(r, { priceEur: Number(r.pricing.priceEur) })}
                  />
                </div>
                <div>
                  <StatusPill status={r.status} />
                </div>
                <div className="actionCol">
                  <div className="actionsWrap">
                    <button className="btn ghost" onClick={() => sendDispatch(r)}>
                      Envoyer aux chauffeurs
                    </button>
                    <select
                      className="select"
                      value={assignDriverById[r.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAssignDriverById((s) => ({ ...s, [r.id]: val }));
                      }}
                      disabled={Boolean(r.dispatch?.assignedDriverId)}
                    >
                      <option value="">Choisir un chauffeur…</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn"
                      onClick={() => {
                        const driverId = assignDriverById[r.id];
                        if (!driverId) return;
                        accept(r, driverId);
                      }}
                      disabled={!assignDriverById[r.id] || Boolean(r.dispatch?.assignedDriverId)}
                    >
                      Assigner chauffeur
                    </button>
                    <button
                      className="btn"
                      onClick={() => patch(r, { status: "CONFIRME" })}
                      disabled={r.status === "CONFIRME" || !r.dispatch?.assignedDriverId}
                    >
                      Marquer comme confirmé
                    </button>
                    <a
                      className={`btn ${r.status === "CONFIRME" ? "gold" : "ghost"}`}
                      href={waLink(r.client.phone, clientText)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ opacity: r.status === "CONFIRME" ? 1 : 0.55, pointerEvents: r.status === "CONFIRME" ? "auto" : "none" }}
                    >
                      Confirmer client (WhatsApp)
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="cardTitle">Historique des courses</div>
        {historyRequests.length === 0 ? <div className="muted">Aucune course pour le moment.</div> : null}
        <div className="historyList">
          {historyRequests.map((r) => {
            const assigned = r.dispatch?.assignedDriverId ? driverById.get(r.dispatch.assignedDriverId) : null;
            const price = r?.pricing?.computedPriceEur ?? r?.pricing?.priceEur ?? 0;
            return (
              <div key={r.id} className="historyItem">
                <div className="historyTop">
                  <div className="historyDate">{formatDateTime(r.trip.date, r.trip.time)}</div>
                  <StatusPill status={r.status} />
                </div>
                <div className="historyMain">
                  <div className="historyClient">{r.client.name}</div>
                  <div className="historyPrice">{formatEur(price)}</div>
                </div>
                <div className="historyMeta">
                  Chauffeur: {assigned ? assigned.name : "—"} • Envoyé: {formatIsoTime(r.dispatch?.sentAt)} • Accepté:{" "}
                  {formatIsoTime(r.dispatch?.acceptedAt)} • Confirmé: {formatIsoTime(r.dispatch?.confirmedAt)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

