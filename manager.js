import {
  buildCourseFromForm,
  loadCourses,
  makeCertificateNo,
  persistCourses,
  removeCourse,
  renderCourseManager,
  upsertCourse,
  getCourseById
} from './modules/courses.js';
import {
  calculateExpireDate,
  getExpiryState,
  renderExpiryAlerts
} from './modules/expiry.js';
import {
  clearRecords,
  loadRecords,
  saveRenewalDraft
} from './modules/records.js';
import {
  escapeAttr,
  escapeHtml,
  formatDateInput,
  showToast
} from './modules/utils.js';

const managerState = {
  records: [],
  courses: [],
  filters: {
    keyword: '',
    courseCode: '',
    expiryStatus: ''
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const courseForm = document.getElementById('courseForm');
  const filterForm = document.getElementById('historyFilterForm');

  verifyStaffSession();
  managerState.records = loadRecords();
  managerState.courses = loadCourses();

  courseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const course = buildCourseFromForm(courseForm);
      const result = upsertCourse(managerState.courses, course);
      managerState.courses = result.courses;
      persistCourses(managerState.courses);

      courseForm.reset();
      courseForm.elements.hours.value = '6';
      courseForm.elements.validityValue.value = '2';
      courseForm.elements.validityUnit.value = 'year';
      setCourseFormMode('create');
      renderAll();
      showToast(result.updated ? 'ปรับปรุงหลักสูตรเรียบร้อย' : 'เพิ่มหลักสูตรเรียบร้อย');
    } catch (error) {
      showToast(error.message || 'เพิ่มหลักสูตรไม่สำเร็จ');
    }
  });

  filterForm.addEventListener('input', () => {
    updateFiltersFromForm(filterForm);
    renderHistory();
  });

  filterForm.addEventListener('change', () => {
    updateFiltersFromForm(filterForm);
    renderHistory();
  });

  document.getElementById('clearFilterButton').addEventListener('click', () => {
    filterForm.reset();
    updateFiltersFromForm(filterForm);
    renderHistory();
  });

  document.getElementById('cancelCourseEditButton').addEventListener('click', () => {
    courseForm.reset();
    courseForm.elements.hours.value = '6';
    courseForm.elements.validityValue.value = '2';
    courseForm.elements.validityUnit.value = 'year';
    setCourseFormMode('create');
  });

  const logoutButton = document.getElementById('staffLogoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', logoutStaff);
  }

  document.getElementById('clearHistoryButton').addEventListener('click', () => {
    if (!managerState.records.length) return;
    if (!confirm('ยืนยันการล้างประวัติใบประกาศทั้งหมดในเครื่องนี้?')) return;
    managerState.records = [];
    clearRecords();
    renderAll();
    showToast('ล้างประวัติแล้ว');
  });

  renderAll();
});

async function verifyStaffSession() {
  try {
    const response = await fetch('/api/staff-session', { cache: 'no-store' });
    const payload = await response.json();
    if (!payload || !payload.data || payload.data.authenticated !== true) {
      window.location.replace('/staff-login.html?next=/staff/manage');
    }
  } catch (error) {
    window.location.replace('/staff-login.html?next=/staff/manage');
  }
}

async function logoutStaff() {
  try {
    await fetch('/api/staff-logout', { method: 'POST' });
  } finally {
    window.location.replace('/staff-login.html');
  }
}

function renderAll() {
  renderCourseManager(managerState.courses, managerState.records, editCourse, deleteCourse);
  renderExpiryAlerts(managerState.records);
  renderHistoryCourseFilter();
  renderHistory();
}

function editCourse(courseId) {
  const course = getCourseById(managerState.courses, courseId);
  if (!course) return;

  const form = document.getElementById('courseForm');
  form.elements.id.value = course.id;
  form.elements.code.value = course.code || '';
  form.elements.name.value = course.name || '';
  form.elements.hours.value = course.hours || '0';
  form.elements.validityValue.value = course.validityValue || course.validityDays || '0';
  form.elements.validityUnit.value = course.validityUnit || 'day';
  setCourseFormMode('edit');
  form.elements.code.focus();
}

function deleteCourse(courseId) {
  const course = getCourseById(managerState.courses, courseId);
  if (!course) return;

  const usedCount = managerState.records.filter((record) => record.courseId === courseId || record.courseCode === course.code).length;
  const message = usedCount
    ? `หลักสูตรนี้ถูกใช้ในใบประกาศ ${usedCount} รายการ หากลบ ประวัติเดิมจะยังเก็บชื่อหลักสูตรไว้ ต้องการลบหรือไม่?`
    : 'ยืนยันการลบหลักสูตรนี้?';

  if (!confirm(message)) return;

  managerState.courses = removeCourse(managerState.courses, courseId);
  persistCourses(managerState.courses);
  renderAll();
  showToast('ลบหลักสูตรแล้ว');
}

function setCourseFormMode(mode) {
  document.getElementById('courseSubmitButton').textContent = mode === 'edit'
    ? 'บันทึกการแก้ไข'
    : 'เพิ่มหลักสูตร';
  document.getElementById('cancelCourseEditButton').hidden = mode !== 'edit';
}

function updateFiltersFromForm(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  managerState.filters = {
    keyword: String(values.keyword || '').trim().toLowerCase(),
    courseCode: String(values.courseCode || ''),
    expiryStatus: String(values.expiryStatus || '')
  };
}

function renderHistoryCourseFilter() {
  const select = document.getElementById('historyCourseFilter');
  const currentValue = select.value;
  const codes = Array.from(new Set(managerState.records.map((record) => record.courseCode).filter(Boolean))).sort();

  select.innerHTML = '<option value="">ทุกหลักสูตร</option>' + codes.map((code) => (
    `<option value="${escapeAttr(code)}">${escapeHtml(code)}</option>`
  )).join('');
  select.value = codes.includes(currentValue) ? currentValue : '';
  managerState.filters.courseCode = select.value;
}

function getFilteredRecords() {
  return managerState.records.filter((record) => {
    const expiry = getExpiryState(record);
    const haystack = [
      record.recipientName,
      record.certificateNo,
      record.courseCode,
      record.courseName,
      record.note
    ].join(' ').toLowerCase();

    if (managerState.filters.keyword && !haystack.includes(managerState.filters.keyword)) return false;
    if (managerState.filters.courseCode && record.courseCode !== managerState.filters.courseCode) return false;
    if (managerState.filters.expiryStatus && expiry.kind !== managerState.filters.expiryStatus) return false;
    return true;
  });
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const filteredRecords = getFilteredRecords();

  if (!managerState.records.length) {
    list.innerHTML = `
      <article class="empty-state">
        <strong>ยังไม่มีประวัติ</strong>
        <span>รายการที่สร้างจะถูกบันทึกไว้ใน browser เครื่องนี้</span>
      </article>
    `;
    return;
  }

  if (!filteredRecords.length) {
    list.innerHTML = `
      <article class="empty-state">
        <strong>ไม่พบรายการที่ตรงกับ filter</strong>
        <span>ลองเปลี่ยนคำค้นหา หลักสูตร หรือสถานะอายุใบประกาศ</span>
      </article>
    `;
    return;
  }

  list.innerHTML = filteredRecords.map((record) => {
    const expiry = getExpiryState(record);
    return `
      <article class="history-item" data-id="${escapeAttr(record.id)}">
        <strong>${escapeHtml(record.recipientName)}</strong>
        <span>${escapeHtml(record.certificateNo)} · ${escapeHtml(record.courseCode)} · ${escapeHtml(record.courseName)}</span>
        <span>${escapeHtml(expiry.label)}</span>
        <div class="history-actions">
          <button class="ghost-button renew-button" type="button" data-id="${escapeAttr(record.id)}">ต่ออายุ</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('.renew-button').forEach((button) => {
    button.addEventListener('click', () => renewCertificate(button.dataset.id));
  });
}

function renewCertificate(recordId) {
  const record = managerState.records.find((item) => item.id === recordId);
  if (!record) return;

  const course = getCourseById(managerState.courses, record.courseId) ||
    managerState.courses.find((item) => item.code === record.courseCode);
  const issueDate = formatDateInput(new Date());
  const courseCode = course ? course.code : record.courseCode;
  const renewalDraft = {
    organizationName: record.organizationName || '',
    certificateTitle: record.certificateTitle || 'ใบประกาศนียบัตร',
    recipientName: record.recipientName || '',
    courseId: course ? course.id : record.courseId,
    courseCode,
    issueDate,
    expireDate: course ? calculateExpireDate(issueDate, course) : '',
    design: record.design || null,
    signers: record.signers || [{
      name: record.signerName || '',
      title: record.signerTitle || '',
      signatureDataUrl: record.signatureDataUrl || ''
    }],
    signerName: record.signerName || '',
    signerTitle: record.signerTitle || '',
    logoDataUrl: record.logoDataUrl || '',
    signatureDataUrl: record.signatureDataUrl || '',
    note: `ต่ออายุจากใบประกาศเลขที่ ${record.certificateNo}`,
    renewalOf: record.id,
    previousCertificateNo: record.certificateNo,
    suggestedCertificateNo: makeCertificateNo(managerState.records, null, courseCode, issueDate)
  };

  saveRenewalDraft(renewalDraft);
  window.location.href = '/staff?renew=1';
}
