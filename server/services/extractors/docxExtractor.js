import zlib from 'zlib';
import { createParsedDocument } from './baseExtractor.js';
import { CorruptFileError, EmptyDocumentError, ZipBombError } from './errors.js';
import { inspectZipArchive, MAX_UNCOMPRESSED_ZIP_BYTES } from './fileValidator.js';

let mammothModule = null;

async function getMammoth() {
  if (mammothModule) return mammothModule;
  try {
    const mod = await import('mammoth');
    mammothModule = mod.default || mod;
  } catch {
    // Optional dependency; will fall back to built-in OpenXML parser
  }
  return mammothModule;
}

/**
 * Extracts a specific file from a zip buffer using Node's built-in zlib
 * @param {Buffer} buffer
 * @param {string} targetEntry
 * @returns {string|null}
 */
function extractZipEntryText(buffer, targetEntry) {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      if (uncompSize > MAX_UNCOMPRESSED_ZIP_BYTES) {
        throw new ZipBombError('Decompressed entry exceeds 50MB safety cap.');
      }

      const nameStart = offset + 30;
      const entryName = buffer.toString('utf-8', nameStart, nameStart + nameLen);
      const dataStart = nameStart + nameLen + extraLen;

      if (entryName === targetEntry) {
        const compressedData = buffer.subarray(dataStart, dataStart + compSize);
        if (compMethod === 0) {
          return compressedData.toString('utf-8');
        } else if (compMethod === 8) {
          const decompressed = zlib.inflateRawSync(compressedData);
          return decompressed.toString('utf-8');
        }
      }
      offset = dataStart + compSize;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Parses OpenXML word/document.xml to extract headings, paragraphs, and tables
 * @param {string} xml
 */
function parseOpenXmlDocument(xml) {
  const textBlocks = [];
  const tables = [];
  let currentHeading = null;

  // Split XML into paragraph <w:p> and table <w:tbl> blocks
  const blockRegex = /<(w:p|w:tbl)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = blockRegex.exec(xml)) !== null) {
    const tag = match[1];
    const content = match[2];

    if (tag === 'w:p') {
      // Check for heading style
      const styleMatch = /<w:pStyle\s+w:val="([^"]+)"/i.exec(content);
      const style = styleMatch ? styleMatch[1] : '';
      const isHeading = /heading|title/i.test(style);

      // Extract all text elements <w:t>
      const textMatches = content.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/gi) || [];
      const pText = textMatches
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim();

      if (pText) {
        if (isHeading) {
          currentHeading = pText;
          textBlocks.push({
            heading: pText,
            section: pText,
            text: `## ${pText}`,
          });
        } else {
          textBlocks.push({
            heading: currentHeading,
            section: currentHeading || 'Document Body',
            text: pText,
          });
        }
      }
    } else if (tag === 'w:tbl') {
      // Table block
      const rowMatches = content.match(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi) || [];
      const parsedRows = [];

      for (const rowContent of rowMatches) {
        const cellMatches = rowContent.match(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi) || [];
        const rowCells = cellMatches.map((cell) => {
          const tMatches = cell.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/gi) || [];
          return tMatches.map((t) => t.replace(/<[^>]+>/g, '')).join(' ').trim();
        });
        if (rowCells.some((c) => c.length > 0)) {
          parsedRows.push(rowCells);
        }
      }

      if (parsedRows.length > 0) {
        const headers = parsedRows[0];
        const rows = parsedRows.slice(1);
        tables.push({
          title: currentHeading ? `Table under "${currentHeading}"` : `Table ${tables.length + 1}`,
          headers,
          rows,
          rowCount: rows.length,
          colCount: headers.length,
        });

        // Also add table representation to text blocks for searchability
        const tableSummary = `Table: ${headers.join(' | ')}\n` +
          rows.map((r) => r.join(' | ')).slice(0, 10).join('\n');
        textBlocks.push({
          heading: currentHeading,
          section: currentHeading ? `Table under ${currentHeading}` : 'Table',
          text: tableSummary,
        });
      }
    }
  }

  return { textBlocks, tables };
}

/**
 * Extracts DOCX document using mammoth or pure-JS OpenXML parser
 * @param {Buffer} buffer
 * @param {object} meta
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractDocx(buffer, meta = {}) {
  const filename = meta.filename || 'document.docx';

  // 1. Inspect Zip Archive for safety and zip-bomb check
  const zipInfo = inspectZipArchive(buffer);
  if (!zipInfo.entries.includes('word/document.xml')) {
    throw new CorruptFileError('DOCX document is missing word/document.xml package entry.');
  }

  const warnings = [];
  let textBlocks = [];
  let tables = [];

  // Try mammoth if available
  const mammoth = await getMammoth();
  if (mammoth && typeof mammoth.convertToHtml === 'function') {
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const rawTextResult = await mammoth.extractRawText({ buffer });
      const rawText = (rawTextResult.value || '').trim();

      if (!rawText || rawText.length < 5) {
        throw new EmptyDocumentError(`DOCX file "${filename}" contains no text content.`);
      }

      // Parse HTML paragraphs and headings
      const html = htmlResult.value || '';
      const parts = html.split(/(?=<h1>|<h2>|<h3>|<h4>|<table)/i);
      let currentSection = 'Document Body';

      for (const part of parts) {
        const clean = part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) continue;

        const headingMatch = /<h([1-6])[^>]*>([^<]+)<\/h\1>/i.exec(part);
        if (headingMatch) {
          currentSection = headingMatch[2].trim();
          textBlocks.push({
            heading: currentSection,
            section: currentSection,
            text: `## ${currentSection}\n${clean}`,
          });
        } else {
          textBlocks.push({
            heading: currentSection !== 'Document Body' ? currentSection : null,
            section: currentSection,
            text: clean,
          });
        }
      }

      // Extract raw text if blocks were empty
      if (textBlocks.length === 0 && rawText) {
        textBlocks.push({ section: 'Document Body', text: rawText });
      }

      return createParsedDocument({
        fileId: meta.fileId,
        sessionId: meta.sessionId,
        filename,
        fileType: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: buffer.length,
        sha256: meta.sha256,
        textBlocks,
        tables,
        warnings,
        rawText,
      });
    } catch (mErr) {
      warnings.push(`Mammoth parser notice: ${mErr.message}. Falling back to OpenXML parser.`);
    }
  }

  // 2. Pure-JS OpenXML fallback
  const documentXml = extractZipEntryText(buffer, 'word/document.xml');
  if (!documentXml) {
    throw new CorruptFileError('Could not decompress word/document.xml from DOCX.');
  }

  const parsed = parseOpenXmlDocument(documentXml);
  textBlocks = parsed.textBlocks;
  tables = parsed.tables;

  const combinedText = textBlocks.map((b) => b.text).join('\n\n').trim();
  if (!combinedText || combinedText.length < 5) {
    throw new EmptyDocumentError(`DOCX document "${filename}" contains no readable text.`);
  }

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: buffer.length,
    sha256: meta.sha256,
    textBlocks,
    tables,
    warnings,
    rawText: combinedText,
  });
}
