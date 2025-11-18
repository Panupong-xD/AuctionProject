## AuctionProject

Full‑stack auction platform (React + Vite frontend, Express backend) with real Omise test‑mode card payments, wallet auto‑credit, and refund‑based withdrawals (no growing local JSON store).

### ✨ Features
- Live auction listing & detail pages
- Bidding with balance validation
- Wallet top‑up via Omise (single‑use token + idempotent charge)
- Automatic wallet credit after successful charge (polling + duplicate recovery)
- Withdraw = Omise refund (partial, LIFO across prior charges)
- Duplicate click / refresh safe (re-attaches to existing charge)
- Secure separation: secrets only in `server/.env`

### 🧱 Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express |
| Payments | Omise (client token + server charge) |

---
## 🗂 Architecture Overview
```
Client (React) ── Omise.js → createToken(card)
   │ POST /api/payments/create (includes Idempotency-Key)
   │   → Omise charge (capture)
   │ GET /api/payments/:id (poll until terminal)
   │ success → credit wallet (topUp)
   │ POST /api/payments/withdraw → server lists charges → partial refunds
```
No local payment file. Refund calculations come from Omise `charges.list` filtered by `metadata.uid`.

---
## ⚙️ Setup
### 1. Backend
```bash
cd server
cp .env.example .env   # fill sk_test_... etc.
npm install
npm run dev            # http://localhost:3001
```
`.env` keys (example):
```
OMISE_SECRET_KEY=sk_test_xxx
ALLOWED_ORIGIN=http://localhost:5173
```

### 2. Frontend
```bash
cp .env.example .env   # at project root
npm install
npm run dev            # http://localhost:5173
```
Frontend `.env` keys (public):
```
VITE_OMISE_PUBLIC_KEY=pk_test_xxx
VITE_API_BASE_URL=http://localhost:3001
```

---
## 🔑 Key Server Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/payments/create | Create card charge (idempotent) |
| GET | /api/payments/:id | Poll charge status |
| GET | /api/payments/latest?uid=&amount= | Recover existing charge after duplicate token |
| POST | /api/payments/withdraw | Issue partial refunds (LIFO) to card |
| GET | /api/omise/whoami | Diagnose Omise key/mode |
| GET | /api/health | Basic health info |

---
## 💳 Payment & Refund Flow
1. User enters card → Omise token (single use)
2. Client posts token + amount → `/api/payments/create`
3. Server creates charge with Idempotency-Key (token-based)
4. Client polls status; on `successful` auto‑credits wallet
5. Withdraw: client posts amount → server lists last N charges (metadata.uid) and creates partial refunds until amount covered
6. No local persistence needed; Omise = source of truth

Duplicate safety: If token reused (double click / refresh), server returns the existing charge (or 409 recoverable); client reattaches and continues.

---
## 🔐 Security Notes
- Secrets never enter the frontend bundle (only `VITE_*` vars are exposed)
- `.gitignore` excludes `.env`, `server/.env`, `server/src/data/`
- Rotate any leaked key immediately and rewrite Git history if committed
- For production: add Omise webhook (verify signature) → credit wallet server‑side (removes reliance on client poll)

---
## 🚀 Quick Usage
1. Top‑up on Payment page (test card: 4242 4242 4242 4242 / 12/29 / 123)
2. Place bids (must exceed current highest + within Available balance)
3. At auction end highest bidder pays; withdraw later if needed via Refund

Full rules in `src/pages/HowTo.jsx` (Thai)

---
## ❓ FAQ (Short)
**ยอดหายหลังตัดบัตร?** Refresh Payment page; duplicate recovery will credit automatically.
**คลิก Pay ซ้ำ?** Idempotency + recovery prevents double charge.
**ถอนเงินมาจากไหน?** Partial refunds of historical successful charges (latest first).

---
## ✅ Pre‑GitHub Checklist
- [ ] Removed real keys from any commit history
- [ ] `.env` / `server/.env` present locally only
- [ ] Built frontend (`npm run build`) – confirm no `sk_test_` in `dist/`
- [ ] Tested duplicate payment recovery

---
# (Original Vite README follows)
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
