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
  persistRecords,
  removeRecord,
  saveRenewalDraft,
  toggleArchiveRecord
} from './modules/records.js';
import {
  escapeAttr,
  escapeHtml,
  formatDateInput,
  parseDateInput,
  showToast
} from './modules/utils.js';

const managerState = {
  records: [],
  courses: [],
  showArchived: false,
  filters: {
    keyword: '',
    courseCode: '',
    expiryStatus: '',
    issueFrom: '',
    issueTo: ''
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

  document.getElementById('exportHistoryButton').addEventListener('click', exportFilteredHistory);

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

  document.getElementById('toggleArchivedButton').addEventListener('click', () => {
    managerState.showArchived = !managerState.showArchived;
    document.getElementById('toggleArchivedButton').textContent = managerState.showArchived
      ? 'ซ่อน archived'
      : 'แสดง archived';
    renderHistory();
  });

  const editDialog = document.getElementById('editRecordDialog');
  const editForm = document.getElementById('editRecordForm');

  document.getElementById('editRecordCloseButton').addEventListener('click', () => editDialog.close());
  document.getElementById('editRecordCancelButton').addEventListener('click', () => editDialog.close());

  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(editForm).entries());
    const idx = managerState.records.findIndex((r) => r.id === values.id);
    if (idx < 0) return;
    managerState.records[idx] = {
      ...managerState.records[idx],
      recipientName: values.recipientName.trim(),
      certificateNo: values.certificateNo.trim(),
      courseCode: values.courseCode.trim(),
      courseName: values.courseName.trim(),
      issueDate: values.issueDate,
      expireDate: values.expireDate,
      note: values.note.trim()
    };
    persistRecords(managerState.records);
    editDialog.close();
    renderAll();
    showToast('บันทึกการแก้ไขเรียบร้อย');
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
  renderDashboard();
  renderCourseManager(managerState.courses, managerState.records, editCourse, deleteCourse);
  renderExpiryAlerts(managerState.records);
  renderHistoryCourseFilter();
  renderHistory();
}

function renderDashboard() {
  const stats = getDashboardStats();
  setText('totalCertificates', String(stats.total));
  setText('validCertificates', String(stats.valid));
  setText('warningCertificates', String(stats.warning));
  setText('expiredCertificates', String(stats.expired));
  setText('courseTotal', String(managerState.courses.length));
  setText('latestIssuedAt', stats.latestIssuedAt ? `ออกล่าสุด ${stats.latestIssuedAt}` : 'ยังไม่มีข้อมูล');
}

function getDashboardStats() {
  const stats = {
    total: managerState.records.length,
    valid: 0,
    warning: 0,
    expired: 0,
    latestIssuedAt: ''
  };
  let latestIssueDate = null;

  managerState.records.forEach((record) => {
    if (record.archived) return;
    const expiry = getExpiryState(record);
    if (expiry.kind === 'valid') stats.valid += 1;
    if (expiry.kind === 'warning') stats.warning += 1;
    if (expiry.kind === 'expired') stats.expired += 1;

    const issueDate = parseDateInput(record.issueDate);
    if (!Number.isNaN(issueDate.getTime()) && (!latestIssueDate || issueDate > latestIssueDate)) {
      latestIssueDate = issueDate;
    }
  });

  if (latestIssueDate) {
    stats.latestIssuedAt = latestIssueDate.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  return stats;
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
    expiryStatus: String(values.expiryStatus || ''),
    issueFrom: String(values.issueFrom || ''),
    issueTo: String(values.issueTo || '')
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
    if (record.archived && !managerState.showArchived) return false;
    if (!record.archived && managerState.showArchived) return false;
    const expiry = getExpiryState(record);
    const haystack = [
      record.recipientName,
      record.certificateNo,
      record.courseCode,
      record.courseName,
      record.note
    ].join(' ').toLowerCase();
    const issueDate = parseDateInput(record.issueDate);
    const issueFrom = managerState.filters.issueFrom ? parseDateInput(managerState.filters.issueFrom) : null;
    const issueTo = managerState.filters.issueTo ? parseDateInput(managerState.filters.issueTo) : null;

    if (managerState.filters.keyword && !haystack.includes(managerState.filters.keyword)) return false;
    if (managerState.filters.courseCode && record.courseCode !== managerState.filters.courseCode) return false;
    if (managerState.filters.expiryStatus && expiry.kind !== managerState.filters.expiryStatus) return false;
    if (issueFrom && !Number.isNaN(issueFrom.getTime())) {
      if (Number.isNaN(issueDate.getTime()) || issueDate < issueFrom) return false;
    }
    if (issueTo && !Number.isNaN(issueTo.getTime())) {
      if (Number.isNaN(issueDate.getTime()) || issueDate > issueTo) return false;
    }
    return true;
  });
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const filteredRecords = getFilteredRecords();
  setText('historyResultCount', `${filteredRecords.length} / ${managerState.records.length} รายการ`);

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
    const isArchived = record.archived === true;
    return `
      <article class="history-item${isArchived ? ' is-archived' : ''}" data-id="${escapeAttr(record.id)}">
        <strong>${escapeHtml(record.recipientName)}${isArchived ? ' <span class="archived-badge">archived</span>' : ''}</strong>
        <span>${escapeHtml(record.certificateNo)} · ${escapeHtml(record.courseCode)} · ${escapeHtml(record.courseName)}</span>
        <span>ออกวันที่ ${escapeHtml(formatDisplayDate(record.issueDate))} · หมดอายุ ${escapeHtml(formatDisplayDate(record.expireDate))}</span>
        <span>${escapeHtml(expiry.label)}</span>
        <div class="history-actions">
          ${isArchived ? '' : `<button class="ghost-button renew-button" type="button" data-id="${escapeAttr(record.id)}">ต่ออายุ</button>`}
          <button class="edit-record-button" type="button" data-id="${escapeAttr(record.id)}">แก้ไข</button>
          <button class="archive-record-button" type="button" data-id="${escapeAttr(record.id)}">${isArchived ? 'ยกเลิก archive' : 'Archive'}</button>
          <button class="delete-record-button" type="button" data-id="${escapeAttr(record.id)}">ลบ</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('.renew-button').forEach((button) => {
    button.addEventListener('click', () => renewCertificate(button.dataset.id));
  });
  list.querySelectorAll('.edit-record-button').forEach((button) => {
    button.addEventListener('click', () => editRecord(button.dataset.id));
  });
  list.querySelectorAll('.archive-record-button').forEach((button) => {
    button.addEventListener('click', () => archiveRecord(button.dataset.id));
  });
  list.querySelectorAll('.delete-record-button').forEach((button) => {
    button.addEventListener('click', () => deleteRecord(button.dataset.id));
  });
}

function editRecord(recordId) {
  const record = managerState.records.find((item) => item.id === recordId);
  if (!record) return;
  const dialog = document.getElementById('editRecordDialog');
  const form = document.getElementById('editRecordForm');
  form.elements.id.value = record.id;
  form.elements.recipientName.value = record.recipientName || '';
  form.elements.certificateNo.value = record.certificateNo || '';
  form.elements.courseCode.value = record.courseCode || '';
  form.elements.courseName.value = record.courseName || '';
  form.elements.issueDate.value = record.issueDate || '';
  form.elements.expireDate.value = record.expireDate || '';
  form.elements.note.value = record.note || '';
  dialog.showModal();
}

function deleteRecord(recordId) {
  const record = managerState.records.find((item) => item.id === recordId);
  if (!record) return;
  if (!confirm(`ยืนยันการลบใบประกาศเลขที่ ${record.certificateNo} ของ ${record.recipientName}?`)) return;
  managerState.records = removeRecord(managerState.records, recordId);
  persistRecords(managerState.records);
  renderAll();
  showToast('ลบใบประกาศแล้ว');
}

function archiveRecord(recordId) {
  const record = managerState.records.find((item) => item.id === recordId);
  if (!record) return;
  managerState.records = toggleArchiveRecord(managerState.records, recordId);
  persistRecords(managerState.records);
  renderAll();
  showToast(record.archived ? 'นำออกจาก archived แล้ว' : 'เก็บ archived แล้ว');
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

function exportFilteredHistory() {
  const rows = getFilteredRecords();
  if (!rows.length) {
    showToast('ไม่มีข้อมูลสำหรับ export');
    return;
  }

  const headers = [
    'certificateNo',
    'recipientName',
    'courseCode',
    'courseName',
    'issueDate',
    'expireDate',
    'expiryStatus',
    'note'
  ];
  const csvRows = [
    headers.join(','),
    ...rows.map((record) => {
      const expiry = getExpiryState(record);
      return [
        record.certificateNo,
        record.recipientName,
        record.courseCode,
        record.courseName,
        record.issueDate,
        record.expireDate,
        expiry.kind,
        record.note
      ].map(csvCell).join(',');
    })
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificate-history-${formatDateInput(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`Export ${rows.length} รายการเรียบร้อย`);
}

function csvCell(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function formatDisplayDate(value) {
  if (!value) return '-';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}
