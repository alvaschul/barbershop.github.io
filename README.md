# barbershop.github.io

Badboy Barber POS — offline-first Vite/React/TypeScript app for GitHub Pages.

## Setup

```bash
npm install
npm run dev      # local dev
npm run build    # tsc && vite build -> dist/
```

## Deploy

- Pushes to `main` are validated and deployed automatically by `.github/workflows/deploy.yml`.
- GitHub Pages must use **GitHub Actions** as its build source; the old `gh-pages` branch is no longer the deployment source.
- The Excel export uses `exceljs` and is loaded only when the export button is used.

## Cloud sync (optional)

1. Deploy the Worker in `workers/d1-sync/` to Cloudflare Workers with a D1 binding `DB` and
   secret `SYNC_TOKEN`. It serves:
   - `GET/PUT /api/sync` — `{ updatedAt, backup }` backup store
   - `GET /api/health` — auth check
2. In the app: **Pengaturan → Sync → Sync Cloudflare**, set the endpoint
   (`https://<worker>.workers.dev/api/sync`) + token, and toggle **Auto-sync setelah transaksi**.

## Google Sheets (optional)

1. Open the spreadsheet → **Extensions → Apps Script**, paste
   `workers/d1-sync/sheets-apps-script.gs`, then **Deploy → New deployment**
   (Execute as: Me, Who can access: **Anyone**). Copy the `/exec` URL.
2. In the app: **Pengaturan → Sync → Google Sheets**, paste the URL and toggle
   **Auto-input tiap transaksi**.
3. Each sale appends a row to the sheet **Transaksi**; the button **Kirim ke sheet**
   on the Laporan page appends the daily recap to **Laporan Harian**.

## Apps Script + CORS note

The app posts JSON to the `/exec` URL with `Content-Type: text/plain` (a "simple"
request), which avoids the browser CORS preflight entirely.
