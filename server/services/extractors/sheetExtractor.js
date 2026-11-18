import { createParsedDocument } from './baseExtractor.js';
import { EmptyDocumentError, CorruptFileError, FileSizeExceededError } from './errors.js';

export const MAX_CSV_LINES = Number(process.env.MAX_CSV_LINES) || 50000;
export const MAX_CSV_COLS = Number(process.env.MAX_CSV_COLS) || 1000;
export const MAX_CELL_LENGTH = 10000;

/**
 * Neutralizes CSV/Spreadsheet formula-injection prefixes (=, +, -, @, \t, \r)
 * by prepending a single quote (') to prevent arbitrary code execution in Excel / Calc / Sheets.
 * @param {string} val
 * @returns {string}
 */
export function neutralizeCsvFormula(val) {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + val;
  }
  return val;
}

/**
 * Infers data type from an array of sample cell values
 * @param {string[]} values
 * @returns {'number'|'boolean'|'date'|'string'}
 */
export function inferColumnDtype(values = []) {
  const nonEmpties = values.map((v) => (v !== null && v !== undefined ? String(v).trim() : '')).filter(Boolean);
  if (nonEmpties.length === 0) return 'string';

  const isNumeric = nonEmpties.every((v) => !isNaN(Number(v)) && !v.startsWith('0x'));
  if (isNumeric) return 'number';

  const isBool = nonEmpties.every((v) => /^(true|false|yes|no|1|0)$/i.test(v));
  if (isBool) return 'boolean';

  const isDate = nonEmpties.every((v) => {
    if (v.length < 6) return false;
    const parsed = Date.parse(v);
    return !isNaN(parsed) && /[-/:]/.test(v);
  });
  if (isDate) return 'date';

  return 'string';
}

/**
 * Robust RFC 4180 CSV parser supporting quoted values, commas, and escaped quotes,
 * with CSV formula injection neutralization and line/column limit enforcement.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  const addField = () => {
    let f = currentField.trim();
    if (f.length > MAX_CELL_LENGTH) {
      f = f.substring(0, MAX_CELL_LENGTH);
    }
    currentRow.push(neutralizeCsvFormula(f));
    currentField = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\t' || char === ';') {
        if (currentRow.length < MAX_CSV_COLS) {
          addField();
        }
      } else if (char === '\r') {
        // Ignore carriage return
      } else if (char === '\n') {
        addField();
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
          if (rows.length >= MAX_CSV_LINES) {
            break;
          }
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    addField();
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Extracts CSV data, inferring headers and types, creating schema summary and sample blocks
 * @param {Buffer} buffer
 * @param {object} meta
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractCsv(buffer, meta = {}) {
  const filename = meta.filename || 'dataset.csv';
  const text = buffer.toString('utf-8').trim();

  if (!text || text.length < 2) {
    throw new EmptyDocumentError(`CSV file "${filename}" is empty.`);
  }

  const rawRows = parseCsvRows(text);
  if (rawRows.length === 0) {
    throw new EmptyDocumentError(`CSV file "${filename}" contains no valid rows.`);
  }

  const headers = rawRows[0].map((h, idx) => h || `Column_${idx + 1}`);
  const dataRows = rawRows.slice(1);

  // Infer dtypes for each column
  const dtypes = {};
  headers.forEach((h, colIdx) => {
    const columnValues = dataRows.slice(0, 50).map((r) => r[colIdx]);
    dtypes[h] = inferColumnDtype(columnValues);
  });

  const rowCount = dataRows.length;
  const isLargeSheet = rowCount > 50;

  // Build schema summary
  let schemaSummary = `Dataset Schema: "${filename}"\n`;
  schemaSummary += `Total Rows: ${rowCount}, Columns: ${headers.length}\n`;
  schemaSummary += 'Columns:\n' + headers.map((h) => `  - ${h} (${dtypes[h]})`).join('\n');

  // Format sample rows
  const sampleRowCount = isLargeSheet ? 15 : rowCount;
  const sampleRows = dataRows.slice(0, sampleRowCount);

  let sampleText = `Sample Data (${sampleRowCount} of ${rowCount} rows):\n`;
  sampleText += headers.join(' | ') + '\n';
  sampleText += sampleRows.map((r) => r.join(' | ')).join('\n');

  if (isLargeSheet) {
    sampleText += `\n... [${rowCount - sampleRowCount} additional rows omitted for context budget. Full schema retained above.]`;
  }

  const textBlocks = [
    {
      sheet: filename,
      section: 'Dataset Schema',
      heading: 'Schema Summary',
      text: schemaSummary,
    },
    {
      sheet: filename,
      section: 'Dataset Content',
      heading: isLargeSheet ? `Sample Data (${sampleRowCount} rows)` : 'Complete Table',
      text: sampleText,
    },
  ];

  const tables = [
    {
      title: filename,
      sheet: filename,
      headers,
      rows: isLargeSheet ? sampleRows : dataRows,
      rowCount,
      colCount: headers.length,
      dtypes,
    },
  ];

  const fullText = `${schemaSummary}\n\n${sampleText}`;

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType: 'csv',
    mimeType: 'text/csv',
    size: buffer.length,
    sha256: meta.sha256,
    textBlocks,
    tables,
    rawText: fullText,
  });
}
