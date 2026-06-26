import {
  escapeHtml,
  formatDateInput,
  parseDateInput,
  startOfDay,
  toThaiDate
} from './utils.js';

export const EXPIRY_WARNING_DAYS = 30;

export function getValidityDays(course) {
  const value = Number(course && (course.validityValue || course.validityDays || 0));
  const unit = String(course && (course.validityUnit || 'day'));
  if (!value) return 0;
  return unit === 'year' ? value * 365 : value;
}

export function formatValidity(course) {
  const unit = String(course && (course.validityUnit || 'day'));
  const value = course && course.validityValue
    ? course.validityValue
    : course && course.validityDays
      ? course.validityDays
      : '0';
  return unit === 'year' ? `${value} ปี` : `${value} วัน`;
}

export function calculateExpireDate(issueDate, validity) {
  const validityDays = typeof validity === 'object' ? getValidityDays(validity) : Number(validity || 0);
  if (!validityDays) return '';
  const date = issueDate ? parseDateInput(issueDate) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + validityDays);
  return formatDateInput(date);
}

export function getExpiryState(record) {
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

export function renderExpiryAlerts(records, onRenew) {
  const active = records.filter((r) => !r.archived);
  const alerts = active
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
      <div class="expiry-info">
        <strong>${escapeHtml(record.recipientName)} · ${escapeHtml(record.certificateNo)}</strong>
        <span>${escapeHtml(record.courseCode)} - ${escapeHtml(record.courseName)}</span>
        <span>${escapeHtml(expiry.label)}</span>
      </div>
      ${onRenew ? `<button class="expiry-renew-button" type="button" data-renew-id="${escapeHtml(record.id)}">ต่ออายุ</button>` : ''}
    </article>
  `).join('');

  if (onRenew) {
    container.querySelectorAll('.expiry-renew-button').forEach((button) => {
      button.addEventListener('click', () => onRenew(button.dataset.renewId));
    });
  }
}
