function getAppsScriptUrl() {
  const url = String(process.env.APPS_SCRIPT_WEB_APP_URL || '').trim();

  if (!url) {
    throw new Error('Missing APPS_SCRIPT_WEB_APP_URL environment variable.');
  }

  if (!isUsableAppsScriptUrl(url)) {
    throw new Error('APPS_SCRIPT_WEB_APP_URL must be a script.google.com /exec or /dev Web App URL.');
  }

  return url;
}

function isUsableAppsScriptUrl(url) {
  const value = String(url || '').trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/(exec|dev)(\?|#|$)/.test(value) &&
    value.indexOf('googleusercontent.com') === -1 &&
    value.indexOf('userCodeAppPanel') === -1;
}

function appendQueryParams(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

module.exports = {
  appendQueryParams,
  getAppsScriptUrl,
  isUsableAppsScriptUrl
};
