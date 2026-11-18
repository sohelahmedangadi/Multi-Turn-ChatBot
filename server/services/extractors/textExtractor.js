import { createParsedDocument } from './baseExtractor.js';
import { EmptyDocumentError, CorruptFileError } from './errors.js';

/**
 * Extracts plain text, Markdown, or JSON documents into structured blocks
 * @param {Buffer} buffer
 * @param {object} meta
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractText(buffer, meta = {}) {
  const filename = meta.filename || 'document.txt';
  const fileType = meta.fileType || 'text';

  // 1. Check and reject forbidden NUL bytes (0x00)
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x00) {
      throw new CorruptFileError(`Document "${filename}" contains forbidden null bytes (0x00).`);
    }
  }

  // 2. Validate strict UTF-8 decoding
  let rawText = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    rawText = decoder.decode(buffer);
  } catch (err) {
    throw new CorruptFileError(`Document "${filename}" contains invalid or non-UTF-8 byte sequences.`);
  }

  // 3. Enforce line count and column width limits
  const MAX_LINES = 50000;
  const MAX_LINE_CHARS = 10000;
  const lines = rawText.split(/\r?\n/);
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES;
  }
  const safeLines = lines.map((l) => (l.length > MAX_LINE_CHARS ? l.substring(0, MAX_LINE_CHARS) : l));
  const raw = safeLines.join('\n').trim();

  if (!raw || raw.length < 2) {
    throw new EmptyDocumentError(`Document "${filename}" contains no readable text.`);
  }

  const textBlocks = [];

  if (fileType === 'markdown') {
    // Split on markdown headings #, ##, ###
    const sections = raw.split(/(?=\n#{1,4}\s+)/g);
    let currentHeading = 'Overview';

    for (const sec of sections) {
      const trimmed = sec.trim();
      if (!trimmed) continue;
      const hMatch = /^#{1,4}\s+(.+)$/m.exec(trimmed);
      if (hMatch) {
        currentHeading = hMatch[1].trim();
      }
      textBlocks.push({
        heading: currentHeading,
        section: currentHeading,
        text: trimmed,
      });
    }
  } else if (fileType === 'json') {
    try {
      const parsed = JSON.parse(raw);
      const isArray = Array.isArray(parsed);
      const keys = isArray ? (parsed[0] ? Object.keys(parsed[0]) : []) : Object.keys(parsed);
      const schemaSummary = `JSON Structure: "${filename}"\nType: ${isArray ? 'Array of Objects' : 'Object'}\nTop-level Keys / Properties: ${keys.join(', ')}\nTotal Items / Size: ${isArray ? parsed.length : keys.length}`;

      textBlocks.push({
        heading: 'JSON Schema Overview',
        section: 'Schema',
        text: schemaSummary,
      });

      textBlocks.push({
        heading: 'JSON Data',
        section: 'Data',
        text: JSON.stringify(parsed, null, 2),
      });
    } catch (e) {
      throw new CorruptFileError(`Invalid JSON in file "${filename}": ${e.message}`);
    }
  } else {
    // Plain text / code: split into logical paragraph chunks
    const paragraphs = raw.split(/\n\n+/g);
    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (trimmed) {
        textBlocks.push({
          section: `Section ${idx + 1}`,
          text: trimmed,
        });
      }
    });
  }

  if (textBlocks.length === 0) {
    textBlocks.push({
      section: 'Document Body',
      text: raw,
    });
  }

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType,
    mimeType: meta.mimeType || 'text/plain',
    size: buffer.length,
    sha256: meta.sha256,
    textBlocks,
    tables: [],
    rawText: raw,
  });
}
