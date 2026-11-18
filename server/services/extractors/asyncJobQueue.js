import { db } from '../../db/store.js';
import { runExtractionInWorker } from './workerPool.js';
import { indexDocument } from '../ragService.js';
import { computeSha256, storeRawFile, detectFileTypeAndValidate } from './fileValidator.js';

/**
 * Processes a single file extraction and indexing job
 * @param {object} jobData
 */
async function processFileJob(jobData) {
  const { jobId, fileId, sessionId, userId, filename, buffer, mimeType } = jobData;

  try {
    // 1. Update job to processing
    await db.updateFileJobStatus(jobId, 'processing', { progress: 10 });

    // 2. Validate by magic bytes and compute sha256
    const validation = detectFileTypeAndValidate(buffer, filename, mimeType);
    const sha256 = computeSha256(buffer);

    await db.updateFileJobStatus(jobId, 'processing', { progress: 25 });

    let parsedDoc = null;

    // 3. User-Scoped SHA-256 Deduplication Check
    const cachedParse = await db.getParsedDocumentCache(userId, sha256);
    if (cachedParse) {
      console.log(`[Dedup] Reusing cached extraction for file "${filename}" (sha256: ${sha256.substring(0, 8)}...) for user ${userId}`);
      // Clone parsed document structure with new fileId and sessionId
      parsedDoc = {
        ...cachedParse,
        file_id: fileId,
        session_id: sessionId,
        filename,
        metadata: {
          ...cachedParse.metadata,
          file_id: fileId,
          session_id: sessionId,
          filename,
        },
      };
    } else {
      // 4. Run Extraction in Worker Thread with hard watchdog timeout
      const meta = {
        fileId,
        sessionId,
        userId,
        filename,
        fileType: validation.fileType,
        mimeType: validation.mimeType,
        sha256,
      };

      await db.updateFileJobStatus(jobId, 'processing', { progress: 40 });
      parsedDoc = await runExtractionInWorker(buffer, meta);
    }

    await db.updateFileJobStatus(jobId, 'processing', { progress: 75 });

    // 5. Store raw file to disk outside web root under generated fileId
    const storagePath = await storeRawFile(fileId, buffer);
    parsedDoc.metadata.storagePath = storagePath;

    // 6. Index into RAG vector and keyword store, namespaced to sessionId
    const indexed = await indexDocument(fileId, parsedDoc, sessionId, userId);

    // 7. Mark job as completed
    await db.updateFileJobStatus(jobId, 'completed', {
      progress: 100,
      document: indexed,
    });

    console.log(`[JobQueue] Successfully indexed file "${filename}" (${indexed.totalChunks} chunks) for session ${sessionId}`);
  } catch (err) {
    console.error(`[JobQueue] Error processing job ${jobId} for file ${filename}:`, err);
    await db.updateFileJobStatus(jobId, 'failed', {
      progress: 100,
      error: err.userMessage || err.message || 'File processing failed.',
    });
  }
}

/**
 * Enqueues an async file extraction job and triggers processing
 * @param {object} params
 * @returns {Promise<object>} Created Job record
 */
export async function enqueueFileJob({ fileId, sessionId, userId, filename, buffer, mimeType }) {
  const jobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  const job = {
    jobId,
    fileId,
    sessionId,
    userId: userId || 'guest-user-default',
    filename,
    status: 'pending',
    progress: 0,
    error: null,
  };

  await db.saveFileJob(job);

  // Trigger async worker in background with catch handler
  setImmediate(() => {
    processFileJob({ jobId, fileId, sessionId, userId, filename, buffer, mimeType }).catch((err) => {
      console.error(`[JobQueue] Unhandled rejection in processFileJob for ${filename}:`, err);
    });
  });

  return job;
}

/**
 * Retrieves status of a file extraction job
 * @param {string} jobId
 */
export async function getJobStatus(jobId) {
  return await db.getFileJob(jobId);
}
