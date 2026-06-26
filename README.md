# NIEM Certificate Tracking - Vercel Gateway

This folder is a Vercel-ready gateway for the existing Google Apps Script system.

Vercel hosts:

- Public certificate search UI
- Protected staff area at `/staff`
- Certificate creation, certificate number running, renewal, bulk issuing, and certificate management under the staff area
- Protected certificate management page at `/staff/manage`
- `/api/search` proxy to Apps Script
- `/api/redirect` for admin and verify pages

Google Apps Script remains the backend for:

- Google Sheets data
- Public certificate search and verification data
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
- Realtime A4 landscape preview while editing certificate data
- Flexible certificate design controls: main color, recipient color, border color, border style, font scale, logo size, and certificate text
- Logo image upload for the certificate
- Multiple signers, each with signer name, signer title, and digital signature image
- Auto certificate number format: `CERT-COURSECODE-BEYEAR-0001`
- Per-course certificate running numbers
- Bulk certificate creation from CSV recipient files
- Bulk print / Save PDF for the generated CSV batch
- Local history in the browser via `localStorage`
- Print / Save as PDF using browser print

Bulk CSV format:

```csv
recipientName,note
สมชาย ใจดี,รุ่นที่ 1
สมหญิง ตั้งใจ,รุ่นที่ 1
```

If there is no header row, the first column is treated as recipient name and the second column as note.

## Certificate Management

Open after staff login:

```text
/staff/manage
```

The management page supports:

- Course master data: add/edit/delete courses with code, name, hours, and certificate validity in days or years
- Expiry tracking for expired certificates and certificates expiring within 30 days
- Filterable certificate history saved in this browser
- Renewal workflow: start a renewal from history, review the prepared draft on `/staff`, then issue a new certificate

Staff page modules:

- `modules/courses.js` manages course master data, course rendering, and per-course certificate numbers
- `modules/expiry.js` manages expiry date calculation and warning lists
- `modules/utils.js` contains shared browser formatting and escaping helpers

This page is protected by a Vercel httpOnly staff session cookie. After login, it is intentionally client-side only, so certificate/course history is stored in that browser via `localStorage`. Use the Apps Script admin system when records must be stored centrally and searchable by the public search page.
