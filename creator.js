import {
  buildCourseFromForm,
  defaultCourses,
  getCourseByCode,
  getCourseById,
  getSelectedCourse,
  loadCourses,
  makeCertificateNo,
  normalizeCourseCode,
  persistCourses,
  removeCourse,
  renderCourses,
  renderSelectedCourseSummary,
  upsertCourse
} from './modules/courses.js';
import {
  calculateExpireDate,
  getExpiryState,
  renderExpiryAlerts
} from './modules/expiry.js';
import {
  clean,
  escapeAttr,
  escapeHtml,
  formatDateInput,
  makeId,
  setText,
  showToast,
  toThaiDate
} from './modules/utils.js';

const RECORD_STORAGE_KEY = 'niem_certificate_creator_records_v2';

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

  renderCourseModule();
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
    renderExpiryAlerts(creatorState.records);
    renderCourseModule(record.courseId);
    showToast('สร้างใบประกาศเรียบร้อย');
  });

  courseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const course = buildCourseFromForm(courseForm);
      const result = upsertCourse(creatorState.courses, course);
      creatorState.courses = result.courses;
      persistCourses(creatorState.courses);

      courseForm.reset();
      courseForm.hours.value = '6';
      courseForm.validityDays.value = '730';
      renderCourseModule(result.selectedCourseId);
      applySelectedCourseDefaults(true);
      creatorState.current = buildRecordFromForm(false);
      renderPreview(creatorState.current);
      showToast(result.updated ? 'ปรับปรุงหลักสูตรเรียบร้อย' : 'เพิ่มหลักสูตรเรียบร้อย');
    } catch (error) {
      showToast(error.message || 'เพิ่มหลักสูตรไม่สำเร็จ');
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
    renderExpiryAlerts(creatorState.records);
    renderCourseModule();
    showToast('ล้างประวัติแล้ว');
  });

  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  renderHistory();
  renderExpiryAlerts(creatorState.records);
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
  const course = getCourseById(creatorState.courses, values.courseId) || creatorState.courses[0] || defaultCourses[0];
  const courseCode = normalizeCourseCode(course.code);
  const issueDate = values.issueDate || formatDateInput(new Date());
  const shouldKeepCertificateNo = creatorState.current &&
    creatorState.current.certificateNo &&
    isSavedRecord(creatorState.current.id);
  const existingCertificateNo = shouldKeepCertificateNo ? creatorState.current.certificateNo : '';
  const certificateNo = finalize
    ? existingCertificateNo || getNextCertificateNo(courseCode, issueDate)
    : existingCertificateNo || getNextCertificateNo(courseCode, issueDate);

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

function renderCourseModule(selectedCourseId) {
  renderCourses(creatorState.courses, creatorState.records, selectedCourseId, deleteCourse);
  renderSelectedCourseSummary(getSelectedCourse(creatorState.courses), getNextCertificateNoForSelectedCourse());
}

function deleteCourse(courseId) {
  const course = getCourseById(creatorState.courses, courseId);
  if (!course) return;

  const usedCount = creatorState.records.filter((record) => record.courseId === courseId || record.courseCode === course.code).length;
  const message = usedCount
    ? `หลักสูตรนี้ถูกใช้ในใบประกาศ ${usedCount} รายการ หากลบ ประวัติเดิมจะยังเก็บชื่อหลักสูตรไว้ ต้องการลบหรือไม่?`
    : 'ยืนยันการลบหลักสูตรนี้?';

  if (!confirm(message)) return;

  creatorState.courses = removeCourse(creatorState.courses, courseId);
  persistCourses(creatorState.courses);
  renderCourseModule();
  applySelectedCourseDefaults(true);
  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  showToast('ลบหลักสูตรแล้ว');
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
      renderCourseModule(record.courseId);
      showToast('โหลดรายการแล้ว');
    });
  });
}

function loadRecordIntoForm(record) {
  const form = document.getElementById('certificateForm');
  const course = getCourseById(creatorState.courses, record.courseId) || getCourseByCode(creatorState.courses, record.courseCode);

  form.organizationName.value = record.organizationName || '';
  form.certificateTitle.value = record.certificateTitle || '';
  form.recipientName.value = record.recipientName || '';
  if (course) form.courseId.value = course.id;
  form.issueDate.value = record.issueDate || '';
  form.expireDate.value = record.expireDate || '';
  form.signerName.value = record.signerName || '';
  form.signerTitle.value = record.signerTitle || '';
  form.note.value = record.note || '';
  renderSelectedCourseSummary(getSelectedCourse(creatorState.courses), getNextCertificateNoForSelectedCourse());
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
  renderCourseModule(form.courseId.value);
}

function applySelectedCourseDefaults(forceExpireDate) {
  const form = document.getElementById('certificateForm');
  const course = getSelectedCourse(creatorState.courses);
  if (!course) return;

  if (forceExpireDate || !form.expireDate.value) {
    form.expireDate.value = calculateExpireDate(form.issueDate.value, Number(course.validityDays || 0));
  }

  renderSelectedCourseSummary(course, getNextCertificateNo(course.code, form.issueDate.value));
}

function getNextCertificateNoForSelectedCourse() {
  const form = document.getElementById('certificateForm');
  const course = getSelectedCourse(creatorState.courses);
  if (!course) return '';
  return getNextCertificateNo(course.code, form.issueDate.value);
}

function getNextCertificateNo(courseCode, issueDate) {
  return makeCertificateNo(
    creatorState.records,
    creatorState.current && creatorState.current.id,
    courseCode,
    issueDate
  );
}

function isSavedRecord(id) {
  return creatorState.records.some((record) => record.id === id);
}
