const { getAppsScriptUrl } = require('../lib/apps-script-url');

module.exports = function handler(req, res) {
  try {
    const appsScriptUrl = getAppsScriptUrl();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      ok: true,
      data: {
        configured: true,
        appsScriptUrl
      }
    });
  } catch (error) {
    res.status(200).json({
      ok: true,
      data: {
        configured: false,
        message: error.message
      }
    });
  }
};
