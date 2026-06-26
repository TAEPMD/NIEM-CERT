const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/staff-auth');

module.exports = function handler(req, res) {
  let authenticated = false;
  try {
    authenticated = isAuthenticated(req);
  } catch (error) {
    res.writeHead(302, {
      Location: '/staff-login.html?error=' + encodeURIComponent(error.message),
      'Cache-Control': 'no-store'
    });
    res.end();
    return;
  }

  if (!authenticated) {
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
