export type CsvDelimiter = ',' | ';' | '\t';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Delimiter used while parsing (auto-detected unless passed explicitly). */
  delimiter: CsvDelimiter;
}

const CANDIDATE_DELIMITERS: CsvDelimiter[] = [',', ';', '\t'];

/** Removes a leading UTF-8 byte-order mark (Excel adds one to "CSV UTF-8" files). */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Guesses the delimiter from the header line, ignoring characters inside
 * double quotes. Turkish / European Excel writes `;`, US Excel writes `,`,
 * and some tools export tab-separated text. Ties fall back to comma.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const source = stripBom(text);
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (inQuotes && source[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (char === '\n' || char === '\r') break;
    if (char === ',' || char === ';' || char === '\t') counts[char] += 1;
  }

  let best: CsvDelimiter = ',';
  for (const delimiter of CANDIDATE_DELIMITERS) {
    if (counts[delimiter] > counts[best]) best = delimiter;
  }
  return best;
}

export function parseCSV(text: string, delimiterOverride?: CsvDelimiter): ParsedCsv {
  const source = stripBom(text);
  const delimiter = delimiterOverride ?? detectCsvDelimiter(source);
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

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
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
    return { headers: [], rows: [], delimiter };
  }

  const [headers, ...dataRows] = rows;
  return {
    headers: headers.map((header) => header.replace(/^"|"$/g, '')),
    rows: dataRows.filter((row) => row.some((cell) => cell.trim() !== '')),
    delimiter,
  };
}
