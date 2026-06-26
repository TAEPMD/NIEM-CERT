export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuote && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (char === ',' && !insideQuote) {
      row.push(value.trim());
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuote) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function csvRowsToRecipients(rows) {
  if (!rows.length) return [];

  rows[0][0] = String(rows[0][0] || '').replace(/^\uFEFF/, '');
  const firstRow = rows[0].map((cell) => cell.toLowerCase());
  const hasHeader = firstRow.some((cell) => ['recipientname', 'recipient_name', 'name', 'ชื่อ', 'ชื่อผู้รับ'].includes(cell));
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const nameIndex = hasHeader
    ? firstRow.findIndex((cell) => ['recipientname', 'recipient_name', 'name', 'ชื่อ', 'ชื่อผู้รับ'].includes(cell))
    : 0;
  const noteIndex = hasHeader
    ? firstRow.findIndex((cell) => ['note', 'หมายเหตุ'].includes(cell))
    : 1;

  return bodyRows
    .map((row) => ({
      recipientName: String(row[nameIndex] || '').trim(),
      note: noteIndex >= 0 ? String(row[noteIndex] || '').trim() : ''
    }))
    .filter((item) => item.recipientName);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsText(file, 'utf-8');
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}
