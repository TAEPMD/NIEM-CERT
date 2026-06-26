export function clean(value) {
  return String(value || '').trim();
}

export function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function parseDateInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toThaiYear(value) {
  const date = value ? parseDateInput(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().getFullYear() + 543;
  return date.getFullYear() + 543;
}

export function toThaiDate(value) {
  if (!value) return '-';
  const date = parseDateInput(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function setText(id, value) {
  document.getElementById(id).textContent = value || '';
}

export function showToast(message) {
  const toast = document.getElementById('publicToast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
