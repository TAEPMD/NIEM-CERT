import {
  buildCourseFromForm,
  loadCourses,
  persistCourses,
  removeCourse,
  renderCourseManager,
  upsertCourse,
  getCourseById
} from './modules/courses.js';
import {
  getExpiryState,
  renderExpiryAlerts
} from './modules/expiry.js';
import {
  clearRecords,
  loadRecords
} from './modules/records.js';
import {
  escapeAttr,
  escapeHtml,
  showToast
} from './modules/utils.js';

const managerState = {
  records: [],
  courses: []
};

document.addEventListener('DOMContentLoaded', () => {
  const courseForm = document.getElementById('courseForm');

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
      courseForm.hours.value = '6';
      courseForm.validityDays.value = '730';
      renderAll();
      showToast(result.updated ? 'ปรับปรุงหลักสูตรเรียบร้อย' : 'เพิ่มหลักสูตรเรียบร้อย');
    } catch (error) {
      showToast(error.message || 'เพิ่มหลักสูตรไม่สำเร็จ');
    }
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
  renderCourseManager(managerState.courses, managerState.records, deleteCourse);
  renderExpiryAlerts(managerState.records);
  renderHistory();
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

function renderHistory() {
  const list = document.getElementById('historyList');

  if (!managerState.records.length) {
    list.innerHTML = `
      <article class="empty-state">
        <strong>ยังไม่มีประวัติ</strong>
        <span>รายการที่สร้างจะถูกบันทึกไว้ใน browser เครื่องนี้</span>
      </article>
    `;
    return;
  }

  list.innerHTML = managerState.records.map((record) => {
    const expiry = getExpiryState(record);
    return `
      <article class="history-item" data-id="${escapeAttr(record.id)}">
        <strong>${escapeHtml(record.recipientName)}</strong>
        <span>${escapeHtml(record.certificateNo)} · ${escapeHtml(record.courseCode)} · ${escapeHtml(record.courseName)}</span>
        <span>${escapeHtml(expiry.label)}</span>
      </article>
    `;
  }).join('');
}
