import path from 'path';
import { createRequire } from 'module';
import { getGeminiClient } from './llmProvider.js';

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
 * Fallback OCR & Multimodal Transcriber using Gemini Vision
 * Extracts text from rasterized/image-only PDFs (e.g. PowerPoint slide exports)
 */
async function transcribePdfWithGemini(fileBuffer, originalName) {
  try {
    console.log(`[PDF OCR] Triggering Gemini Multimodal OCR for rasterized PDF: "${originalName}"...`);
    const ai = getGeminiClient();
    const base64Pdf = fileBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              text: 'Transcribe and extract all content from this document slide by slide / page by page. Include all slide titles, headings, bullet points, body text, tables, numbers, and descriptive summaries of diagrams or visual charts.',
            },
          ],
        },
      ],
    });

    const transcribed = response.text || '';
    console.log(`[PDF OCR] Successfully transcribed ${transcribed.length} chars from "${originalName}" via Gemini.`);
    return transcribed;
  } catch (ocrErr) {
    console.error(`[PDF OCR ERROR] Gemini PDF transcription failed for ${originalName}:`, ocrErr.message);
    return '';
  }
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

        // 1. Diagnostic Logging
        console.log(`\n======================================================`);
        console.log(`📄 [PDF EXTRACTION DIAGNOSTIC]: "${originalName}"`);
        console.log(`   - Raw data.text length: ${pdfData.text?.length || 0} characters`);
        console.log(`   - First 500 chars of data.text:\n${(pdfData.text || '').substring(0, 500) || '[EMPTY STRING]'}`);
        console.log(`   - data.info (Document Metadata Object):\n`, JSON.stringify(pdfData.info || {}, null, 2));
        console.log(`======================================================\n`);

        textContent = pdfData.text || '';

        // 2. Fallback to Gemini Multimodal OCR if text layer is empty / rasterized slides
        if (!textContent || textContent.trim().length < 50) {
          console.warn(`⚠️ [PDF NOTICE] "${originalName}" has no selectable text layer (likely PowerPoint rasterized slides). Invoking Gemini OCR fallback...`);
          const ocrText = await transcribePdfWithGemini(fileBuffer, originalName);
          if (ocrText && ocrText.trim().length > 0) {
            textContent = ocrText;
          }
        }
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

  // 3. Clear error if document produces near-empty text
  if (!cleanText || cleanText.length < 10) {
    throw new Error(`Document "${originalName}" contains no readable text or transcribeable content. If it is an image or scan, ensure it contains clear visual text.`);
  }

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
