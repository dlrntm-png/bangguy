function escapeValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(rows, columns) {
  const header = columns.map((col) => col.header || col.key).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = typeof col.value === 'function' ? col.value(row) : row[col.key];
        return escapeValue(value);
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

