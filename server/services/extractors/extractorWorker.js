import { parentPort } from 'worker_threads';
import { routeExtraction } from './extractorRouter.js';

if (parentPort) {
  process.on('uncaughtException', (err) => {
    try {
      parentPort.postMessage({
        success: false,
        error: {
          name: err?.name || 'Error',
          message: err?.message || String(err),
          code: 'UNCAUGHT_WORKER_EXCEPTION',
        },
      });
    } catch {}
  });

  process.on('unhandledRejection', (reason) => {
    try {
      parentPort.postMessage({
        success: false,
        error: {
          name: 'UnhandledRejection',
          message: reason?.message || String(reason),
          code: 'UNHANDLED_WORKER_REJECTION',
        },
      });
    } catch {}
  });

  parentPort.once('message', async ({ buffer, meta }) => {
    try {
      // Reconstruct buffer if transferred as Uint8Array
      const effectiveBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      const parsedDocument = await routeExtraction(effectiveBuffer, meta);
      parentPort.postMessage({ success: true, parsedDocument });
    } catch (err) {
      parentPort.postMessage({
        success: false,
        error: {
          name: err?.name || 'Error',
          message: err?.message || String(err),
          code: err?.code || 'EXTRACTION_FAILED',
        },
      });
    } finally {
      try {
        parentPort.close();
      } catch {}
    }
  });
}
