import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ExtractionTimeoutError,
  EncryptedPdfError,
  CorruptFileError,
  EmptyDocumentError,
  UnsupportedTypeError,
  OcrUnavailableError,
  ZipBombError,
} from './errors.js';
import { routeExtraction } from './extractorRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerScriptPath = path.join(__dirname, 'extractorWorker.js');

const DEFAULT_TIMEOUT_MS = Number(process.env.EXTRACTION_TIMEOUT_MS) || 15000;
const DEFAULT_MAX_WORKERS = Number(process.env.MAX_CONCURRENT_WORKERS || process.env.WORKER_CONCURRENCY) || 4;

const DEFAULT_MAX_OLD_GEN_MB =
  Number(process.env.WORKER_MAX_OLD_GEN_MB || process.env.WORKER_MAX_OLD_GENERATION_SIZE_MB) || 512;
const DEFAULT_MAX_YOUNG_GEN_MB =
  Number(process.env.WORKER_MAX_YOUNG_GEN_MB || process.env.WORKER_MAX_YOUNG_GENERATION_SIZE_MB) || 128;

let activeWorkersCount = 0;
const workerQueue = [];

export function getActiveWorkerCount() {
  return activeWorkersCount;
}

export function getWorkerQueueLength() {
  return workerQueue.length;
}

function reconstructError(errObj) {
  if (!errObj) return new Error('Unknown extraction failure.');
  switch (errObj.name) {
    case 'EncryptedPdfError':
      return new EncryptedPdfError(errObj.message);
    case 'CorruptFileError':
      return new CorruptFileError(errObj.message);
    case 'EmptyDocumentError':
      return new EmptyDocumentError(errObj.message);
    case 'UnsupportedTypeError':
      return new UnsupportedTypeError(errObj.message);
    case 'OcrUnavailableError':
      return new OcrUnavailableError(errObj.message);
    case 'ZipBombError':
      return new ZipBombError(errObj.message);
    case 'ExtractionTimeoutError':
      return new ExtractionTimeoutError(errObj.message);
    default: {
      const err = new Error(errObj.message);
      err.name = errObj.name;
      err.code = errObj.code;
      return err;
    }
  }
}

/**
 * Awaits worker termination and logs any termination errors without swallowing them silently.
 * @param {Worker} worker
 */
async function terminateWorker(worker) {
  if (!worker) return;
  try {
    await worker.terminate();
  } catch (termErr) {
    console.error('[WorkerPool] Error awaiting worker termination:', termErr?.message || termErr);
  }
}

/**
 * Executes a single job in an isolated worker thread with single settle guard,
 * resourceLimits, and buffer transfer list.
 */
function executeWorkerThread(buffer, meta, timeoutMs, options = {}) {
  return new Promise((resolve, reject) => {
    let isSettled = false;

    const maxOldGenerationSizeMb =
      Number(options?.resourceLimits?.maxOldGenerationSizeMb) ||
      Number(process.env.WORKER_MAX_OLD_GEN_MB || process.env.WORKER_MAX_OLD_GENERATION_SIZE_MB) ||
      DEFAULT_MAX_OLD_GEN_MB;

    const maxYoungGenerationSizeMb =
      Number(options?.resourceLimits?.maxYoungGenerationSizeMb) ||
      Number(process.env.WORKER_MAX_YOUNG_GEN_MB || process.env.WORKER_MAX_YOUNG_GENERATION_SIZE_MB) ||
      DEFAULT_MAX_YOUNG_GEN_MB;

    const targetScriptPath = options?.workerScriptPath || workerScriptPath;

    let worker;
    try {
      worker = new Worker(targetScriptPath, {
        resourceLimits: {
          maxOldGenerationSizeMb,
          maxYoungGenerationSizeMb,
        },
      });
    } catch (spawnErr) {
      return reject(new CorruptFileError(`Worker thread spawn error: ${spawnErr?.message || spawnErr}`));
    }

    const timer = setTimeout(async () => {
      await settle(
        'reject',
        new ExtractionTimeoutError(`Extraction timed out after ${timeoutMs}ms.`)
      );
    }, timeoutMs);

    if (timer.unref) timer.unref();

    const settle = async (action, arg) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      await terminateWorker(worker);
      if (action === 'resolve') {
        resolve(arg);
      } else {
        reject(arg);
      }
    };

    worker.on('message', async (response) => {
      if (isSettled) return;
      if (response && response.success) {
        await settle('resolve', response.parsedDocument);
      } else {
        await settle('reject', reconstructError(response?.error));
      }
    });

    worker.on('error', async (err) => {
      if (isSettled) return;
      await settle(
        'reject',
        new CorruptFileError(`Worker thread error: ${err?.message || err}`)
      );
    });

    worker.on('exit', async (exitCode) => {
      if (isSettled) return;
      if (exitCode !== 0) {
        await settle(
          'reject',
          new CorruptFileError(`Extraction worker stopped unexpectedly with exit code ${exitCode}.`)
        );
      } else {
        await settle('resolve', null);
      }
    });

    // Transfer buffer with transferList instead of structured clone copying
    let payloadBuffer = buffer;
    let transferList = [];

    if (Buffer.isBuffer(buffer)) {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      payloadBuffer = arrayBuffer;
      transferList = [arrayBuffer];
    } else if (buffer instanceof ArrayBuffer) {
      payloadBuffer = buffer;
      transferList = [buffer];
    } else if (buffer?.buffer instanceof ArrayBuffer) {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      payloadBuffer = arrayBuffer;
      transferList = [arrayBuffer];
    }

    try {
      worker.postMessage({ buffer: payloadBuffer, meta }, transferList);
    } catch (postErr) {
      settle('reject', new CorruptFileError(`Worker postMessage error: ${postErr?.message || postErr}`));
    }
  });
}

/**
 * Processes queued worker extraction jobs respecting concurrency limits
 */
function processNextWorkerQueue() {
  const maxWorkers = Number(process.env.MAX_CONCURRENT_WORKERS || process.env.WORKER_CONCURRENCY) || DEFAULT_MAX_WORKERS;
  while (workerQueue.length > 0 && activeWorkersCount < maxWorkers) {
    const nextJob = workerQueue.shift();
    if (!nextJob) break;

    activeWorkersCount++;
    executeWorkerThread(nextJob.buffer, nextJob.meta, nextJob.timeoutMs, nextJob.options)
      .then(nextJob.resolve)
      .catch(nextJob.reject)
      .finally(() => {
        activeWorkersCount--;
        processNextWorkerQueue();
      });
  }
}

/**
 * Executes document extraction inside an isolated worker thread with watchdog termination,
 * concurrency queueing, buffer transfer, and memory resourceLimits.
 * 
 * @param {Buffer} buffer - File buffer
 * @param {object} meta - File metadata
 * @param {number} timeoutMs - Watchdog timeout in milliseconds
 * @param {object} options - Optional configuration { workerScriptPath, resourceLimits }
 * @returns {Promise<object>} ParsedDocument
 */
export async function runExtractionInWorker(buffer, meta, timeoutMs = DEFAULT_TIMEOUT_MS, options = {}) {
  // For PDFs (native C++ canvas) and media files (images/videos that call multimodal APIs),
  // execute safely in-process with a strict watchdog timeout promise.
  if (meta?.fileType === 'pdf' || meta?.fileType === 'image' || meta?.fileType === 'video') {
    const effectiveTimeout =
      meta?.fileType === 'video'
        ? Math.max(timeoutMs, 120000)
        : meta?.fileType === 'image'
        ? Math.max(timeoutMs, 60000)
        : timeoutMs;
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new ExtractionTimeoutError(`Extraction timed out after ${effectiveTimeout}ms.`));
      }, effectiveTimeout);
      if (timer.unref) timer.unref();
    });

    try {
      const parsed = await Promise.race([
        routeExtraction(buffer, meta),
        timeoutPromise,
      ]);
      clearTimeout(timer);
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    workerQueue.push({
      buffer,
      meta,
      timeoutMs,
      options,
      resolve,
      reject,
    });
    processNextWorkerQueue();
  });
}
