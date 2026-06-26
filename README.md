# NIEM Certificate Tracking - Vercel Gateway

This folder is a Vercel-ready gateway for the existing Google Apps Script system.

Vercel hosts:

- Public certificate search UI
- Protected staff certificate creator at `/staff`
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
STAFF_PASSWORD=your-staff-password
STAFF_AUTH_SECRET=random-secret-at-least-24-characters
```

Do not use a `googleusercontent.com/userCodeAppPanel` URL.

## Local Development

```bash
cd vercel-app
copy .env.example .env.local
npm install
npm run dev
```

Edit `.env.local` and set `APPS_SCRIPT_WEB_APP_URL`, `STAFF_PASSWORD`, and `STAFF_AUTH_SECRET`.

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
npx vercel env add STAFF_PASSWORD production
npx vercel env add STAFF_AUTH_SECRET production
npx vercel env add STAFF_PASSWORD preview
npx vercel env add STAFF_AUTH_SECRET preview
```

Then redeploy.

## Certificate Creator

Open after staff login:

```text
/staff
```

The creator page supports:

- Certificate form
- Live A4 landscape preview
- Auto certificate number format: `CERT-COURSECODE-BEYEAR-0001`
- Course master data: add/delete courses with code, name, hours, and certificate validity days
- Per-course certificate running numbers
- Expiry tracking for expired certificates and certificates expiring within 30 days
- Local history in the browser via `localStorage`
- Print / Save as PDF using browser print

This page is protected by a Vercel httpOnly staff session cookie. After login, it is intentionally client-side only, so certificate/course history is stored in that browser via `localStorage`. Use the Apps Script admin system when records must be stored centrally and searchable by the public search page.
