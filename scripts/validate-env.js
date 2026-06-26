const { isUsableAppsScriptUrl } = require('../lib/apps-script-url');

const url = String(process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();

if (!url) {
  console.warn('APPS_SCRIPT_WEB_APP_URL is not set. The Vercel app will deploy, but search/admin redirects will show configuration errors until the env var is added.');
} else if (!isUsableAppsScriptUrl(url)) {
  console.error('APPS_SCRIPT_WEB_APP_URL must be a script.google.com /exec or /dev Web App URL.');
  process.exit(1);
}

if (!process.env.STAFF_PASSWORD) {
  console.error('STAFF_PASSWORD is required for the protected staff area.');
  process.exit(1);
}

if (!process.env.STAFF_AUTH_SECRET || String(process.env.STAFF_AUTH_SECRET).length < 24) {
  console.error('STAFF_AUTH_SECRET is required and must be at least 24 characters.');
  process.exit(1);
}

console.log('Environment validated.');
