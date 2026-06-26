const { isUsableAppsScriptUrl } = require('../lib/apps-script-url');

const url = String(process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();

if (!url) {
  console.warn('APPS_SCRIPT_WEB_APP_URL is not set. The Vercel app will deploy, but search/admin redirects will show configuration errors until the env var is added.');
} else if (!isUsableAppsScriptUrl(url)) {
  console.warn('APPS_SCRIPT_WEB_APP_URL must be a script.google.com /exec or /dev Web App URL. Search/admin redirects will not work until fixed.');
}

if (!process.env.STAFF_PASSWORD) {
  console.warn('STAFF_PASSWORD is not set. The staff login page will show a configuration error until the env var is added.');
}

if (!process.env.STAFF_AUTH_SECRET || String(process.env.STAFF_AUTH_SECRET).length < 24) {
  console.warn('STAFF_AUTH_SECRET is not set or is too short. The staff login page will show a configuration error until the env var is added.');
}

console.log('Build environment checked.');
