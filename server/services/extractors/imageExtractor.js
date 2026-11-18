import { createParsedDocument } from './baseExtractor.js';
import { getGeminiClient, isGeminiCircuitOpen } from '../llmProvider.js';
import { runPythonProcess } from './pythonRunner.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/read_image.py');

/**
 * Runs the local Python image processor (Pillow + OpenCV + scikit-image + EasyOCR)
 * via queue-governed, process-group isolated child process runner.
 * @param {string} imagePath
 * @returns {Promise<object|null>}
 */
async function runLocalImageProcessor(imagePath) {
  try {
    const { parsed } = await runPythonProcess(SCRIPT_PATH, [imagePath], { timeoutMs: 30000 });
    return parsed;
  } catch (err) {
    console.warn('[ImageExtractor] Local processor notice:', err.message);
    return null;
  }
}

/**
 * Image Extractor: Parses image files, performs visual feature extraction,
 * Pillow/OpenCV metric analysis, EasyOCR deep-learning text extraction,
 * and Gemini multimodal vision reasoning.
 * 
 * @param {Buffer} buffer
 * @param {object} meta - { fileId, sessionId, filename, fileType, mimeType, sha256, storagePath }
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractImage(buffer, meta = {}) {
  const filename = meta.filename || 'image.png';
  const mimeType = meta.mimeType || 'image/png';
  const sizeKb = (buffer.length / 1024).toFixed(1);
  const warnings = [];

  let visualSummary = '';
  let textBlocks = [];
  let localResult = null;

  // 1. Run Local Python Image Processor (Pillow + OpenCV + EasyOCR)
  let tempFilePath = null;
  try {
    let targetPath = meta.storagePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      const ext = path.extname(filename) || '.png';
      tempFilePath = path.join(os.tmpdir(), `cosmo_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`);
      await fs.promises.writeFile(tempFilePath, buffer);
      targetPath = tempFilePath;
    }

    localResult = await runLocalImageProcessor(targetPath);
    if (localResult) {
      console.log(`[ImageExtractor] Local processor extracted metadata (${localResult.metadata?.resolution}) and OCR text (${localResult.ocr?.wordCount || 0} words) for "${filename}"`);
      if (localResult.structuredBlocks && localResult.structuredBlocks.length > 0) {
        textBlocks = localResult.structuredBlocks;
      }
      if (localResult.summary) {
        visualSummary = localResult.summary;
      }
    }
  } catch (localErr) {
    console.warn(`[ImageExtractor] Local processing notice:`, localErr.message);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (e) {}
    }
  }

  // 2. Multimodal Cloud Reasoning via Gemini (if configured and quota available)
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (apiKey && !isGeminiCircuitOpen() && buffer.length <= 20 * 1024 * 1024) {
    try {
      console.log(`[ImageExtractor] Querying Gemini multimodal vision analysis for "${filename}" (${sizeKb} KB)...`);
      const ai = getGeminiClient();
      const base64Data = buffer.toString('base64');

      const prompt = `Perform a comprehensive visual inspection of this image:
1. Visual Overview: What is shown in this image? Describe subjects, people, background, and environment.
2. Visible Text & OCR: Transcribe every word, number, sign, caption, or label visible in the image verbatim. If none, state "No text detected".
3. Objects & Details: List prominent items, colors, branding, spatial layout, or diagrammatic information.
4. Key Concepts: List the key themes, categories, or keywords for this image.`;

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
              { text: prompt },
            ],
          },
        ],
      });

      const responseText = response?.text || '';
      if (responseText.trim().length > 20) {
        const geminiVisual = responseText.trim();
        if (localResult?.ocr?.hasText && localResult.ocr.fullText) {
          visualSummary = `${geminiVisual}\n\n=== VERBATIM OCR TEXT (EasyOCR) ===\n${localResult.ocr.fullText}`;
        } else {
          visualSummary = geminiVisual;
        }

        // Create structured blocks from the analysis
        const sections = geminiVisual.split(/(?=\d+\.\s+[A-Za-z])/);
        if (sections.length > 1) {
          const geminiBlocks = sections.map((sec, idx) => {
            const trimmed = sec.trim();
            const firstLine = trimmed.split('\n')[0] || `Section ${idx + 1}`;
            return {
              page: 1,
              section: firstLine.substring(0, 50),
              heading: `Visual Detail ${idx + 1}`,
              text: trimmed,
            };
          });
          textBlocks = [...geminiBlocks, ...textBlocks];
        }
        console.log(`[ImageExtractor] Gemini vision analysis completed for "${filename}".`);
      }
    } catch (apiErr) {
      console.warn(`[ImageExtractor] Gemini vision analysis warning for "${filename}":`, apiErr.message);
      warnings.push(`Image vision cloud notice: ${apiErr.message}`);
    }
  }

  // Fallback structured text blocks if both local and API had sparse output
  if (!visualSummary) {
    visualSummary = `[Attached Image: "${filename}" (${sizeKb} KB, format: ${mimeType})]\nThis image is queued for direct visual analysis and interactive visual question answering.`;
  }

  if (textBlocks.length === 0) {
    textBlocks = [
      {
        page: 1,
        section: 'Visual Overview',
        heading: filename,
        text: visualSummary,
      },
      {
        page: 1,
        section: 'Visual Features & Elements',
        heading: 'Visual Breakdown',
        text: `Image "${filename}" ready for inspection. Ask questions about specific subjects, text, objects, or colors.`,
      },
    ];
  }

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType: 'image',
    mimeType,
    size: buffer.length,
    sha256: meta.sha256,
    pageCount: 1,
    textBlocks,
    tables: [],
    warnings,
    isVisionRequired: true,
    rawText: visualSummary,
  });
}
