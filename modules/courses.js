import {
  clean,
  escapeAttr,
  escapeHtml,
  makeId,
  toThaiYear
} from './utils.js';

export const COURSE_STORAGE_KEY = 'niem_certificate_creator_courses_v1';

export const defaultCourses = [
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

export function loadCourses() {
  try {
    const courses = JSON.parse(localStorage.getItem(COURSE_STORAGE_KEY) || '[]');
    if (Array.isArray(courses) && courses.length) return courses;
  } catch (error) {
    // Fall through to defaults.
  }
  return defaultCourses.map((item) => Object.assign({}, item));
}

export function persistCourses(courses) {
  localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(courses));
}

export function buildCourseFromForm(form) {
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

export function upsertCourse(courses, course) {
  const nextCourses = courses.map((item) => Object.assign({}, item));
  const existing = nextCourses.find((item) => item.code === course.code);

  if (existing) {
    existing.name = course.name;
    existing.hours = course.hours;
    existing.validityDays = course.validityDays;
    return { courses: nextCourses, selectedCourseId: existing.id, updated: true };
  }

  nextCourses.push(course);
  return { courses: nextCourses, selectedCourseId: course.id, updated: false };
}

export function removeCourse(courses, courseId) {
  const nextCourses = courses.filter((item) => item.id !== courseId);
  return nextCourses.length ? nextCourses : defaultCourses.map((item) => Object.assign({}, item));
}

export function getCourseById(courses, id) {
  return courses.find((course) => course.id === id) || null;
}

export function getCourseByCode(courses, code) {
  const normalizedCode = normalizeCourseCode(code);
  return courses.find((course) => course.code === normalizedCode) || null;
}

export function getSelectedCourse(courses) {
  return getCourseById(courses, document.getElementById('courseSelect').value);
}

export function normalizeCourseCode(value) {
  const code = String(value || 'NIEM').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return code.slice(0, 12) || 'NIEM';
}

export function makeCertificateNo(records, currentRecordId, courseCode, issueDate) {
  const year = toThaiYear(issueDate);
  const prefix = `CERT-${normalizeCourseCode(courseCode)}-${year}`;
  const next = records
    .filter((record) => record.id !== currentRecordId)
    .filter((record) => String(record.certificateNo || '').startsWith(prefix))
    .length + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export function renderCourses(courses, records, selectedCourseId, onDeleteCourse) {
  const select = document.getElementById('courseSelect');
  const list = document.getElementById('courseList');
  const requestedCourseId = selectedCourseId || select.value;
  const activeCourseId = getCourseById(courses, requestedCourseId)
    ? requestedCourseId
    : (courses[0] && courses[0].id);

  select.innerHTML = courses.map((course) => `
    <option value="${escapeAttr(course.id)}">${escapeHtml(course.code)} - ${escapeHtml(course.name)}</option>
  `).join('');
  select.value = activeCourseId || '';

  document.getElementById('courseCount').textContent = `${courses.length} รายการ`;
  list.innerHTML = courses.map((course) => {
    const usedCount = records.filter((record) => record.courseId === course.id || record.courseCode === course.code).length;
    const usedLabel = usedCount ? ` · ใช้แล้ว ${usedCount} ใบ` : '';

    return `
      <article class="course-item">
        <div>
          <strong>${escapeHtml(course.code)} - ${escapeHtml(course.name)}</strong>
          <span>${escapeHtml(course.hours || '0')} ชั่วโมง · อายุใบประกาศ ${escapeHtml(course.validityDays || '0')} วัน${escapeHtml(usedLabel)}</span>
        </div>
        <button class="delete-course-button" type="button" data-course-id="${escapeAttr(course.id)}">ลบ</button>
      </article>
    `;
  }).join('');

  list.querySelectorAll('.delete-course-button').forEach((button) => {
    button.addEventListener('click', () => onDeleteCourse(button.dataset.courseId));
  });
}

export function renderSelectedCourseSummary(course, nextCertificateNo) {
  const summary = document.getElementById('selectedCourseSummary');
  if (!course) {
    summary.textContent = 'ยังไม่มีหลักสูตร';
    return;
  }

  summary.textContent = `รหัส ${course.code} · ${course.hours || 0} ชั่วโมง · อายุ ${course.validityDays || 0} วัน · เลขถัดไป ${nextCertificateNo}`;
}
