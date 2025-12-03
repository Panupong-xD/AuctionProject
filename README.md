## AuctionProject

Full‑stack auction platform (React + Vite frontend, Express backend) with real Omise test‑mode card payments, wallet auto‑credit, and refund‑based withdrawals (no growing local JSON store).

# AuctionProject

A compact full‑stack auction demo used for course presentation.

This repository contains a React + Vite frontend and an Express backend (in `server/`). The app demonstrates auction listings, bidding (connected to Firebase Realtime Database), and payment flows integrated with Omise (test mode).

This README contains concise, professor-friendly instructions to run the project locally and securely.

---

## Quick facts
- Frontend: React + Vite (dev port: `5173`)
- Backend: Express (server folder, default port: `3001`)
- Realtime data: Firebase Realtime Database (client connects directly)
- Payments: Omise (server holds secret key in `server/.env`)

---

## Security note (important)
- Never commit secret keys. Use the provided `.env.example` files and copy them to `.env` (root) and `server/.env` locally.
- Confirm `.env` and `server/.env` are listed in `.gitignore` before publishing.

---

## Minimal setup (run with one command)
1. Copy env examples and fill values locally:

```powershell
cp .env.example .env
cp server/.env.example server/.env
# Edit files to add any required values (e.g., VITE_... for frontend, OMISE_SECRET_KEY for server)
```

2. Install and start both frontend and backend from project root:

```powershell
npm install
npm run dev
```

- `npm install` installs root deps and (via `postinstall`) installs server deps.
- `npm run dev` runs frontend and backend concurrently (`vite` + `server`), serving the app at `http://localhost:5173` and backend at `http://localhost:3001`.

If you prefer to run parts separately:

```powershell
# frontend only
npm run dev:client

# backend only (from project root)
npm run dev:server
# or
cd server; npm run dev
```

 **Quick summary**
 - Frontend: React + Vite (default dev port: `5173`)
 - Backend: Express server in `server/` (default port: `3001`)
 - Unified dev command: run `npm install` then `npm run dev` at project root

 ---
# AuctionProject

A compact full‑stack auction demo used for course presentation.

This repository contains a React + Vite frontend and an Express backend (in `server/`). The app demonstrates auction listings, bidding (connected to Firebase Realtime Database), and payment flows integrated with Omise (test mode).

This README contains concise, professor-friendly instructions to run the project locally and securely.

---

## Quick facts
- Frontend: React + Vite (dev port: `5173`)
- Backend: Express (server folder, default port: `3001`)
- Realtime data: Firebase Realtime Database (client connects directly)
- Payments: Omise (server holds secret key in `server/.env`)

---

## Security note (important)
- Never commit secret keys. Use the provided `.env.example` files and copy them to `.env` (root) and `server/.env` locally.
- Confirm `.env` and `server/.env` are listed in `.gitignore` before publishing.

---

## Minimal setup (run with one command)
1. Copy env examples and fill values locally:

```powershell
cp .env.example .env
cp server/.env.example server/.env
# Edit files to add any required values (e.g., VITE_... for frontend, OMISE_SECRET_KEY for server)
```

2. Install and start both frontend and backend from project root:

```powershell
npm install
npm run dev
```

- `npm install` installs root deps and (via `postinstall`) installs server deps.
- `npm run dev` runs frontend and backend concurrently (`vite` + `server`), serving the app at `http://localhost:5173` and backend at `http://localhost:3001`.

If you prefer to run parts separately:

```powershell
# frontend only
npm run dev:client

# backend only (from project root)
 - Backend (`server/src/index.js`) performs idempotent charges and provides endpoints for polling charge status, creating promptpay/offsite sources, and issuing refunds for withdrawals.
# or
cd server; npm run dev
```
 - Bids, auctions and users are stored in Firebase Realtime Database (client reads/writes directly for auction features).

 ### Ports & URLs
 - Frontend: `http://localhost:5173`
 - Backend API: `http://localhost:3001` (default; change via `server/.env`)

 ---
 ## Local testing tips
 - Use test cards for Omise (e.g. `4242 4242 4242 4242`) and ensure `server/.env` is configured with a test secret key.
 - If you do not provide `OMISE_SECRET_KEY`, many payment endpoints will return an informative error; the rest of the app (auctions/bids) will still work locally against Firebase.

 ---
 ## Security notes for the demo
 - Keep real payment keys out of commits. Use `.env.example` for documentation.
 - For production, add server‑side webhook verification and consider moving wallet crediting logic server‑side (webhook + verified events) instead of only relying on client polling.

 ---
 ## Useful commands
 - `npm install` — Install all deps (root installs server deps automatically)
 - `npm run dev` — Start frontend + backend concurrently
 - `npm run dev:client` — Start only frontend
 - `npm run dev:server` — Start only backend
 - `npm run build` — Build frontend for production

 ---

