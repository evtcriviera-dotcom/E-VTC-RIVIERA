# E VTC Riviera

Application web (mobile-first) pour gérer des demandes VTC :
- formulaire client + devis automatique
- tableau de bord admin (prix/statut)
- dispatch chauffeurs + acceptation
- confirmation client via WhatsApp

## WhatsApp entreprise
- Numéro configuré: **0780390730**
- À modifier si besoin dans `frontend/src/App.jsx` et `frontend/src/pages/ClientRequestPage.jsx`

## Prérequis
- Node.js 18+ (recommandé: 20+)
- Sur Windows: installe Node.js depuis le site officiel, puis rouvre le terminal.

## Installation

Dans le dossier du projet :

```bash
npm --prefix backend install
npm --prefix frontend install
```

## Lancer en local

### Backend (API)

```bash
npm run dev:backend
```

API sur `http://localhost:5175`

### Frontend (UI)

Dans un autre terminal :

```bash
npm run dev:frontend
```

UI sur l’URL affichée par Vite (souvent `http://localhost:5173`)

## Déploiement (simple)

### Option A — Vercel (frontend) + Render (backend)

- **Backend Render**
  - Nouveau *Web Service* depuis le dossier `backend`
  - Build: `npm install`
  - Start: `npm start`
  - Port: variable `PORT` (Render la fournit)
  - Stockage JSON: OK pour démo, mais pas recommandé si tu as beaucoup de trafic (fichiers locaux).

- **Frontend Vercel**
  - Projet Vercel depuis le dossier `frontend`
  - Build: `npm install && npm run build`
  - Output: `dist`
  - Dans Vercel, ajoute `VITE_API_BASE` (ex: `https://ton-backend.onrender.com`)
  - Exemple: voir `frontend/.env.example`

### Option B — Tout-en-un sur Render / Railway
Possible, mais il faudra servir le build du frontend depuis Express (option à ajouter).

## Google Maps (distance réelle)
Pour que le devis affiche une distance calculée via **Google Maps**, ajoute une clé :
- crée `backend/.env` à partir de `backend/.env.example`
- mets ta valeur dans `GOOGLE_MAPS_API_KEY`

Si la clé n’est pas fournie, l’app utilise un fallback (OSRM/public) et indique `Distance estimée`.

