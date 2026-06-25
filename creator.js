const STORAGE_KEY = 'niem_certificate_creator_records_v1';

const creatorState = {
  records: [],
  current: null
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');

  creatorState.records = loadRecords();
  form.issueDate.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('input', () => {
    creatorState.current = buildRecordFromForm(false);
    renderPreview(creatorState.current);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const record = buildRecordFromForm(true);
    saveRecord(record);
    creatorState.current = record;
    renderPreview(record);
    renderHistory();
    showPublicToast('สร้างใบประกาศเรียบร้อย');
  });

  document.getElementById('printButton').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('clearButton').addEventListener('click', () => {
    creatorState.current = null;
    form.reset();
    form.organizationName.value = 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ';
    form.certificateTitle.value = 'ใบประกาศนียบัตร';
    form.courseCode.value = 'NIEM';
    form.hours.value = '6';
    form.issueDate.value = new Date().toISOString().slice(0, 10);
    creatorState.current = buildRecordFromForm(false);
    renderPreview(creatorState.current);
  });

  document.getElementById('clearHistoryButton').addEventListener('click', () => {
    if (!creatorState.records.length) return;
    if (!confirm('ยืนยันการล้างประวัติใบประกาศทั้งหมดในเครื่องนี้?')) return;
    creatorState.records = [];
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showPublicToast('ล้างประวัติแล้ว');
  });

  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  renderHistory();
});

function buildRecordFromForm(finalize) {
  const form = document.getElementById('certificateForm');
  const values = Object.fromEntries(new FormData(form).entries());
  const courseCode = normalizeCourseCode(values.courseCode || 'NIEM');
  const issueDate = values.issueDate || new Date().toISOString().slice(0, 10);
  const certificateNo = finalize
    ? makeCertificateNo(courseCode, issueDate)
    : (creatorState.current && creatorState.current.certificateNo) || previewCertificateNo(courseCode, issueDate);

  return {
    id: (creatorState.current && creatorState.current.id) || makeId(),
    certificateNo,
    organizationName: clean(values.organizationName) || 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ',
    certificateTitle: clean(values.certificateTitle) || 'ใบประกาศนียบัตร',
    recipientName: clean(values.recipientName) || 'ชื่อผู้รับใบประกาศ',
    courseName: clean(values.courseName) || 'ชื่อหลักสูตรหรือกิจกรรม',
    courseCode,
    hours: clean(values.hours),
    issueDate,
    expireDate: values.expireDate || '',
    signerName: clean(values.signerName) || 'ผู้ลงนาม',
    signerTitle: clean(values.signerTitle) || 'ตำแหน่ง',
    note: clean(values.note),
    createdAt: (creatorState.current && creatorState.current.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function saveRecord(record) {
  const existingIndex = creatorState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    creatorState.records[existingIndex] = record;
  } else {
    creatorState.records.unshift(record);
  }

  creatorState.records = creatorState.records.slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creatorState.records));
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function renderPreview(record) {
  setText('previewCertNo', record.certificateNo);
  setText('previewCertNoFooter', record.certificateNo);
  setText('previewIssueDate', 'วันที่ออก ' + toThaiDate(record.issueDate));
  setText('previewOrganization', record.organizationName);
  setText('previewTitle', record.certificateTitle);
  setText('previewRecipient', record.recipientName);
  setText('previewCourse', record.courseName);
  setText('previewHours', record.hours ? `จำนวน ${record.hours} ชั่วโมง` : '');
  setText('previewNote', record.note);
  setText('previewSigner', record.signerName);
  setText('previewSignerTitle', record.signerTitle);
  setText('previewExpireDate', record.expireDate ? toThaiDate(record.expireDate) : '-');
}

function renderHistory() {
  const list = document.getElementById('historyList');
  document.getElementById('recordCount').textContent = `${creatorState.records.length} รายการ`;

  if (!creatorState.records.length) {
    list.innerHTML = `
      <article class="empty-state">
        <strong>ยังไม่มีประวัติ</strong>
        <span>รายการที่สร้างจะถูกบันทึกไว้ใน browser เครื่องนี้</span>
      </article>
    `;
    return;
  }

  list.innerHTML = creatorState.records.map((record) => `
    <button class="history-item" type="button" data-id="${escapeAttr(record.id)}">
      <strong>${escapeHtml(record.recipientName)}</strong>
      <span>${escapeHtml(record.certificateNo)} · ${escapeHtml(record.courseName)}</span>
    </button>
  `).join('');

  list.querySelectorAll('.history-item').forEach((button) => {
    button.addEventListener('click', () => {
      const record = creatorState.records.find((item) => item.id === button.dataset.id);
      if (!record) return;
      loadRecordIntoForm(record);
      creatorState.current = record;
      renderPreview(record);
      showPublicToast('โหลดรายการแล้ว');
    });
  });
}

function loadRecordIntoForm(record) {
  const form = document.getElementById('certificateForm');
  form.organizationName.value = record.organizationName || '';
  form.certificateTitle.value = record.certificateTitle || '';
  form.recipientName.value = record.recipientName || '';
  form.courseName.value = record.courseName || '';
  form.courseCode.value = record.courseCode || '';
  form.hours.value = record.hours || '';
  form.issueDate.value = record.issueDate || '';
  form.expireDate.value = record.expireDate || '';
  form.signerName.value = record.signerName || '';
  form.signerTitle.value = record.signerTitle || '';
  form.note.value = record.note || '';
}

function makeCertificateNo(courseCode, issueDate) {
  const year = toThaiYear(issueDate);
  const prefix = `CERT-${courseCode}-${year}`;
  const next = creatorState.records
    .filter((record) => String(record.certificateNo || '').startsWith(prefix))
    .length + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

function previewCertificateNo(courseCode, issueDate) {
  return `CERT-${courseCode}-${toThaiYear(issueDate)}-0001`;
}

function normalizeCourseCode(value) {
  const code = String(value || 'NIEM').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return code.slice(0, 12) || 'NIEM';
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'cert_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function toThaiYear(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().getFullYear() + 543;
  return date.getFullYear() + 543;
}

function toThaiDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function setText(id, value) {
  document.getElementById(id).textContent = value || '';
}

function clean(value) {
  return String(value || '').trim();
}

function showPublicToast(message) {
  const toast = document.getElementById('publicToast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showPublicToast.timer);
  showPublicToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
