const { appendQueryParams, getAppsScriptUrl } = require('../lib/apps-script-url');

const TARGETS = new Set(['home', 'admin', 'verify']);

module.exports = function handler(req, res) {
  try {
    const target = String(req.query.target || 'home');
    if (!TARGETS.has(target)) {
      res.status(400).json({ ok: false, message: 'Invalid redirect target.' });
      return;
    }

    const appsScriptUrl = getAppsScriptUrl();
    const params = {};

    if (target === 'admin') {
      params.admin = '1';
    }

    if (target === 'verify') {
      const certificateNo = String(req.query.certificateNo || '').trim();
      if (!certificateNo) {
        res.status(400).json({ ok: false, message: 'certificateNo is required.' });
        return;
      }
      params.verify = certificateNo;
    }

    res.writeHead(302, {
      Location: appendQueryParams(appsScriptUrl, params),
      'Cache-Control': 'no-store'
    });
    res.end();
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};
