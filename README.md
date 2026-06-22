# Dead and Breakfast

Walletless Normies API time-management game for the hackathon.

Players run a monochrome bed-and-breakfast for Normies:

- Zombies get lab-grown human meat so Humans stay safe.
- Humans get calm rooms and safety-first breakfast service.
- Aliens are VIPs whose successful service calibrates the bioreactor.
- Agents are VIPs whose successful service speeds operations.
- Cats get ocean fish blended with kitchen scraps.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

The app uses the live Normies API when available and falls back to a local demo roster when the API is unavailable.

## Deployment

This root project should deploy separately from the existing `normies-type-button` repo:

```bash
npm run build
npx wrangler pages deploy dist --project-name dead-and-breakfast
```
