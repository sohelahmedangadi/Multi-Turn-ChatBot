/**
 * Base Extractor Interface & ParsedDocument Factory
 */

export const CHARS_PER_TOKEN = 4;

export function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Creates a standardized ParsedDocument structure
 * @param {object} params
 * @returns {object} ParsedDocument
 */
export function createParsedDocument({
  fileId = '',
  sessionId = '',
  filename = '',
  fileType = 'text',
  mimeType = 'text/plain',
  size = 0,
  sha256 = '',
  textBlocks = [],
  tables = [],
  pageCount = 1,
  warnings = [],
  isScanned = false,
  isVisionRequired = false,
  rawText = '',
}) {
  const fullText = rawText || textBlocks.map((b) => b.text).join('\n\n');
  const cleanText = fullText.replace(/\r\n/g, '\n').replace(/\0/g, '').trim();
  const wordCount = cleanText.length > 0 ? cleanText.split(/\s+/).length : 0;
  const estimatedTokens = estimateTokenCount(cleanText);

  return {
    file_id: fileId,
    session_id: sessionId,
    filename,
    fileType,
    mime_type: mimeType,
    page_count: pageCount,
    wordCount,
    charCount: cleanText.length,
    estimatedTokens,
    isVisionRequired: Boolean(isVisionRequired),
    isScanned: Boolean(isScanned),
    text_blocks: textBlocks.map((b, idx) => ({
      index: idx,
      text: b.text || '',
      page: b.page || 1,
      sheet: b.sheet || null,
      heading: b.heading || null,
      section: b.section || null,
      tokensEstimated: estimateTokenCount(b.text || ''),
    })),
    tables: tables.map((t, idx) => ({
      index: idx,
      title: t.title || `Table ${idx + 1}`,
      sheet: t.sheet || null,
      headers: Array.isArray(t.headers) ? t.headers : [],
      rows: Array.isArray(t.rows) ? t.rows : [],
      rowCount: t.rows ? t.rows.length : (t.rowCount || 0),
      colCount: t.headers ? t.headers.length : (t.colCount || 0),
      dtypes: t.dtypes || {},
    })),
    metadata: {
      file_id: fileId,
      session_id: sessionId,
      filename,
      mime_type: mimeType,
      size,
      sha256,
      uploaded_at: new Date().toISOString(),
      fileType,
      wordCount,
      charCount: cleanText.length,
      estimatedTokens,
      isScanned: Boolean(isScanned),
      isVisionRequired: Boolean(isVisionRequired),
    },
    warnings: Array.isArray(warnings) ? warnings : [],
    fullText: cleanText,
  };
}
