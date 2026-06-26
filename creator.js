import {
  defaultCourses,
  getCourseById,
  getSelectedCourse,
  loadCourses,
  makeCertificateNo,
  normalizeCourseCode,
  renderCourseSelector,
  renderSelectedCourseSummary
} from './modules/courses.js';
import {
  calculateExpireDate
} from './modules/expiry.js';
import {
  loadRecords,
  persistRecords,
  upsertRecord
} from './modules/records.js';
import {
  clean,
  formatDateInput,
  makeId,
  setText,
  showToast,
  toThaiDate
} from './modules/utils.js';

const creatorState = {
  records: [],
  courses: [],
  current: null
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');

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
    renderCourseModule(record.courseId);
    showToast('สร้างใบประกาศเรียบร้อย');
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

  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
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
  creatorState.records = upsertRecord(creatorState.records, record);
  persistRecords(creatorState.records);
}

function renderCourseModule(selectedCourseId) {
  renderCourseSelector(creatorState.courses, selectedCourseId);
  renderSelectedCourseSummary(getSelectedCourse(creatorState.courses), getNextCertificateNoForSelectedCourse());
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
