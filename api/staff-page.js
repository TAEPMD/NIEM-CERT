const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/staff-auth');

module.exports = function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.writeHead(302, {
      Location: '/staff-login.html?next=/staff',
      'Cache-Control': 'no-store'
    });
    res.end();
    return;
  }

  const filePath = path.join(process.cwd(), 'creator.html');
  const html = fs.readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
