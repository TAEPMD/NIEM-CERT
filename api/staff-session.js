const { isAuthenticated } = require('../lib/staff-auth');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    data: {
      authenticated: isAuthenticated(req)
    }
  });
};
