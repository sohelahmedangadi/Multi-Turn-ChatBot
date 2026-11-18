import { createParsedDocument } from './baseExtractor.js';
import { getGeminiClient, isGeminiCircuitOpen } from '../llmProvider.js';
import { runPythonProcess } from './pythonRunner.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/read_video.py');

/**
 * Runs the local Python video processor (OpenCV + PyAV + Faster-Whisper)
 * via queue-governed, process-group isolated child process runner.
 * @param {string} videoPath
 * @returns {Promise<object|null>}
 */
async function runLocalVideoProcessor(videoPath) {
  try {
    const { parsed } = await runPythonProcess(SCRIPT_PATH, [videoPath], { timeoutMs: 90000 });
    return parsed;
  } catch (err) {
    console.warn('[VideoExtractor] Local processor notice:', err.message);
    return null;
  }
}

/**
 * Video Extractor: Parses video files, performs OpenCV frame extraction,
 * PyAV audio stripping, Faster-Whisper timestamped speech transcription,
 * and Gemini multimodal vision reasoning.
 * 
 * @param {Buffer} buffer
 * @param {object} meta - { fileId, sessionId, filename, fileType, mimeType, sha256, storagePath }
 * @returns {Promise<object>} ParsedDocument
 */
export async function extractVideo(buffer, meta = {}) {
  const filename = meta.filename || 'video.mp4';
  const mimeType = meta.mimeType || 'video/mp4';
  const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
  const warnings = [];

  let videoSummary = '';
  let sceneBlocks = [];
  let localResult = null;

  // 1. Run Local Python Video Processor (OpenCV + PyAV + Faster-Whisper)
  let tempFilePath = null;
  try {
    let targetPath = meta.storagePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      tempFilePath = path.join(os.tmpdir(), `cosmo_vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp4`);
      await fs.promises.writeFile(tempFilePath, buffer);
      targetPath = tempFilePath;
    }

    localResult = await runLocalVideoProcessor(targetPath);
    if (localResult) {
      console.log(`[VideoExtractor] Local processor extracted ${localResult.transcriptSegments?.length || 0} speech segments and ${localResult.keyframesCount || 0} OpenCV frames for "${filename}"`);
      if (localResult.sceneBlocks && localResult.sceneBlocks.length > 0) {
        sceneBlocks = localResult.sceneBlocks;
      }
      if (localResult.summary) {
        videoSummary = localResult.summary;
      }
    }
  } catch (localErr) {
    console.warn(`[VideoExtractor] Local processing fallback notice:`, localErr.message);
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
      console.log(`[VideoExtractor] Querying Gemini multimodal scene analysis for "${filename}" (${sizeMb} MB)...`);
      const ai = getGeminiClient();
      const base64Data = buffer.toString('base64');

      const prompt = `Analyze this video thoroughly and provide a structured breakdown:
1. Executive Summary: What is this video about? Describe the setting, participants, and overall purpose.
2. Chronological Timeline: Break down the video by timestamps (e.g., [00:00 - 00:05], [00:05 - 00:15]) describing specific actions, movements, camera cuts, and visual details.
3. Dialogue & Audio: Note any spoken dialogue, narration, sound effects, or background audio.
4. On-Screen Text & Signage: List any readable text, titles, subtitles, or labels shown in the video.
5. Key Entities: List the key subjects, objects, people, products, or topics featured.`;

      // 45s timeout guard so a slow or rate-limited Gemini call does not hang the pipeline
      let geminiTimer;
      const geminiTimeout = new Promise((_, reject) => {
        geminiTimer = setTimeout(() => reject(new Error('Gemini video analysis timed out after 45s')), 45000);
        if (geminiTimer.unref) geminiTimer.unref();
      });

      const response = await Promise.race([
        ai.models.generateContent({
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
        }),
        geminiTimeout,
      ]).finally(() => clearTimeout(geminiTimer));

      const responseText = response?.text || '';
      if (responseText.trim().length > 20) {
        // Merge or prioritize Gemini's visual overview
        const geminiVisual = responseText.trim();
        if (localResult?.fullTranscript) {
          videoSummary = `${geminiVisual}\n\n=== VERBATIM AUDIO TRANSCRIPT (Whisper) ===\n${localResult.fullTranscript}`;
        } else {
          videoSummary = geminiVisual;
        }

        // Parse timestamped sections if present
        const timestampMatches = responseText.split(/(?=\[\d{2}:\d{2}|\bScene \d+:?|\bTimestamp)/i);
        if (timestampMatches.length > 1) {
          const geminiScenes = timestampMatches.map((block, idx) => {
            const trimmed = block.trim();
            const firstLine = trimmed.split('\n')[0] || `Scene ${idx + 1}`;
            return {
              page: idx + 1,
              section: `Scene ${idx + 1} Visual Timeline`,
              heading: firstLine.substring(0, 60),
              text: trimmed,
            };
          });
          // Combine Gemini visual scenes with Whisper speech scenes
          sceneBlocks = [...geminiScenes, ...sceneBlocks];
        }
        console.log(`[VideoExtractor] Gemini visual analysis completed for "${filename}".`);
      }
    } catch (apiErr) {
      console.warn(`[VideoExtractor] Gemini video analysis warning for "${filename}":`, apiErr.message);
      warnings.push(`Video multimodal cloud notice: ${apiErr.message}`);
    }
  }

  // Fallback structured text blocks if both local and API had sparse output
  if (!videoSummary) {
    videoSummary = `[Attached Video: "${filename}" (${sizeMb} MB, format: ${mimeType})]\nThis video is indexed for direct multimodal scene analysis and temporal question answering.`;
  }

  if (sceneBlocks.length === 0) {
    sceneBlocks = [
      {
        page: 1,
        section: 'Video Overview & Synopsis',
        heading: filename,
        text: videoSummary,
      },
      {
        page: 2,
        section: 'Temporal Scene Timeline',
        heading: 'Timeline & Events',
        text: `Chronological scene breakdown for "${filename}". Use interactive prompts to query specific timestamps, objects, or actions across the video.`,
      },
    ];
  }

  return createParsedDocument({
    fileId: meta.fileId,
    sessionId: meta.sessionId,
    filename,
    fileType: 'video',
    mimeType,
    size: buffer.length,
    sha256: meta.sha256,
    pageCount: sceneBlocks.length,
    textBlocks: sceneBlocks,
    tables: [],
    warnings,
    isVisionRequired: true,
    rawText: videoSummary,
  });
}
