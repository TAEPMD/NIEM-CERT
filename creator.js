const RECORD_STORAGE_KEY = 'niem_certificate_creator_records_v2';
const COURSE_STORAGE_KEY = 'niem_certificate_creator_courses_v1';
const EXPIRY_WARNING_DAYS = 30;

const defaultCourses = [
  {
    id: 'course_niem',
    code: 'NIEM',
    name: 'หลักสูตรมาตรฐานสถาบันการแพทย์ฉุกเฉิน',
    hours: '6',
    validityDays: '730'
  },
  {
    id: 'course_bls',
    code: 'BLS',
    name: 'Basic Life Support',
    hours: '8',
    validityDays: '730'
  }
];

const creatorState = {
  records: [],
  courses: [],
  current: null
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');
  const courseForm = document.getElementById('courseForm');

  verifyStaffSession();
  creatorState.records = loadRecords();
  creatorState.courses = loadCourses();
  form.issueDate.value = formatDateInput(new Date());

  renderCourses();
  applySelectedCourseDefaults(true);

  form.addEventListener('input', (event) => {
    if (event.target.name === 'issueDate' || event.target.name === 'courseId') {
      applySelectedCourseDefaults(false);
    }
    creatorState.current = buildRecordFromForm(false);
    renderPreview(creatorState.current);
  });

  form.addEventListener('change', (event) => {
    if (event.target.name === 'courseId') {
      applySelectedCourseDefaults(true);
      creatorState.current = buildRecordFromForm(false);
      renderPreview(creatorState.current);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const record = buildRecordFromForm(true);
    saveRecord(record);
    creatorState.current = record;
    renderPreview(record);
    renderHistory();
    renderExpiryAlerts();
    showPublicToast('สร้างใบประกาศเรียบร้อย');
  });

  courseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const course = buildCourseFromForm(courseForm);
      saveCourse(course);
      courseForm.reset();
      courseForm.hours.value = '6';
      courseForm.validityDays.value = '730';
      renderCourses(course.id);
      applySelectedCourseDefaults(true);
      creatorState.current = buildRecordFromForm(false);
      renderPreview(creatorState.current);
      showPublicToast('เพิ่มหลักสูตรเรียบร้อย');
    } catch (error) {
      showPublicToast(error.message || 'เพิ่มหลักสูตรไม่สำเร็จ');
    }
  });

  document.getElementById('printButton').addEventListener('click', () => {
    window.print();
  });

  const logoutButton = document.getElementById('staffLogoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', logoutStaff);
  }

  document.getElementById('clearButton').addEventListener('click', () => {
    resetCertificateForm();
  });

  document.getElementById('clearHistoryButton').addEventListener('click', () => {
    if (!creatorState.records.length) return;
    if (!confirm('ยืนยันการล้างประวัติใบประกาศทั้งหมดในเครื่องนี้?')) return;
    creatorState.records = [];
    localStorage.removeItem(RECORD_STORAGE_KEY);
    renderHistory();
    renderExpiryAlerts();
    showPublicToast('ล้างประวัติแล้ว');
  });

  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  renderHistory();
  renderExpiryAlerts();
});

async function verifyStaffSession() {
  try {
    const response = await fetch('/api/staff-session', { cache: 'no-store' });
    const payload = await response.json();
    if (!payload || !payload.data || payload.data.authenticated !== true) {
      window.location.replace('/staff-login.html?next=/staff');
    }
  } catch (error) {
    window.location.replace('/staff-login.html?next=/staff');
  }
}

async function logoutStaff() {
  try {
    await fetch('/api/staff-logout', { method: 'POST' });
  } finally {
    window.location.replace('/staff-login.html');
  }
}

function buildRecordFromForm(finalize) {
  const form = document.getElementById('certificateForm');
  const values = Object.fromEntries(new FormData(form).entries());
  const course = getCourseById(values.courseId) || creatorState.courses[0] || defaultCourses[0];
  const courseCode = normalizeCourseCode(course.code);
  const issueDate = values.issueDate || formatDateInput(new Date());
  const shouldKeepCertificateNo = creatorState.current &&
    creatorState.current.certificateNo &&
    isSavedRecord(creatorState.current.id);
  const existingCertificateNo = shouldKeepCertificateNo ? creatorState.current.certificateNo : '';
  const certificateNo = finalize
    ? existingCertificateNo || makeCertificateNo(courseCode, issueDate)
    : existingCertificateNo || previewCertificateNo(courseCode, issueDate);

  return {
    id: (creatorState.current && creatorState.current.id) || makeId(),
    certificateNo,
    organizationName: clean(values.organizationName) || 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ',
    certificateTitle: clean(values.certificateTitle) || 'ใบประกาศนียบัตร',
    recipientName: clean(values.recipientName) || 'ชื่อผู้รับใบประกาศ',
    courseId: course.id,
    courseName: course.name,
    courseCode,
    hours: clean(course.hours),
    issueDate,
    expireDate: values.expireDate || '',
    signerName: clean(values.signerName) || 'ผู้ลงนาม',
    signerTitle: clean(values.signerTitle) || 'ตำแหน่ง',
    note: clean(values.note),
    createdAt: (creatorState.current && creatorState.current.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildCourseFromForm(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const code = normalizeCourseCode(values.code);
  if (!code) throw new Error('กรุณาระบุรหัสหลักสูตร');

  return {
    id: makeId(),
    code,
    name: clean(values.name) || code,
    hours: clean(values.hours),
    validityDays: clean(values.validityDays)
  };
}

function saveRecord(record) {
  const existingIndex = creatorState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    creatorState.records[existingIndex] = record;
  } else {
    creatorState.records.unshift(record);
  }

  creatorState.records = creatorState.records.slice(0, 500);
  localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(creatorState.records));
}

function saveCourse(course) {
  const duplicate = creatorState.courses.find((item) => item.code === course.code);
  if (duplicate) {
    duplicate.name = course.name;
    duplicate.hours = course.hours;
    duplicate.validityDays = course.validityDays;
  } else {
    creatorState.courses.push(course);
  }

  localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(creatorState.courses));
}

function deleteCourse(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;

  const usedCount = creatorState.records.filter((record) => record.courseId === courseId || record.courseCode === course.code).length;
  const message = usedCount
    ? `หลักสูตรนี้ถูกใช้ในใบประกาศ ${usedCount} รายการ หากลบ ประวัติเดิมจะยังเก็บชื่อหลักสูตรไว้ ต้องการลบหรือไม่?`
    : 'ยืนยันการลบหลักสูตรนี้?';

  if (!confirm(message)) return;

  creatorState.courses = creatorState.courses.filter((item) => item.id !== courseId);
  if (!creatorState.courses.length) {
    creatorState.courses = defaultCourses.map((item) => Object.assign({}, item));
  }
  localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(creatorState.courses));
  renderCourses();
  applySelectedCourseDefaults(true);
  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  showPublicToast('ลบหลักสูตรแล้ว');
}

function loadRecords() {
  try {
    const modern = JSON.parse(localStorage.getItem(RECORD_STORAGE_KEY) || '[]');
    if (Array.isArray(modern) && modern.length) return modern;

    const legacy = JSON.parse(localStorage.getItem('niem_certificate_creator_records_v1') || '[]');
    return Array.isArray(legacy) ? legacy : [];
  } catch (error) {
    return [];
  }
}

function loadCourses() {
  try {
    const courses = JSON.parse(localStorage.getItem(COURSE_STORAGE_KEY) || '[]');
    if (Array.isArray(courses) && courses.length) return courses;
  } catch (error) {
    // Fall through to defaults.
  }
  return defaultCourses.map((item) => Object.assign({}, item));
}

function renderCourses(selectedCourseId) {
  const select = document.getElementById('courseSelect');
  const list = document.getElementById('courseList');
  const requestedCourseId = selectedCourseId || select.value;
  const activeCourseId = getCourseById(requestedCourseId)
    ? requestedCourseId
    : (creatorState.courses[0] && creatorState.courses[0].id);

  select.innerHTML = creatorState.courses.map((course) => `
    <option value="${escapeAttr(course.id)}">${escapeHtml(course.code)} - ${escapeHtml(course.name)}</option>
  `).join('');
  select.value = activeCourseId;

  document.getElementById('courseCount').textContent = `${creatorState.courses.length} รายการ`;
  list.innerHTML = creatorState.courses.map((course) => `
    <article class="course-item">
      <div>
        <strong>${escapeHtml(course.code)} - ${escapeHtml(course.name)}</strong>
        <span>${escapeHtml(course.hours || '0')} ชั่วโมง · อายุใบประกาศ ${escapeHtml(course.validityDays || '0')} วัน</span>
      </div>
      <button class="delete-course-button" type="button" data-course-id="${escapeAttr(course.id)}">ลบ</button>
    </article>
  `).join('');

  list.querySelectorAll('.delete-course-button').forEach((button) => {
    button.addEventListener('click', () => deleteCourse(button.dataset.courseId));
  });

  renderSelectedCourseSummary();
}

function renderSelectedCourseSummary() {
  const course = getSelectedCourse();
  const summary = document.getElementById('selectedCourseSummary');
  if (!course) {
    summary.textContent = 'ยังไม่มีหลักสูตร';
    return;
  }

  const nextNo = previewCertificateNo(course.code, document.getElementById('certificateForm').issueDate.value);
  summary.textContent = `รหัส ${course.code} · ${course.hours || 0} ชั่วโมง · อายุ ${course.validityDays || 0} วัน · เลขถัดไป ${nextNo}`;
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

  list.innerHTML = creatorState.records.map((record) => {
    const expiry = getExpiryState(record);
    return `
      <button class="history-item" type="button" data-id="${escapeAttr(record.id)}">
        <strong>${escapeHtml(record.recipientName)}</strong>
        <span>${escapeHtml(record.certificateNo)} · ${escapeHtml(record.courseCode)} · ${escapeHtml(record.courseName)}</span>
        <span>${escapeHtml(expiry.label)}</span>
      </button>
    `;
  }).join('');

  list.querySelectorAll('.history-item').forEach((button) => {
    button.addEventListener('click', () => {
      const record = creatorState.records.find((item) => item.id === button.dataset.id);
      if (!record) return;
      loadRecordIntoForm(record);
      creatorState.current = record;
      renderPreview(record);
      renderSelectedCourseSummary();
      showPublicToast('โหลดรายการแล้ว');
    });
  });
}

function renderExpiryAlerts() {
  const alerts = creatorState.records
    .map((record) => ({ record, expiry: getExpiryState(record) }))
    .filter((item) => item.expiry.kind === 'expired' || item.expiry.kind === 'warning')
    .sort((a, b) => a.expiry.daysLeft - b.expiry.daysLeft);

  const container = document.getElementById('expiryAlerts');
  document.getElementById('expiryCount').textContent = `${alerts.length} รายการ`;

  if (!alerts.length) {
    container.innerHTML = `
      <article class="empty-state">
        <strong>ไม่มีรายการต้องแจ้งเตือน</strong>
        <span>ระบบจะแสดงใบประกาศที่หมดอายุแล้วหรือใกล้หมดอายุใน ${EXPIRY_WARNING_DAYS} วัน</span>
      </article>
    `;
    return;
  }

  container.innerHTML = alerts.map(({ record, expiry }) => `
    <article class="expiry-item is-${expiry.kind}">
      <strong>${escapeHtml(record.recipientName)} · ${escapeHtml(record.certificateNo)}</strong>
      <span>${escapeHtml(record.courseCode)} - ${escapeHtml(record.courseName)}</span>
      <span>${escapeHtml(expiry.label)}</span>
    </article>
  `).join('');
}

function loadRecordIntoForm(record) {
  const form = document.getElementById('certificateForm');
  const course = getCourseById(record.courseId) || getCourseByCode(record.courseCode);

  form.organizationName.value = record.organizationName || '';
  form.certificateTitle.value = record.certificateTitle || '';
  form.recipientName.value = record.recipientName || '';
  if (course) form.courseId.value = course.id;
  form.issueDate.value = record.issueDate || '';
  form.expireDate.value = record.expireDate || '';
  form.signerName.value = record.signerName || '';
  form.signerTitle.value = record.signerTitle || '';
  form.note.value = record.note || '';
  renderSelectedCourseSummary();
}

function resetCertificateForm() {
  const form = document.getElementById('certificateForm');
  creatorState.current = null;
  form.reset();
  form.organizationName.value = 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ';
  form.certificateTitle.value = 'ใบประกาศนียบัตร';
  form.issueDate.value = formatDateInput(new Date());
  if (creatorState.courses[0]) form.courseId.value = creatorState.courses[0].id;
  applySelectedCourseDefaults(true);
  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  renderSelectedCourseSummary();
}

function applySelectedCourseDefaults(forceExpireDate) {
  const form = document.getElementById('certificateForm');
  const course = getSelectedCourse();
  if (!course) return;

  if (forceExpireDate || !form.expireDate.value) {
    form.expireDate.value = calculateExpireDate(form.issueDate.value, Number(course.validityDays || 0));
  }

  renderSelectedCourseSummary();
}

function makeCertificateNo(courseCode, issueDate) {
  const year = toThaiYear(issueDate);
  const prefix = `CERT-${normalizeCourseCode(courseCode)}-${year}`;
  const next = creatorState.records
    .filter((record) => record.id !== (creatorState.current && creatorState.current.id))
    .filter((record) => String(record.certificateNo || '').startsWith(prefix))
    .length + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

function previewCertificateNo(courseCode, issueDate) {
  return makeCertificateNo(courseCode, issueDate);
}

function isSavedRecord(id) {
  return creatorState.records.some((record) => record.id === id);
}

function getExpiryState(record) {
  if (!record.expireDate) {
    return { kind: 'none', daysLeft: Infinity, label: 'ไม่มีวันหมดอายุ' };
  }

  const today = startOfDay(new Date());
  const expireDate = startOfDay(parseDateInput(record.expireDate));
  if (Number.isNaN(expireDate.getTime())) {
    return { kind: 'none', daysLeft: Infinity, label: 'วันหมดอายุไม่ถูกต้อง' };
  }

  const daysLeft = Math.ceil((expireDate.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) {
    return { kind: 'expired', daysLeft, label: `หมดอายุแล้ว ${Math.abs(daysLeft)} วัน (${toThaiDate(record.expireDate)})` };
  }
  if (daysLeft <= EXPIRY_WARNING_DAYS) {
    return { kind: 'warning', daysLeft, label: `ใกล้หมดอายุใน ${daysLeft} วัน (${toThaiDate(record.expireDate)})` };
  }
  return { kind: 'valid', daysLeft, label: `ยังไม่หมดอายุ เหลือ ${daysLeft} วัน` };
}

function calculateExpireDate(issueDate, validityDays) {
  if (!validityDays) return '';
  const date = issueDate ? parseDateInput(issueDate) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + validityDays);
  return formatDateInput(date);
}

function getSelectedCourse() {
  return getCourseById(document.getElementById('courseSelect').value);
}

function getCourseById(id) {
  return creatorState.courses.find((course) => course.id === id) || null;
}

function getCourseByCode(code) {
  const normalizedCode = normalizeCourseCode(code);
  return creatorState.courses.find((course) => course.code === normalizedCode) || null;
}

function normalizeCourseCode(value) {
  const code = String(value || 'NIEM').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return code.slice(0, 12) || 'NIEM';
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function toThaiYear(value) {
  const date = value ? parseDateInput(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().getFullYear() + 543;
  return date.getFullYear() + 543;
}

function toThaiDate(value) {
  if (!value) return '-';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function parseDateInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
