const state = {
  configured: false,
  lastQuery: '',
  results: []
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('publicSearchForm');
  const input = document.getElementById('publicSearchInput');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runPublicSearch(input.value);
  });

  loadConfig();

  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');
  if (query) {
    input.value = query;
    runPublicSearch(query);
  }
});

async function loadConfig() {
  const hint = document.getElementById('configHint');

  try {
    const response = await fetch('/api/config');
    const payload = await response.json();
    state.configured = Boolean(payload && payload.ok && payload.data && payload.data.configured);

    if (state.configured) {
      hint.textContent = 'เชื่อมต่อ backend เรียบร้อย ระบบแสดงเฉพาะใบประกาศที่ออกแล้วและยังไม่ถูกยกเลิก';
      hint.classList.remove('is-error');
      return;
    }

    hint.textContent = payload.data && payload.data.message
      ? payload.data.message
      : 'ยังไม่ได้ตั้งค่า APPS_SCRIPT_WEB_APP_URL บน Vercel';
    hint.classList.add('is-error');
  } catch (error) {
    hint.textContent = 'ตรวจสอบการเชื่อมต่อ backend ไม่สำเร็จ';
    hint.classList.add('is-error');
  }
}

async function runPublicSearch(query) {
  const keyword = String(query || '').trim();
  state.lastQuery = keyword;

  if (keyword.length < 2) {
    renderPublicEmpty('กรุณาพิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร', 'ค้นหาได้ด้วยเลขที่ใบประกาศ ชื่อผู้รับ หรือชื่อหลักสูตร');
    setResultCount('พร้อมค้นหา');
    return;
  }

  setResultCount('กำลังค้นหา...');
  document.getElementById('publicResults').innerHTML = `
    <article class="empty-state">
      <strong>กำลังค้นหา</strong>
      <span>กรุณารอสักครู่</span>
    </article>
  `;

  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(keyword));
    const payload = await response.json();
    if (!payload || payload.ok !== true) {
      throw new Error(payload && payload.message ? payload.message : 'ค้นหาไม่สำเร็จ');
    }

    state.results = payload.data.items || [];
    renderPublicResults(state.results, keyword);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('q', keyword);
    window.history.replaceState({}, '', nextUrl.toString());
  } catch (error) {
    renderPublicEmpty('ไม่สามารถค้นหาได้', error.message || 'เกิดข้อผิดพลาด');
    showPublicToast(error.message || 'เกิดข้อผิดพลาด');
    setResultCount('ค้นหาไม่สำเร็จ');
  }
}

function renderPublicResults(items, keyword) {
  if (!items.length) {
    setResultCount('ไม่พบข้อมูล');
    renderPublicEmpty('ไม่พบใบประกาศที่ตรงกับคำค้นหา', `คำค้นหา: ${keyword}`);
    return;
  }

  setResultCount(`พบ ${items.length} รายการ`);
  document.getElementById('publicResults').innerHTML = items.map((item) => {
    const verifyUrl = `/api/redirect?target=verify&certificateNo=${encodeURIComponent(item.certificateNo || '')}`;
    const pdfLink = item.pdfUrl
      ? `<a class="action-link" href="${escapePublicAttr(item.pdfUrl)}" target="_blank" rel="noopener noreferrer">เปิด PDF</a>`
      : '';

    return `
      <article class="result-card">
        <div>
          <h3>${escapePublicHtml(item.recipientName || '-')}</h3>
          <dl>
            <div>
              <dt>เลขที่ใบประกาศ</dt>
              <dd>${escapePublicHtml(item.certificateNo || '-')}</dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd><span class="status">${escapePublicHtml(item.status || 'ออกแล้ว')}</span></dd>
            </div>
            <div>
              <dt>หลักสูตร/กิจกรรม</dt>
              <dd>${escapePublicHtml([item.courseCode, item.courseName].filter(Boolean).join(' - ') || '-')}</dd>
            </div>
            <div>
              <dt>วันที่ออก</dt>
              <dd>${escapePublicHtml(toPublicThaiDate(item.issueDate))}</dd>
            </div>
            <div>
              <dt>วันหมดอายุ</dt>
              <dd>${escapePublicHtml(toPublicThaiDate(item.expireDate))}</dd>
            </div>
          </dl>
        </div>
        <div class="result-actions">
          <a class="action-link" href="${escapePublicAttr(verifyUrl)}" target="_blank" rel="noopener noreferrer">ตรวจสอบ</a>
          ${pdfLink}
        </div>
      </article>
    `;
  }).join('');
}

function renderPublicEmpty(title, detail) {
  document.getElementById('publicResults').innerHTML = `
    <article class="empty-state">
      <strong>${escapePublicHtml(title)}</strong>
      <span>${escapePublicHtml(detail)}</span>
    </article>
  `;
}

function setResultCount(text) {
  document.getElementById('resultCount').textContent = text;
}

function showPublicToast(message) {
  const toast = document.getElementById('publicToast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showPublicToast.timer);
  showPublicToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function toPublicThaiDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapePublicHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function escapePublicAttr(value) {
  return escapePublicHtml(value).replace(/`/g, '&#096;');
}
