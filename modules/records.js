export const RECORD_STORAGE_KEY = 'niem_certificate_creator_records_v2';
export const RENEWAL_DRAFT_STORAGE_KEY = 'niem_certificate_creator_renewal_draft_v1';

export function loadRecords() {
  try {
    const modern = JSON.parse(localStorage.getItem(RECORD_STORAGE_KEY) || '[]');
    if (Array.isArray(modern) && modern.length) return modern;

    const legacy = JSON.parse(localStorage.getItem('niem_certificate_creator_records_v1') || '[]');
    return Array.isArray(legacy) ? legacy : [];
  } catch (error) {
    return [];
  }
}

export function persistRecords(records) {
  localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
}

export function clearRecords() {
  localStorage.removeItem(RECORD_STORAGE_KEY);
}

export function upsertRecord(records, record) {
  const nextRecords = records.slice();
  const existingIndex = nextRecords.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    nextRecords[existingIndex] = record;
  } else {
    nextRecords.unshift(record);
  }

  return nextRecords.slice(0, 500);
}

export function saveRenewalDraft(record) {
  sessionStorage.setItem(RENEWAL_DRAFT_STORAGE_KEY, JSON.stringify(record));
}

export function takeRenewalDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(RENEWAL_DRAFT_STORAGE_KEY) || 'null');
    sessionStorage.removeItem(RENEWAL_DRAFT_STORAGE_KEY);
    return draft;
  } catch (error) {
    sessionStorage.removeItem(RENEWAL_DRAFT_STORAGE_KEY);
    return null;
  }
}
