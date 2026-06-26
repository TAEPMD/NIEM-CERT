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
  csvRowsToRecipients,
  parseCsv,
  readFileAsDataUrl,
  readFileAsText
} from './modules/csv.js';
import {
  calculateExpireDate
} from './modules/expiry.js';
import {
  loadRecords,
  persistRecords,
  takeRenewalDraft,
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
  current: null,
  logoDataUrl: '',
  signers: [
    { id: makeId(), name: '', title: '', signatureDataUrl: '' }
  ],
  bulkRecipients: []
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');

  verifyStaffSession();
  creatorState.records = loadRecords();
  creatorState.courses = loadCourses();
  form.issueDate.value = formatDateInput(new Date());

  renderCourseModule();
  applySelectedCourseDefaults(true);
  renderSignerInputs();
  loadRenewalDraftIfPresent();

  form.addEventListener('input', (event) => {
    if (event.target.dataset.signerField) return;
    if (event.target.name === 'issueDate' || event.target.name === 'courseId') {
      refreshPreview({ recalculateExpireDate: event.target.name === 'issueDate' });
      return;
    }
    refreshPreview();
  });

  form.addEventListener('change', (event) => {
    if (event.target.dataset.signerField) return;
    if (event.target.name === 'courseId' || event.target.name === 'issueDate') {
      refreshPreview({ recalculateExpireDate: true });
      return;
    }
    refreshPreview();
  });

  document.getElementById('logoInput').addEventListener('change', async (event) => {
    creatorState.logoDataUrl = await readSelectedImage(event.target.files[0]);
    refreshPreview();
  });

  document.getElementById('bulkCsvInput').addEventListener('change', async (event) => {
    await loadBulkCsv(event.target.files[0]);
  });

  document.getElementById('bulkPreviewList').addEventListener('click', (event) => {
    const item = event.target.closest('.bulk-preview-item');
    if (!item) return;
    applyBulkRecipientToForm(Number(item.dataset.bulkIndex || 0));
  });

  document.getElementById('bulkCreateButton').addEventListener('click', () => {
    createBulkCertificates();
  });

  document.getElementById('downloadCsvTemplateButton').addEventListener('click', () => {
    downloadCsvTemplate();
  });

  document.getElementById('addSignerButton').addEventListener('click', () => {
    creatorState.signers.push({ id: makeId(), name: '', title: '', signatureDataUrl: '' });
    renderSignerInputs();
    refreshPreview();
  });

  document.getElementById('signerList').addEventListener('input', (event) => {
    const field = event.target.dataset.signerField;
    if (!field) return;
    const signer = getSignerById(event.target.dataset.signerId);
    if (!signer) return;
    signer[field] = event.target.value;
    refreshPreview();
  });

  document.getElementById('signerList').addEventListener('change', async (event) => {
    if (event.target.dataset.signerField !== 'signatureDataUrl') return;
    const signer = getSignerById(event.target.dataset.signerId);
    if (!signer) return;
    signer.signatureDataUrl = await readSelectedImage(event.target.files[0]);
    refreshPreview();
  });

  document.getElementById('signerList').addEventListener('click', (event) => {
    const button = event.target.closest('.remove-signer-button');
    if (!button) return;
    if (creatorState.signers.length === 1) {
      creatorState.signers = [{ id: makeId(), name: '', title: '', signatureDataUrl: '' }];
    } else {
      creatorState.signers = creatorState.signers.filter((signer) => signer.id !== button.dataset.signerId);
    }
    renderSignerInputs();
    refreshPreview();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const record = buildRecordFromForm(true);
    saveRecord(record);
    creatorState.current = record;
    clearBulkPrintPages();
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

  refreshPreview();
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
  const signers = normalizeSigners(creatorState.signers);
  const primarySigner = signers[0] || { name: '', title: '', signatureDataUrl: '' };
  const design = buildDesignFromValues(values);

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
    signers,
    signerName: primarySigner.name || 'ผู้ลงนาม',
    signerTitle: primarySigner.title || 'ตำแหน่ง',
    note: clean(values.note),
    design,
    logoDataUrl: creatorState.logoDataUrl || (creatorState.current && creatorState.current.logoDataUrl) || '',
    signatureDataUrl: primarySigner.signatureDataUrl || '',
    renewalOf: (creatorState.current && creatorState.current.renewalOf) || '',
    previousCertificateNo: (creatorState.current && creatorState.current.previousCertificateNo) || '',
    createdAt: (creatorState.current && creatorState.current.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function saveRecord(record) {
  let records = upsertRecord(creatorState.records, record);
  if (record.renewalOf) {
    records = records.map((r) =>
      r.id === record.renewalOf ? { ...r, archived: true } : r
    );
  }
  creatorState.records = records;
  persistRecords(creatorState.records);
}

function saveRecords(records) {
  records.forEach((record) => {
    creatorState.records = upsertRecord(creatorState.records, record);
  });
  persistRecords(creatorState.records);
}

function renderCourseModule(selectedCourseId) {
  renderCourseSelector(creatorState.courses, selectedCourseId);
  renderSelectedCourseSummary(getSelectedCourse(creatorState.courses), getNextCertificateNoForSelectedCourse());
}

function refreshPreview(options) {
  const settings = Object.assign({ recalculateExpireDate: false }, options || {});
  if (settings.recalculateExpireDate) {
    applySelectedCourseDefaults(true);
  } else {
    renderSelectedCourseSummary(getSelectedCourse(creatorState.courses), getNextCertificateNoForSelectedCourse());
  }
  clearBulkPrintPages();
  creatorState.current = buildRecordFromForm(false);
  renderPreview(creatorState.current);
  if (creatorState.bulkRecipients.length) {
    renderBulkPrintPages(buildBulkCertificateRecords(false), 'preview');
  }
}

function renderPreview(record) {
  applyCertificateDesign(document.getElementById('certificatePreview'), record.design);
  setText('previewCertNo', record.certificateNo);
  setText('previewCertNoFooter', record.certificateNo);
  setText('previewIssueDate', 'วันที่ออก ' + toThaiDate(record.issueDate));
  setText('previewOrganization', record.organizationName);
  setText('previewTitle', record.certificateTitle);
  setText('previewLeadText', getDesignValue(record.design, 'leadText'));
  setText('previewRecipient', record.recipientName);
  setText('previewCompletionText', getDesignValue(record.design, 'completionText'));
  setText('previewCourse', record.courseName);
  setText('previewHours', record.hours ? `จำนวน ${record.hours} ชั่วโมง` : '');
  setText('previewNote', record.note);
  setText('previewExpireDate', record.expireDate ? toThaiDate(record.expireDate) : '-');
  renderPreviewImage('previewLogo', record.logoDataUrl);
  renderPreviewSigners(record.signers || legacySignersFromRecord(record));
}

function resetCertificateForm() {
  const form = document.getElementById('certificateForm');
  creatorState.current = null;
  clearBulkPrintPages();
  form.reset();
  form.organizationName.value = 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ';
  form.certificateTitle.value = 'ใบประกาศนียบัตร';
  form.issueDate.value = formatDateInput(new Date());
  resetDesignControls(form);
  document.getElementById('logoInput').value = '';
  creatorState.logoDataUrl = '';
  creatorState.signers = [{ id: makeId(), name: '', title: '', signatureDataUrl: '' }];
  renderSignerInputs();
  if (creatorState.courses[0]) form.courseId.value = creatorState.courses[0].id;
  renderCourseModule(form.courseId.value);
  refreshPreview({ recalculateExpireDate: true });
}

function applySelectedCourseDefaults(forceExpireDate) {
  const form = document.getElementById('certificateForm');
  const course = getSelectedCourse(creatorState.courses);
  if (!course) return;

  if (forceExpireDate || !form.expireDate.value) {
    form.expireDate.value = calculateExpireDate(form.issueDate.value, course);
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

function loadRenewalDraftIfPresent() {
  const draft = takeRenewalDraft();
  if (!draft) return;

  const form = document.getElementById('certificateForm');
  const course = getCourseById(creatorState.courses, draft.courseId) ||
    creatorState.courses.find((item) => item.code === draft.courseCode);

  form.organizationName.value = draft.organizationName || form.organizationName.value;
  form.certificateTitle.value = draft.certificateTitle || form.certificateTitle.value;
  form.recipientName.value = draft.recipientName || '';
  if (course) form.courseId.value = course.id;
  form.issueDate.value = draft.issueDate || formatDateInput(new Date());
  form.expireDate.value = draft.expireDate || '';
  form.note.value = draft.note || '';
  applyDesignToForm(form, draft.design);
  creatorState.logoDataUrl = draft.logoDataUrl || '';
  creatorState.signers = normalizeSigners(draft.signers || legacySignersFromRecord(draft));
  renderSignerInputs();

  creatorState.current = {
    id: makeId(),
    renewalOf: draft.renewalOf || '',
    previousCertificateNo: draft.previousCertificateNo || ''
  };
  renderCourseModule(form.courseId.value);
  refreshPreview({ recalculateExpireDate: !form.expireDate.value });
  showToast('เตรียมข้อมูลต่ออายุแล้ว กรุณาตรวจสอบและกดสร้างใบประกาศ');
}

async function readSelectedImage(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพ');
    return '';
  }
  return readFileAsDataUrl(file);
}

async function loadBulkCsv(file) {
  if (!file) {
    creatorState.bulkRecipients = [];
    renderBulkPreview();
    return;
  }

  try {
    const text = await readFileAsText(file);
    creatorState.bulkRecipients = csvRowsToRecipients(parseCsv(text));
    renderBulkPreview();
    applyBulkRecipientToForm(0);
    showToast(`อ่านรายชื่อจาก CSV ${creatorState.bulkRecipients.length} รายการ`);
  } catch (error) {
    creatorState.bulkRecipients = [];
    renderBulkPreview();
    showToast(error.message || 'อ่านไฟล์ CSV ไม่สำเร็จ');
  }
}

function renderBulkPreview() {
  const list = document.getElementById('bulkPreviewList');
  const count = creatorState.bulkRecipients.length;
  document.getElementById('bulkCount').textContent = `${count} รายการ`;
  document.getElementById('bulkCreateButton').disabled = count === 0;

  if (!count) {
    list.innerHTML = '';
    clearBulkPrintPages();
    return;
  }

  list.innerHTML = creatorState.bulkRecipients.slice(0, 8).map((item, index) => `
    <button class="bulk-preview-item" type="button" data-bulk-index="${index}">
      <strong>${index + 1}. ${escapeText(item.recipientName)}</strong>
      <span>${escapeText(item.note || '')}</span>
    </button>
  `).join('') + (count > 8 ? `<div class="bulk-preview-more">และอีก ${count - 8} รายการ</div>` : '');
}

function applyBulkRecipientToForm(index) {
  const recipient = creatorState.bulkRecipients[index];
  if (!recipient) return;

  const form = document.getElementById('certificateForm');
  form.elements.recipientName.value = recipient.recipientName;
  if (recipient.note && !clean(form.elements.note.value)) {
    form.elements.note.value = recipient.note;
  }
  refreshPreview();
}

function createBulkCertificates() {
  if (!creatorState.bulkRecipients.length) return;

  const recordsToCreate = buildBulkCertificateRecords(true);
  saveRecords(recordsToCreate);
  creatorState.current = recordsToCreate[0];
  renderPreview(creatorState.current);
  renderBulkPrintPages(recordsToCreate, 'print');
  renderCourseModule(creatorState.current.courseId);
  showToast(`สร้างใบประกาศแบบ Bulk ${recordsToCreate.length} รายการเรียบร้อย`);
}

function buildBulkCertificateRecords(finalize) {
  const baseRecord = buildRecordFromForm(false);
  const recordsToCreate = [];
  let draftRecords = creatorState.records.slice();

  creatorState.bulkRecipients.forEach((recipient) => {
    const record = Object.assign({}, baseRecord, {
      id: makeId(),
      recipientName: recipient.recipientName,
      note: recipient.note || baseRecord.note,
      certificateNo: makeCertificateNo(draftRecords, null, baseRecord.courseCode, baseRecord.issueDate),
      createdAt: finalize ? new Date().toISOString() : baseRecord.createdAt,
      updatedAt: new Date().toISOString(),
      renewalOf: '',
      previousCertificateNo: ''
    });
    recordsToCreate.push(record);
    draftRecords.unshift(record);
  });

  return recordsToCreate;
}

function downloadCsvTemplate() {
  const csv = '\uFEFFrecipientName,note\nสมชาย ใจดี,รุ่นที่ 1\nสมหญิง ตั้งใจ,รุ่นที่ 1\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'certificate-recipients-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderPreviewImage(id, dataUrl) {
  const image = document.getElementById(id);
  if (!dataUrl) {
    image.hidden = true;
    image.removeAttribute('src');
    return;
  }
  image.src = dataUrl;
  image.hidden = false;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function renderBulkPrintPages(records, mode) {
  const container = document.getElementById('bulkPrintPages');
  container.innerHTML = records.map((record) => `
    <article class="certificate-page" style="${getCertificateStyleAttr(record.design)}">
      <div class="certificate-border">
        <div class="certificate-topline">
          <span>${escapeText(record.certificateNo)}</span>
          <span>วันที่ออก ${escapeText(toThaiDate(record.issueDate))}</span>
        </div>
        <div class="certificate-body">
          ${record.logoDataUrl ? `<img class="certificate-logo" src="${record.logoDataUrl}" alt="">` : ''}
          <p class="certificate-org">${escapeText(record.organizationName)}</p>
          <h2>${escapeText(record.certificateTitle)}</h2>
          <p class="certificate-lead">${escapeText(getDesignValue(record.design, 'leadText'))}</p>
          <h3>${escapeText(record.recipientName)}</h3>
          <p class="certificate-copy">${escapeText(getDesignValue(record.design, 'completionText'))}</p>
          <h4>${escapeText(record.courseName)}</h4>
          <p class="certificate-meta">${record.hours ? `จำนวน ${escapeText(record.hours)} ชั่วโมง` : ''}</p>
          <p class="certificate-note">${escapeText(record.note)}</p>
        </div>
        <div class="certificate-footer">
          <div>
            <span>เลขที่ใบประกาศ</span>
            <strong>${escapeText(record.certificateNo)}</strong>
          </div>
          <div class="signature-grid">${renderSignersHtml(record.signers || legacySignersFromRecord(record))}</div>
          <div>
            <span>วันหมดอายุ</span>
            <strong>${record.expireDate ? escapeText(toThaiDate(record.expireDate)) : '-'}</strong>
          </div>
        </div>
      </div>
    </article>
  `).join('');
  document.body.classList.toggle('has-bulk-print', mode === 'print');
  document.body.classList.toggle('has-bulk-preview', mode !== 'print');
}

function clearBulkPrintPages() {
  document.getElementById('bulkPrintPages').innerHTML = '';
  document.body.classList.remove('has-bulk-print');
  document.body.classList.remove('has-bulk-preview');
}

function renderSignerInputs() {
  const list = document.getElementById('signerList');
  list.innerHTML = creatorState.signers.map((signer, index) => `
    <article class="signer-item">
      <div class="section-heading tight">
        <h3>ผู้ลงนาม ${index + 1}</h3>
        <button class="link-button remove-signer-button" type="button" data-signer-id="${signer.id}">ลบ</button>
      </div>
      <label>
        ชื่อผู้ลงนาม
        <input type="text" data-signer-id="${signer.id}" data-signer-field="name" value="${escapeAttr(signer.name)}" placeholder="ชื่อผู้ลงนาม">
      </label>
      <label>
        ตำแหน่ง
        <input type="text" data-signer-id="${signer.id}" data-signer-field="title" value="${escapeAttr(signer.title)}" placeholder="ตำแหน่ง">
      </label>
      <label>
        ลายเซ็นดิจิตอล
        <input type="file" accept="image/*" data-signer-id="${signer.id}" data-signer-field="signatureDataUrl">
      </label>
    </article>
  `).join('');
}

function renderPreviewSigners(signers) {
  document.getElementById('previewSigners').innerHTML = renderSignersHtml(signers);
}

function renderSignersHtml(signers) {
  const normalized = normalizeSigners(signers);
  return normalized.map((signer) => `
    <div class="signature-block">
      ${signer.signatureDataUrl ? `<img class="signature-image" src="${signer.signatureDataUrl}" alt="">` : ''}
      <div class="signature-line"></div>
      <strong>${escapeText(signer.name || 'ผู้ลงนาม')}</strong>
      <span>${escapeText(signer.title || 'ตำแหน่ง')}</span>
    </div>
  `).join('');
}

function normalizeSigners(signers) {
  const normalized = (Array.isArray(signers) ? signers : [])
    .map((signer) => ({
      id: signer.id || makeId(),
      name: clean(signer.name),
      title: clean(signer.title),
      signatureDataUrl: signer.signatureDataUrl || ''
    }))
    .filter((signer) => signer.name || signer.title || signer.signatureDataUrl);

  return normalized.length
    ? normalized
    : [{ id: makeId(), name: '', title: '', signatureDataUrl: '' }];
}

function legacySignersFromRecord(record) {
  return [{
    id: makeId(),
    name: record.signerName || '',
    title: record.signerTitle || '',
    signatureDataUrl: record.signatureDataUrl || ''
  }];
}

function getSignerById(id) {
  return creatorState.signers.find((signer) => signer.id === id) || null;
}

function escapeAttr(value) {
  return escapeText(value).replace(/`/g, '&#096;');
}

function buildDesignFromValues(values) {
  return {
    primaryColor: normalizeColor(values.primaryColor, '#0d3b78'),
    accentColor: normalizeColor(values.accentColor, '#0fafa3'),
    borderColor: normalizeColor(values.borderColor, '#0d3b78'),
    borderStyle: ['double', 'solid', 'dashed'].includes(values.borderStyle) ? values.borderStyle : 'double',
    fontScale: clampNumber(values.fontScale, 85, 115, 100),
    logoSize: clampNumber(values.logoSize, 56, 140, 92),
    leadText: clean(values.leadText) || 'ขอมอบใบประกาศฉบับนี้ให้แก่',
    completionText: clean(values.completionText) || 'เพื่อแสดงว่าได้ผ่านการเข้าร่วม / สำเร็จหลักสูตร'
  };
}

function applyCertificateDesign(element, design) {
  if (!element) return;
  element.style.setProperty('--cert-primary', getDesignValue(design, 'primaryColor'));
  element.style.setProperty('--cert-accent', getDesignValue(design, 'accentColor'));
  element.style.setProperty('--cert-border-color', getDesignValue(design, 'borderColor'));
  element.style.setProperty('--cert-border-style', getDesignValue(design, 'borderStyle'));
  element.style.setProperty('--cert-font-scale', String(getDesignValue(design, 'fontScale') / 100));
  element.style.setProperty('--cert-logo-size', getDesignValue(design, 'logoSize') + 'px');
}

function getCertificateStyleAttr(design) {
  return [
    `--cert-primary:${escapeText(getDesignValue(design, 'primaryColor'))}`,
    `--cert-accent:${escapeText(getDesignValue(design, 'accentColor'))}`,
    `--cert-border-color:${escapeText(getDesignValue(design, 'borderColor'))}`,
    `--cert-border-style:${escapeText(getDesignValue(design, 'borderStyle'))}`,
    `--cert-font-scale:${getDesignValue(design, 'fontScale') / 100}`,
    `--cert-logo-size:${getDesignValue(design, 'logoSize')}px`
  ].join(';');
}

function getDesignValue(design, key) {
  const defaults = {
    primaryColor: '#0d3b78',
    accentColor: '#0fafa3',
    borderColor: '#0d3b78',
    borderStyle: 'double',
    fontScale: 100,
    logoSize: 92,
    leadText: 'ขอมอบใบประกาศฉบับนี้ให้แก่',
    completionText: 'เพื่อแสดงว่าได้ผ่านการเข้าร่วม / สำเร็จหลักสูตร'
  };
  return design && design[key] ? design[key] : defaults[key];
}

function applyDesignToForm(form, design) {
  if (!design) return;
  form.elements.primaryColor.value = getDesignValue(design, 'primaryColor');
  form.elements.accentColor.value = getDesignValue(design, 'accentColor');
  form.elements.borderColor.value = getDesignValue(design, 'borderColor');
  form.elements.borderStyle.value = getDesignValue(design, 'borderStyle');
  form.elements.fontScale.value = getDesignValue(design, 'fontScale');
  form.elements.logoSize.value = getDesignValue(design, 'logoSize');
  form.elements.leadText.value = getDesignValue(design, 'leadText');
  form.elements.completionText.value = getDesignValue(design, 'completionText');
}

function resetDesignControls(form) {
  applyDesignToForm(form, {});
}

function normalizeColor(value, fallback) {
  const color = String(value || '');
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
