import { createRequire } from 'module';
import { createParsedDocument } from './baseExtractor.js';
import {
  EncryptedPdfError,
  CorruptFileError,
  EmptyDocumentError,
  OcrUnavailableError,
} from './errors.js';
import { getGeminiClient } from '../llmProvider.js';

let PDFParseClass = null;
let legacyPdfFunction = null;

async function getPdfParser() {
  if (PDFParseClass || legacyPdfFunction) {
    return { PDFParseClass, legacyPdfFunction };
  }
  try {
    const mod = await import('pdf-parse');
    if (mod.PDFParse) {
      PDFParseClass = mod.PDFParse;
    } else if (typeof mod.default === 'function') {
      legacyPdfFunction = mod.default;
    } else if (typeof mod === 'function') {
      legacyPdfFunction = mod;
    }
  } catch {
    try {
      const customRequire = createRequire(import.meta.url || 'file:///');
      const reqMod = customRequire('pdf-parse');
      if (reqMod && reqMod.PDFParse) {
        PDFParseClass = reqMod.PDFParse;
      } else if (typeof reqMod === 'function') {
        legacyPdfFunction = reqMod;
      }
    } catch (e) {
      console.warn('pdf-parse dynamic load warning:', e.message);
    }
  }
  return { PDFParseClass, legacyPdfFunction };
}

/**
 * Strips raw PDF internal dictionary metadata lines
 */
function stripPdfMetadataArtifacts(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^\s*\/(CreationDate|ModDate|Producer|Creator|Author|Title|Subject|Keywords|Trapped|PTFilter|FontDescriptor|Type|Subtype)/i.test(trimmed)) return false;
      if (/^\s*PDF-\d\.\d/i.test(trimmed)) return false;
      if (/^\s*%(PDF|EOF|\w+)/i.test(trimmed)) return false;
      if (/^\s*(<<|>>|\/Root|\/Info|\/Size|\/Prev)/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * OCR visual transcription using Gemini 2.5 Flash Vision
 */
async function transcribeVisualPdfWithGemini(fileBuffer, originalName) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new OcrUnavailableError('Gemini API key is not configured for Multimodal OCR.');
  }

  try {
    const ai = getGeminiClient();
    const base64Data = fileBuffer.toString('base64');
    const promptText =
      'Open and read all slides/pages of this document. Transcribe the full substantive content page by page: include headlines, body text, tables, numbers, and diagrams. Do NOT output metadata.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            { text: promptText },
          ],
        },
      ],
    });

    return response.text || '';
  } catch (err) {
    console.warn(`[PDF OCR] Gemini vision transcription failed for ${originalName}:`, err.message);
    throw new OcrUnavailableError(`OCR processing failed: ${err.message}`);
  }
}

/**
 * Extracts text and structure from a PDF buffer
 * @param {Buffer} buffer
 * @param {object} meta
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractPdf(buffer, meta = {}) {
  const filename = meta.filename || 'document.pdf';
  const { PDFParseClass, legacyPdfFunction } = await getPdfParser();

  let pageCount = 1;
  let rawText = '';
  const pageTexts = [];

  if (PDFParseClass) {
    try {
      const parser = new PDFParseClass({ data: buffer });
      const res = await parser.getText();
      rawText = res.text || '';
      pageCount = res.total || 1;
      if (Array.isArray(res.pages)) {
        res.pages.forEach((p) => {
          pageTexts.push(typeof p === 'string' ? p : (p.text || ''));
        });
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (/password|encrypted|encrypt/i.test(msg) || err?.name === 'PasswordException') {
        throw new EncryptedPdfError();
      }
      throw new CorruptFileError(`Failed to parse PDF document: ${msg}`);
    }
  } else if (typeof legacyPdfFunction === 'function') {
    try {
      const pdfData = await legacyPdfFunction(buffer, {
        pagerender: function (pageData) {
          return pageData.getTextContent().then(function (textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY) {
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            pageTexts.push(text);
            return text;
          });
        },
      });
      pageCount = pdfData.numpages || (pageTexts.length > 0 ? pageTexts.length : 1);
      rawText = pdfData.text || '';
    } catch (err) {
      const msg = err?.message || String(err);
      if (/password|encrypted|encrypt/i.test(msg)) {
        throw new EncryptedPdfError();
      }
      throw new CorruptFileError(`Failed to parse PDF document: ${msg}`);
    }
  } else {
    throw new CorruptFileError('PDF extraction module is unavailable.');
  }

  const cleanOverallText = stripPdfMetadataArtifacts(rawText);

  // Document-Level Scanned Rule:
  // Scanned if >= 60% of pages yield < 80 characters of substantive text
  let lowTextPagesCount = 0;
  const effectivePageTexts = pageTexts.length > 0 ? pageTexts : [cleanOverallText];

  for (const pText of effectivePageTexts) {
    const cleanP = stripPdfMetadataArtifacts(pText);
    if (cleanP.length < 80) {
      lowTextPagesCount++;
    }
  }

  const lowTextRatio = pageTexts.length > 1 ? (lowTextPagesCount / pageTexts.length) : 0;
  const isScanned = cleanOverallText.trim().length < 10 || (pageTexts.length > 1 && lowTextRatio >= 0.6);
  const warnings = [];

  let finalText = cleanOverallText;
  let ocrUsed = false;

  if (isScanned) {
    warnings.push(`Document-level scanned detection triggered (${Math.round(lowTextRatio * 100)}% low-text pages).`);
    try {
      finalText = await transcribeVisualPdfWithGemini(buffer, filename);
      ocrUsed = true;
    } catch (ocrErr) {
      warnings.push(`OCR fallback notice: ${ocrErr.message}`);
      if (!cleanOverallText || cleanOverallText.length < 10) {
        throw new OcrUnavailableError('Document is a scanned image, but OCR fallback could not extract text.');
      }
    }
  }

  if (!finalText || finalText.trim().length < 10) {
    throw new EmptyDocumentError(`PDF document "${filename}" contains no readable text or transcribeable content.`);
  }

  // Create text blocks per page
  const textBlocks = [];
  if (effectivePageTexts.length > 1 && !ocrUsed) {
    effectivePageTexts.forEach((pText, i) => {
      const cleaned = stripPdfMetadataArtifacts(pText);
      if (cleaned.length > 0) {
        textBlocks.push({
          page: i + 1,
          section: `Page ${i + 1}`,
          text: cleaned,
        });
      }
    });
  } else {
    // Single block or OCR transcript split on page boundaries
    const pageSplits = finalText.split(/(?:--- Page \d+ ---|Page \d+:)/i);
    if (pageSplits.length > 1) {
      pageSplits.forEach((chunk, i) => {
        const c = chunk.trim();
        if (c) {
          textBlocks.push({
            page: i + 1,
            section: `Page ${i + 1}`,
            text: c,
          });
        }
      });
    } else {
      textBlocks.push({
        page: 1,
        section: 'Document Body',
        text: finalText.trim(),
      });
    }
  }

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType: 'pdf',
    mimeType: 'application/pdf',
    size: buffer.length,
    sha256: meta.sha256,
    pageCount,
    textBlocks,
    tables: [],
    warnings,
    isScanned,
    rawText: finalText,
  });
}
