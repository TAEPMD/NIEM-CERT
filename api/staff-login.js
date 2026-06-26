const { createSessionToken, setSessionCookie, verifyPassword } = require('../lib/staff-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJson(req);
    if (!verifyPassword(body.password)) {
      res.status(401).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
      return;
    }

    setSessionCookie(req, res, createSessionToken());
    res.status(200).json({ ok: true, data: { redirectUrl: '/staff' } });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 20) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}
