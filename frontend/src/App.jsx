import React from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import ClientRequestPage from "./pages/ClientRequestPage.jsx";
import { waLink } from "./api.js";

const COMPANY_WHATSAPP = "0780390730";

function TopNav() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brandMark">E</div>
        <div className="brandText">
          <div className="brandTitle">E VTC Riviera</div>
          <div className="brandSub">Premium • Noir & Or</div>
        </div>
      </div>
      <nav className="tabs">
        <NavLink className={({ isActive }) => `tab ${isActive ? "active" : ""}`} to="/">
          Client
        </NavLink>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="appShell">
      <TopNav />
      <main className="container">
        <Routes>
          <Route path="/" element={<ClientRequestPage />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <a
        className="waFloating"
        href={waLink(COMPANY_WHATSAPP, "Bonjour E VTC Riviera, j’ai une question.")}
        target="_blank"
        rel="noreferrer"
        title="WhatsApp"
      >
        WhatsApp
      </a>
    </div>
  );
}

