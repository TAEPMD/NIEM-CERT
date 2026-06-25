const { appendQueryParams, getAppsScriptUrl } = require('../lib/apps-script-url');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ ok: false, message: 'Method not allowed.' });
    return;
  }

  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    res.status(400).json({ ok: false, message: 'กรุณาพิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร' });
    return;
  }

  try {
    const appsScriptUrl = getAppsScriptUrl();
    const searchUrl = appendQueryParams(appsScriptUrl, {
      api: 'publicSearch',
      q: query
    });

    const upstream = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json'
      },
      redirect: 'follow'
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('Apps Script backend did not return JSON.');
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.status(upstream.ok ? 200 : upstream.status).json(payload);
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error.message || 'ไม่สามารถเชื่อมต่อ Apps Script backend ได้'
    });
  }
};
