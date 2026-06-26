const { clearSessionCookie } = require('../lib/staff-auth');

module.exports = function handler(req, res) {
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
};
