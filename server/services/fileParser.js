import path from 'path';
import { createRequire } from 'module';

let pdfParse = null;

async function getPdfParser() {
  if (pdfParse) return pdfParse;
  try {
    if (typeof require !== 'undefined') {
      pdfParse = require('pdf-parse');
    } else {
      const customRequire = createRequire(import.meta.url || 'file:///');
      pdfParse = customRequire('pdf-parse');
    }
  } catch (err) {
    try {
      const mod = await import('pdf-parse');
      pdfParse = mod.default || mod;
    } catch (e) {
      console.warn('pdf-parse dynamic load warning:', e.message);
    }
  }
  return pdfParse;
}

/**
 * Parses uploaded file buffer or string based on file extension / MIME type
 * @param {Buffer|string} fileBuffer - Raw buffer or text content
 * @param {string} originalName - Original uploaded filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<{ filename: string, fileType: string, textContent: string, wordCount: number, estimatedTokens: number }>}
 */
export async function parseFileContent(fileBuffer, originalName = 'document.txt', mimeType = '') {
  const ext = path.extname(originalName).toLowerCase();
  let textContent = '';
  let fileType = 'text';

  try {
    if (ext === '.pdf' || mimeType === 'application/pdf') {
      fileType = 'pdf';
      const parser = await getPdfParser();
      if (typeof parser === 'function') {
        const pdfData = await parser(fileBuffer);
        textContent = pdfData.text || '';
      } else {
        textContent = fileBuffer.toString('utf-8');
      }
    } else if (ext === '.json' || mimeType === 'application/json') {
      fileType = 'json';
      const raw = fileBuffer.toString('utf-8');
      try {
        const parsed = JSON.parse(raw);
        textContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        textContent = raw;
      }
    } else if (ext === '.csv' || mimeType === 'text/csv') {
      fileType = 'csv';
      textContent = fileBuffer.toString('utf-8');
    } else if (['.md', '.markdown'].includes(ext)) {
      fileType = 'markdown';
      textContent = fileBuffer.toString('utf-8');
    } else if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.rs', '.go', '.html', '.css', '.sql', '.yaml', '.yml', '.sh'].includes(ext)) {
      fileType = 'code';
      textContent = fileBuffer.toString('utf-8');
    } else {
      fileType = 'text';
      textContent = fileBuffer.toString('utf-8');
    }
  } catch (err) {
    console.error(`Error parsing file ${originalName}:`, err);
    throw new Error(`Failed to extract text from ${originalName}: ${err.message}`);
  }

  // Clean and sanitize extracted text
  const cleanText = textContent
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .trim();

  const wordCount = cleanText.length > 0 ? cleanText.split(/\s+/).length : 0;
  const estimatedTokens = Math.ceil(cleanText.length / 4);

  return {
    filename: originalName,
    fileType,
    textContent: cleanText,
    charCount: cleanText.length,
    wordCount,
    estimatedTokens,
  };
}
