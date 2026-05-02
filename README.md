# Sapybase Web App (Next.js)

Sapybase is a Next.js (App Router) SaaS frontend for AI chatbot management, embedding, and business-facing pages.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Clerk authentication
- Vitest test suite

## Run locally

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint checks
- `npm run test` — run tests once

## Architecture notes

- App Router routes live under `src/app`.
- Auth-gated dashboard routes are protected in `src/middleware.ts`.
- API proxy behavior and headers are configured in `next.config.mjs`.
- Public embeddable widget loader is served from `/public` and `/embed/[botId]` route.

## Operations

Operational runbooks and migration audits are in `docs/runbooks/`.
