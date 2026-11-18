import { UnsupportedTypeError } from './errors.js';

/**
 * Routes buffer to appropriate dedicated extractor based on detected fileType.
 * Uses dynamic imports to decouple extractors and avoid circular imports in worker threads.
 * 
 * @param {Buffer} buffer
 * @param {object} meta - { fileId, sessionId, filename, fileType, mimeType, sha256 }
 * @returns {Promise<object>} ParsedDocument
 */
export async function routeExtraction(buffer, meta = {}) {
  const fileType = meta.fileType || 'text';

  switch (fileType) {
    case 'pdf': {
      const { extractPdf } = await import('./pdfExtractor.js');
      return await extractPdf(buffer, meta);
    }
    case 'docx': {
      const { extractDocx } = await import('./docxExtractor.js');
      return await extractDocx(buffer, meta);
    }
    case 'csv':
    case 'xlsx': {
      const { extractCsv } = await import('./sheetExtractor.js');
      return await extractCsv(buffer, meta);
    }
    case 'image': {
      const { extractImage } = await import('./imageExtractor.js');
      return await extractImage(buffer, meta);
    }
    case 'video': {
      const { extractVideo } = await import('./videoExtractor.js');
      return await extractVideo(buffer, meta);
    }
    case 'text':
    case 'markdown':
    case 'json': {
      const { extractText } = await import('./textExtractor.js');
      return await extractText(buffer, meta);
    }
    default:
      throw new UnsupportedTypeError(`Unsupported file type "${fileType}".`);
  }
}
