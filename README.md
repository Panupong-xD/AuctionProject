## AuctionProject

Full‑stack auction platform (React + Vite frontend, Express backend) with real Omise test‑mode card payments, wallet auto‑credit, and refund‑based withdrawals (no growing local JSON store).

 # AuctionProject

 Full‑stack auction platform (React + Vite frontend, Express backend) used in the course demo.

 This README explains how to run the project locally with a single command (`npm run dev`) that starts both frontend and backend in development mode.

 **Quick summary**
 - Frontend: React + Vite (default dev port: `5173`)
 - Backend: Express server in `server/` (default port: `3001`)
 - Unified dev command: run `npm install` then `npm run dev` at project root

 ---
 ## Prerequisites
 - Node.js (v18+ recommended)
 - npm (v9+ recommended)

 ---
 ## Secure env setup (required before running)
 1. Copy root `.env.example` to `.env` and fill any necessary client-side values (public keys). This file is used by the frontend for Vite envs.
 2. Copy `server/.env.example` to `server/.env` and set server secrets (example: `OMISE_SECRET_KEY`).

 Important: do NOT commit `.env` or `server/.env` to source control. The repository includes `.env.example` files for reference only.

 ---
 ## Install & run (one command)
 From project root:

 ```powershell
 npm install
 npm run dev
 ```

 Notes:
 - The root `postinstall` runs `npm install` inside `server/` automatically.
 - `npm run dev` runs the frontend (`vite`) and backend (`server`) in parallel using `concurrently`.

 If you prefer to run parts individually:

 ```powershell
 # frontend only
 npm run dev:client

 # backend only (from project root)
 npm run dev:server
 # or inside server/
 # cd server; npm run dev
 ```

 ---
 ## How it works (short)
 - Client creates Omise tokens (client-side public key) and posts them to the backend for charging.
 - Backend (`server/src/index.js`) performs idempotent charges and provides endpoints for polling charge status, creating promptpay/offsite sources, and issuing refunds for withdrawals.
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
 If you want, I can also add a short `demo.md` with example env values and screenshots for the professor.
