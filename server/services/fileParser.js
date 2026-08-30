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
 * Strips raw PDF internal dictionary metadata lines, header tags, and font artifacts
 */
function stripPdfMetadataArtifacts(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      // Strip internal PDF dictionary keys and properties
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
 * Multimodal Image & Document Transcriber using Gemini Vision
 * Extracts substantive content, slide text, tables, and explanations of diagrams
 */
async function transcribeVisualContentWithGemini(fileBuffer, originalName, mimeType) {
  try {
    console.log(`[MULTIMODAL OCR] Analyzing visual content via Gemini Vision for "${originalName}" (${mimeType})...`);
    const ai = getGeminiClient();
    const base64Data = fileBuffer.toString('base64');

    const promptText = mimeType.startsWith('image/')
      ? 'Analyze this image thoroughly. Transcribe and explain all substantive text, content, code, data points, diagrams, and visual components in full detail. Do NOT output file attributes or metadata.'
      : 'Open and read all slides/pages of this document. Transcribe the full substantive content slide by slide / page by page: include all slide headlines, bullet points, body paragraphs, tables, instructions, steps, numbers, and descriptive explanations of any diagrams or images. Do NOT output file properties, creation dates, or font metadata.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
    });

    const transcribed = response.text || '';
    console.log(`[MULTIMODAL OCR] Successfully transcribed ${transcribed.length} chars from "${originalName}".`);
    return transcribed;
  } catch (ocrErr) {
    console.error(`[MULTIMODAL OCR ERROR] Gemini vision analysis failed for ${originalName}:`, ocrErr.message);
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

  const isImage =
    ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext) ||
    mimeType.startsWith('image/');

  try {
    if (isImage) {
      fileType = 'image';
      const effectiveMime =
        mimeType ||
        (ext === '.png'
          ? 'image/png'
          : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg');

      textContent = await transcribeVisualContentWithGemini(fileBuffer, originalName, effectiveMime);
    } else if (ext === '.pdf' || mimeType === 'application/pdf') {
      fileType = 'pdf';
      const parser = await getPdfParser();
      let extractedPdfText = '';

      if (typeof parser === 'function') {
        try {
          const pdfData = await parser(fileBuffer);
          const rawText = pdfData.text || '';
          extractedPdfText = stripPdfMetadataArtifacts(rawText);

          console.log(`\n======================================================`);
          console.log(`📄 [PDF EXTRACTION DIAGNOSTIC]: "${originalName}"`);
          console.log(`   - Clean substantive text length: ${extractedPdfText.length} characters`);
          console.log(`   - First 500 chars:\n${extractedPdfText.substring(0, 500) || '[EMPTY STRING]'}`);
          console.log(`======================================================\n`);
        } catch (pdfErr) {
          console.warn(`[PDF PARSE NOTICE] Native pdf-parse failed (${pdfErr.message}). Switching to Gemini Multimodal OCR...`);
        }
      }

      // If text layer is empty or only had stripped metadata (under 80 substantive chars), invoke Gemini Vision OCR
      if (!extractedPdfText || extractedPdfText.length < 80) {
        console.log(`⚠️ [PDF OCR TRIGGER] "${originalName}" substantive text is under 80 chars. Invoking Gemini Multimodal OCR on PDF...`);
        const ocrText = await transcribeVisualContentWithGemini(fileBuffer, originalName, 'application/pdf');
        textContent = ocrText || extractedPdfText;
      } else {
        textContent = extractedPdfText;
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
  const cleanText = (textContent || '')
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .trim();

  // Clear error if document produces near-empty text
  if (!cleanText || cleanText.length < 10) {
    throw new Error(`Document "${originalName}" contains no readable text or transcribeable visual content.`);
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
