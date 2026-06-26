document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('staffLoginForm');
  const button = document.getElementById('staffLoginButton');
  const errorBox = document.getElementById('loginError');
  const params = new URLSearchParams(window.location.search);
  const initialError = params.get('error');

  if (initialError) {
    errorBox.textContent = initialError;
    errorBox.classList.add('is-visible');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.remove('is-visible');
    button.disabled = true;
    button.textContent = 'กำลังตรวจสอบ...';

    try {
      const response = await fetch('/api/staff-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: document.getElementById('staffPassword').value
        })
      });
      const payload = await response.json();
      if (!payload || payload.ok !== true) {
        throw new Error(payload && payload.message ? payload.message : 'เข้าสู่ระบบไม่สำเร็จ');
      }
      window.location.replace(payload.data.redirectUrl || '/staff');
    } catch (error) {
      errorBox.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';
      errorBox.classList.add('is-visible');
      button.disabled = false;
      button.textContent = 'เข้าสู่ระบบ';
      document.getElementById('staffPassword').focus();
    }
  });
});
