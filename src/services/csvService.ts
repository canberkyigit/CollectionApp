export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCsv {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const flushValue = () => {
    currentRow.push(currentValue.trim());
    currentValue = '';
  };

  const flushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === '') {
      currentRow = [];
      return;
    }
    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      flushValue();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      flushValue();
      flushRow();
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    flushValue();
    flushRow();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...dataRows] = rows;
  return {
    headers: headers.map((header) => header.replace(/^"|"$/g, '')),
    rows: dataRows.filter((row) => row.some((cell) => cell.trim() !== '')),
  };
}
