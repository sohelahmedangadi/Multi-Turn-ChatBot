/**
 * Explicit Domain Error Classes for File Analysis Pipeline
 * Each error class provides a clean, user-facing error message.
 */

export class EncryptedPdfError extends Error {
  constructor(message = 'The PDF document is encrypted or password-protected and cannot be parsed. Please upload an unprotected file.') {
    super(message);
    this.name = 'EncryptedPdfError';
    this.code = 'ENCRYPTED_PDF';
    this.userMessage = message;
  }
}

export class CorruptFileError extends Error {
  constructor(message = 'The file appears to be corrupted, unreadable, or contains invalid headers.') {
    super(message);
    this.name = 'CorruptFileError';
    this.code = 'CORRUPT_FILE';
    this.userMessage = message;
  }
}

export class EmptyDocumentError extends Error {
  constructor(message = 'The document contains no readable text or substantive content.') {
    super(message);
    this.name = 'EmptyDocumentError';
    this.code = 'EMPTY_DOCUMENT';
    this.userMessage = message;
  }
}

export class UnsupportedTypeError extends Error {
  constructor(message = 'Unsupported file type. Accepted formats: .pdf, .docx, .txt, .md, .csv, .xlsx, .json, .png, .jpg.') {
    super(message);
    this.name = 'UnsupportedTypeError';
    this.code = 'UNSUPPORTED_TYPE';
    this.userMessage = message;
  }
}

export class ExtractionTimeoutError extends Error {
  constructor(message = 'Document extraction exceeded the allowable execution timeout (15s).') {
    super(message);
    this.name = 'ExtractionTimeoutError';
    this.code = 'EXTRACTION_TIMEOUT';
    this.userMessage = message;
  }
}

export class FileContextBudgetExceededError extends Error {
  constructor(message = 'The document text exceeds the allowable conversational context token budget.') {
    super(message);
    this.name = 'FileContextBudgetExceededError';
    this.code = 'CONTEXT_BUDGET_EXCEEDED';
    this.userMessage = message;
  }
}

export class OcrUnavailableError extends Error {
  constructor(message = 'Scanned PDF detected, but OCR processing is currently unavailable. Please upload a digital text document.') {
    super(message);
    this.name = 'OcrUnavailableError';
    this.code = 'OCR_UNAVAILABLE';
    this.userMessage = message;
  }
}

export class SessionFileCapExceededError extends Error {
  constructor(message = 'The maximum number of attached files for this session has been reached.') {
    super(message);
    this.name = 'SessionFileCapExceededError';
    this.code = 'SESSION_CAP_EXCEEDED';
    this.userMessage = message;
  }
}

export class FileSizeExceededError extends Error {
  constructor(message = 'The uploaded file exceeds the maximum allowed file size (20MB).') {
    super(message);
    this.name = 'FileSizeExceededError';
    this.code = 'FILE_SIZE_EXCEEDED';
    this.userMessage = message;
  }
}

export class ZipBombError extends Error {
  constructor(message = 'The archive exceeds safety decompression limits (50MB max uncompressed size, 100:1 ratio, or 500 entry limit).') {
    super(message);
    this.name = 'ZipBombError';
    this.code = 'ZIP_BOMB_DETECTED';
    this.userMessage = message;
  }
}

export class PolyglotFileError extends CorruptFileError {
  constructor(message = 'Polyglot or mismatched file type detected. File extension, declared MIME type, and binary magic bytes must strictly agree.') {
    super(message);
    this.name = 'PolyglotFileError';
    this.code = 'POLYGLOT_FILE_DETECTED';
    this.userMessage = message;
  }
}

export class DecompressionBombError extends Error {
  constructor(message = 'Image decompression bomb detected. Image resolution, total pixels, or dimensions exceed safety limits.') {
    super(message);
    this.name = 'DecompressionBombError';
    this.code = 'DECOMPRESSION_BOMB_DETECTED';
    this.userMessage = message;
  }
}

export class MediaLimitExceededError extends Error {
  constructor(message = 'Media duration, resolution, or frame count exceeds allowable limits.') {
    super(message);
    this.name = 'MediaLimitExceededError';
    this.code = 'MEDIA_LIMIT_EXCEEDED';
    this.userMessage = message;
  }
}

export class UserQuotaExceededError extends Error {
  constructor(message = 'User daily upload quota exceeded (max files or bytes per day reached). Please try again tomorrow.') {
    super(message);
    this.name = 'UserQuotaExceededError';
    this.code = 'USER_QUOTA_EXCEEDED';
    this.userMessage = message;
  }
}
