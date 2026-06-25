# NIEM Certificate Tracking - Vercel Gateway

This folder is a Vercel-ready gateway for the existing Google Apps Script system.

Vercel hosts:

- Public certificate search UI
- `/api/search` proxy to Apps Script
- `/api/redirect` for admin and verify pages

Google Apps Script remains the backend for:

- Google Sheets data
- Certificate creation
- Admin login
- PDF/Drive integration

## Required Apps Script Change

Deploy the Apps Script project with the latest `Code.gs`, which includes:

```js
?api=publicSearch&q=...
```

That endpoint is used by `/api/search` on Vercel.

## Environment Variable

Set this in Vercel Project Settings:

```text
APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Do not use a `googleusercontent.com/userCodeAppPanel` URL.

## Local Development

```bash
cd vercel-app
copy .env.example .env.local
npm install
npm run dev
```

Edit `.env.local` and set `APPS_SCRIPT_WEB_APP_URL`.

## Deploy

```bash
cd vercel-app
npm install
npx vercel
```

Production:

```bash
npx vercel --prod
```

## Vercel CLI Env Setup

```bash
npx vercel env add APPS_SCRIPT_WEB_APP_URL production
npx vercel env add APPS_SCRIPT_WEB_APP_URL preview
```

Then redeploy.
