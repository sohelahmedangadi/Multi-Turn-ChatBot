import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  CorruptFileError,
  EmptyDocumentError,
  UnsupportedTypeError,
  FileSizeExceededError,
  SessionFileCapExceededError,
  ZipBombError,
  PolyglotFileError,
  DecompressionBombError,
  MediaLimitExceededError,
  UserQuotaExceededError,
} from './errors.js';

export {
  CorruptFileError,
  EmptyDocumentError,
  UnsupportedTypeError,
  FileSizeExceededError,
  SessionFileCapExceededError,
  ZipBombError,
  PolyglotFileError,
  DecompressionBombError,
  MediaLimitExceededError,
  UserQuotaExceededError,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory outside web root
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads_storage');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Limits and caps
export const MAX_FILE_SIZE_BYTES =
  Number(process.env.MAX_FILE_SIZE_BYTES) || 20 * 1024 * 1024; // 20 MB
export const SESSION_FILE_CAP =
  Number(process.env.SESSION_FILE_CAP) || 10;
export const MAX_UNCOMPRESSED_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_ZIP_ENTRIES = 500;
export const MAX_ZIP_COMPRESSION_RATIO = 100; // 100:1 max ratio

export const MAX_IMAGE_WIDTH = 8192;
export const MAX_IMAGE_HEIGHT = 8192;
export const MAX_IMAGE_PIXELS = 25000000; // 25 Megapixels

export const MAX_VIDEO_DURATION_SECONDS = 1800; // 30 minutes

export const MAX_DAILY_UPLOADS_PER_USER =
  Number(process.env.MAX_DAILY_UPLOADS_PER_USER) || 50; // 50 files/day
export const MAX_DAILY_BYTES_PER_USER =
  Number(process.env.MAX_DAILY_BYTES_PER_USER) || 100 * 1024 * 1024; // 100 MB/day

export const NESTED_ARCHIVE_REGEX =
  /\.(zip|tar|gz|bz2|7z|rar|xz|tgz|cab|iso|apk|jar|war|ear)$/i;

// In-memory per-user upload quota store
const userUploadQuotas = new Map();

/**
 * Checks if a user has exceeded their daily file count or byte volume quota
 * @param {string} userId
 * @param {number} incomingBytes
 */
export function checkUserUploadQuota(userId = 'guest-user-default', incomingBytes = 0) {
  const now = Date.now();
  let quota = userUploadQuotas.get(userId);

  if (!quota || now >= quota.resetAt) {
    quota = {
      filesCount: 0,
      bytesTotal: 0,
      resetAt: now + 24 * 60 * 60 * 1000,
    };
    userUploadQuotas.set(userId, quota);
  }

  if (quota.filesCount + 1 > MAX_DAILY_UPLOADS_PER_USER) {
    throw new UserQuotaExceededError(
      `Daily upload file count quota exceeded (${MAX_DAILY_UPLOADS_PER_USER} files/day). Please try again tomorrow.`
    );
  }

  if (quota.bytesTotal + incomingBytes > MAX_DAILY_BYTES_PER_USER) {
    throw new UserQuotaExceededError(
      `Daily upload volume quota exceeded (${(MAX_DAILY_BYTES_PER_USER / (1024 * 1024)).toFixed(0)}MB/day). Please try again tomorrow.`
    );
  }

  return true;
}

/**
 * Records upload usage for a user
 * @param {string} userId
 * @param {number} incomingBytes
 */
export function recordUserUploadUsage(userId = 'guest-user-default', incomingBytes = 0) {
  const now = Date.now();
  let quota = userUploadQuotas.get(userId);

  if (!quota || now >= quota.resetAt) {
    quota = {
      filesCount: 0,
      bytesTotal: 0,
      resetAt: now + 24 * 60 * 60 * 1000,
    };
    userUploadQuotas.set(userId, quota);
  }

  quota.filesCount += 1;
  quota.bytesTotal += incomingBytes;
}

/**
 * Resets user upload quotas (useful for tests and daily maintenance)
 */
export function resetUserUploadQuotas() {
  userUploadQuotas.clear();
}

/**
 * Computes SHA-256 hex digest of buffer
 */
export function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sanitizes incoming filename:
 * - Strips directory traversal (../../etc/passwd -> passwd)
 * - Normalizes slashes and takes basename
 * - Strips control characters (0x00-0x1F, 0x7F)
 * - Strips Unicode Bidi directional override characters (\u202A-\u202E, \u2066-\u2069, \u200E, \u200F, \u061C)
 * - Retains clean characters, dots, and safe extension
 */
export function sanitizeFilename(rawFilename = 'document.txt') {
  if (typeof rawFilename !== 'string' || !rawFilename.trim()) {
    return 'uploaded_document.bin';
  }

  // Strip Unicode Bidi override characters
  let cleaned = rawFilename.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g, '');

  // Strip control characters (NUL, newline, carriage return, tabs, etc.)
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  // Normalize backslashes to forward slashes
  cleaned = cleaned.replace(/\\/g, '/');

  // Strip path traversal components
  cleaned = cleaned.replace(/(\.\.[\/\\])+/g, '');

  // Take the final basename component
  const lastSlash = cleaned.lastIndexOf('/');
  if (lastSlash !== -1) {
    cleaned = cleaned.substring(lastSlash + 1);
  }

  // Remove leading dots or spaces
  cleaned = cleaned.replace(/^[.\s]+/, '');

  // Replace unsafe characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9._\- ]/g, '_').trim();

  return cleaned || 'uploaded_document.bin';
}

/**
 * Validates zip archive headers and checks for zip-bomb limits:
 * - Max 500 entries
 * - Max total uncompressed size (50MB)
 * - Max single entry uncompressed size (30MB)
 * - Max compression ratio per entry (100:1 for entries > 64KB)
 * - Nested-archive rejection
 * Inspects while streaming local and central headers; never fully inflates first.
 * @param {Buffer} buffer
 * @returns {{ entryCount: number, uncompressedSize: number, entries: string[], isDocx: boolean, isXlsx: boolean }}
 */
export function inspectZipArchive(buffer) {
  if (buffer.length < 22) {
    throw new CorruptFileError('File is too small to be a valid ZIP/DOCX/XLSX archive.');
  }

  // Check magic bytes PK..
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new CorruptFileError('Archive does not have valid ZIP magic bytes.');
  }

  let entryCount = 0;
  let uncompressedSize = 0;
  const entries = [];

  // Parse local headers (0x04034b50)
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x04034b50) {
      entryCount++;
      if (entryCount > MAX_ZIP_ENTRIES) {
        throw new ZipBombError(`Archive exceeds maximum entry count limit (${MAX_ZIP_ENTRIES}).`);
      }

      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const nameStart = offset + 30;
      let name = '';
      if (nameStart + fileNameLen <= buffer.length) {
        name = buffer.toString('utf-8', nameStart, nameStart + fileNameLen);
        entries.push(name);
      }

      // 1. Nested-archive rejection
      if (NESTED_ARCHIVE_REGEX.test(name)) {
        throw new ZipBombError(`Nested archive "${name}" is not permitted within compressed packages.`);
      }

      // 2. Single entry uncompressed size cap
      if (uncompSize > MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Entry "${name}" uncompressed size of ${(uncompSize / (1024 * 1024)).toFixed(1)}MB exceeds single entry limit of ${MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES / (1024 * 1024)}MB.`
        );
      }

      // 3. Max compression ratio per entry (for entries > 64KB)
      if (uncompSize > 64 * 1024) {
        const ratio = compressedSize > 0 ? uncompSize / compressedSize : uncompSize;
        if (ratio > MAX_ZIP_COMPRESSION_RATIO) {
          throw new ZipBombError(
            `Entry "${name}" compression ratio (${Math.round(ratio)}:1) exceeds maximum allowed ratio of ${MAX_ZIP_COMPRESSION_RATIO}:1. Potential zip bomb detected.`
          );
        }
      }

      uncompressedSize += uncompSize;
      if (uncompressedSize > MAX_UNCOMPRESSED_ZIP_BYTES) {
        throw new ZipBombError(
          `Archive exceeds maximum total uncompressed size limit (${MAX_UNCOMPRESSED_ZIP_BYTES / (1024 * 1024)}MB).`
        );
      }

      if (compressedSize > 0) {
        offset = nameStart + fileNameLen + extraLen + compressedSize;
      } else {
        // Handle empty or data-descriptor entries
        offset = nameStart + fileNameLen + extraLen;
        const nextSig = buffer.indexOf(Buffer.from([0x50, 0x4b]), offset);
        if (nextSig !== -1) {
          offset = nextSig;
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  // Also verify Central Directory headers (0x02014b50) to catch archives using data-descriptors
  let cdOffset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  let cdEntryCount = 0;
  let cdUncompressedTotal = 0;

  while (cdOffset !== -1 && cdOffset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(cdOffset) === 0x02014b50) {
      cdEntryCount++;
      if (cdEntryCount > MAX_ZIP_ENTRIES) {
        throw new ZipBombError(`Archive exceeds maximum entry count limit (${MAX_ZIP_ENTRIES}).`);
      }

      const cdCompSize = buffer.readUInt32LE(cdOffset + 20);
      const cdUncompSize = buffer.readUInt32LE(cdOffset + 24);
      const cdNameLen = buffer.readUInt16LE(cdOffset + 28);
      const cdExtraLen = buffer.readUInt16LE(cdOffset + 30);
      const cdCommentLen = buffer.readUInt16LE(cdOffset + 32);
      const cdName = buffer.toString('utf-8', cdOffset + 46, cdOffset + 46 + cdNameLen);

      if (NESTED_ARCHIVE_REGEX.test(cdName)) {
        throw new ZipBombError(`Nested archive "${cdName}" is not permitted within compressed packages.`);
      }

      if (cdUncompSize > MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES) {
        throw new ZipBombError(
          `Entry "${cdName}" uncompressed size of ${(cdUncompSize / (1024 * 1024)).toFixed(1)}MB exceeds single entry limit of ${MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES / (1024 * 1024)}MB.`
        );
      }

      if (cdUncompSize > 64 * 1024) {
        const ratio = cdCompSize > 0 ? cdUncompSize / cdCompSize : cdUncompSize;
        if (ratio > MAX_ZIP_COMPRESSION_RATIO) {
          throw new ZipBombError(
            `Entry "${cdName}" compression ratio (${Math.round(ratio)}:1) exceeds maximum allowed ratio of ${MAX_ZIP_COMPRESSION_RATIO}:1. Potential zip bomb detected.`
          );
        }
      }

      cdUncompressedTotal += cdUncompSize;
      if (cdUncompressedTotal > MAX_UNCOMPRESSED_ZIP_BYTES) {
        throw new ZipBombError(
          `Archive exceeds maximum total uncompressed size limit (${MAX_UNCOMPRESSED_ZIP_BYTES / (1024 * 1024)}MB).`
        );
      }

      if (!entries.includes(cdName)) {
        entries.push(cdName);
      }

      cdOffset = cdOffset + 46 + cdNameLen + cdExtraLen + cdCommentLen;
    } else {
      break;
    }
  }

  const isDocx = entries.some((e) => e.startsWith('word/') || e.includes('word/document.xml'));
  const isXlsx = entries.some((e) => e.startsWith('xl/') || e.includes('xl/workbook.xml'));

  return { entryCount: Math.max(entryCount, cdEntryCount), uncompressedSize: Math.max(uncompressedSize, cdUncompressedTotal), entries, isDocx, isXlsx };
}

/**
 * Inspects image headers directly to detect decompression bombs before memory allocation or OCR
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, totalPixels: number } | null}
 */
export function inspectImageDimensions(buffer) {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const totalPixels = width * height;
    if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || totalPixels > MAX_IMAGE_PIXELS) {
      throw new DecompressionBombError(
        `PNG dimensions ${width}x${height} (${totalPixels} pixels) exceed safety limits (max ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}, ${MAX_IMAGE_PIXELS} pixels). Potential decompression bomb.`
      );
    }
    return { width, height, totalPixels };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Baseline / Progressive SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (offset + 9 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          const totalPixels = width * height;
          if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || totalPixels > MAX_IMAGE_PIXELS) {
            throw new DecompressionBombError(
              `JPEG dimensions ${width}x${height} (${totalPixels} pixels) exceed safety limits (max ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}, ${MAX_IMAGE_PIXELS} pixels).`
            );
          }
          return { width, height, totalPixels };
        }
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer.length >= 10 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    const totalPixels = width * height;
    if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || totalPixels > MAX_IMAGE_PIXELS) {
      throw new DecompressionBombError(
        `GIF dimensions ${width}x${height} exceed safety limits (max ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}).`
      );
    }
    return { width, height, totalPixels };
  }

  return null;
}

/**
 * Inspects MP4 / MOV container headers to extract video duration from mvhd atom
 * Rejects videos exceeding MAX_VIDEO_DURATION_SECONDS before transcription starts.
 * @param {Buffer} buffer
 * @returns {{ durationSec: number, timescale: number } | null}
 */
export function inspectMp4Duration(buffer) {
  const mvhdIdx = buffer.indexOf(Buffer.from('mvhd', 'ascii'));
  if (mvhdIdx === -1 || mvhdIdx + 28 > buffer.length) {
    return null;
  }

  const version = buffer.readUInt8(mvhdIdx + 4);
  let timescale = 0;
  let duration = 0;

  if (version === 0) {
    timescale = buffer.readUInt32BE(mvhdIdx + 16);
    duration = buffer.readUInt32BE(mvhdIdx + 20);
  } else if (version === 1 && mvhdIdx + 36 <= buffer.length) {
    timescale = buffer.readUInt32BE(mvhdIdx + 24);
    const high = buffer.readUInt32BE(mvhdIdx + 28);
    const low = buffer.readUInt32BE(mvhdIdx + 32);
    duration = high * 4294967296 + low;
  }

  if (timescale > 0 && duration > 0) {
    const durationSec = duration / timescale;
    if (durationSec > MAX_VIDEO_DURATION_SECONDS) {
      throw new MediaLimitExceededError(
        `Video duration of ${Math.round(durationSec)}s exceeds maximum allowed limit of ${MAX_VIDEO_DURATION_SECONDS}s (30 minutes).`
      );
    }
    return { durationSec, timescale };
  }

  return null;
}

/**
 * Validates file buffer by magic bytes, checks for polyglot files, enforces size and quota caps
 * @param {Buffer} buffer
 * @param {string} declaredFilename
 * @param {string} declaredMimeType
 * @returns {{ fileType: string, mimeType: string }}
 */
export function detectFileTypeAndValidate(buffer, declaredFilename = '', declaredMimeType = '') {
  if (!buffer || buffer.length === 0) {
    throw new EmptyDocumentError('Uploaded file is completely empty (0 bytes).');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new FileSizeExceededError(`File size of ${(buffer.length / (1024 * 1024)).toFixed(2)}MB exceeds 20MB limit.`);
  }

  const ext = path.extname(declaredFilename).toLowerCase();

  // 1. Check for Executable Binary Headers (MZ, ELF, Mach-O)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new PolyglotFileError('Executable binary header detected (MZ/PE). Executables cannot be uploaded.');
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    throw new PolyglotFileError('Executable binary header detected (ELF). Executables cannot be uploaded.');
  }
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && buffer[3] === 0xce) ||
     (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe))
  ) {
    throw new PolyglotFileError('Executable binary header detected (Mach-O). Executables cannot be uploaded.');
  }

  // 2. Polyglot PDF/ZIP Check: Simultaneous PDF and ZIP signatures
  const hasPdfSig =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d; // %PDF-
  const hasZipSig =
    buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04])) !== -1 ||
    buffer.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) !== -1;

  if (hasPdfSig && hasZipSig) {
    throw new PolyglotFileError('Polyglot PDF/ZIP hybrid detected. Simultaneous PDF and ZIP signatures are prohibited.');
  }

  // 3. PDF Validation
  if (hasPdfSig) {
    if (ext && ext !== '.pdf') {
      throw new PolyglotFileError(`File has PDF binary header but declared extension is "${ext}".`);
    }
    if (declaredMimeType && declaredMimeType !== 'application/pdf' && declaredMimeType !== 'application/octet-stream') {
      throw new PolyglotFileError(`File has PDF binary header but declared MIME type is "${declaredMimeType}".`);
    }
    return { fileType: 'pdf', mimeType: 'application/pdf' };
  }

  // If declared extension is .pdf but does not have PDF magic
  if (ext === '.pdf') {
    throw new PolyglotFileError('File declared as PDF but does not contain valid PDF header (%PDF-).');
  }

  // 4. Image Validation: PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (ext && ext !== '.png') {
      throw new PolyglotFileError(`File has PNG binary header but declared extension is "${ext}".`);
    }
    inspectImageDimensions(buffer);
    return { fileType: 'image', mimeType: 'image/png' };
  }

  if (ext === '.png') {
    throw new PolyglotFileError('File declared as PNG but does not contain valid PNG magic bytes.');
  }

  // 5. Image Validation: JPEG
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    if (ext && ext !== '.jpg' && ext !== '.jpeg') {
      throw new PolyglotFileError(`File has JPEG binary header but declared extension is "${ext}".`);
    }
    inspectImageDimensions(buffer);
    return { fileType: 'image', mimeType: 'image/jpeg' };
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    throw new PolyglotFileError('File declared as JPEG but does not contain valid JPEG magic bytes.');
  }

  // 6. Image Validation: WebP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { fileType: 'image', mimeType: 'image/webp' };
  }

  // 7. Image Validation: GIF
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    inspectImageDimensions(buffer);
    return { fileType: 'image', mimeType: 'image/gif' };
  }

  // 8. Video Validation: MP4 / MOV (ftyp, moov, mdat)
  if (
    buffer.length >= 8 &&
    ((buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) ||
     (buffer[4] === 0x6d && buffer[5] === 0x6f && buffer[6] === 0x6f && buffer[7] === 0x76) ||
     (buffer[4] === 0x6d && buffer[5] === 0x64 && buffer[6] === 0x61 && buffer[7] === 0x74))
  ) {
    // Check video duration metadata header
    inspectMp4Duration(buffer);
    const isMov = ext === '.mov' || declaredMimeType === 'video/quicktime';
    return {
      fileType: 'video',
      mimeType: isMov ? 'video/quicktime' : 'video/mp4',
    };
  }

  // 9. Video: WebM / MKV
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    const isMkv = ext === '.mkv' || declaredMimeType === 'video/x-matroska';
    return {
      fileType: 'video',
      mimeType: isMkv ? 'video/x-matroska' : 'video/webm',
    };
  }

  // 10. Video: AVI
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x41 &&
    buffer[9] === 0x56 &&
    buffer[10] === 0x49 &&
    buffer[11] === 0x20
  ) {
    return { fileType: 'video', mimeType: 'video/x-msvideo' };
  }

  // 11. ZIP Containers: DOCX or XLSX
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    const zipInfo = inspectZipArchive(buffer);
    if (zipInfo.isDocx) {
      if (ext && ext !== '.docx') {
        throw new PolyglotFileError(`File has Word Document (DOCX) structure but declared extension is "${ext}".`);
      }
      return { fileType: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    if (zipInfo.isXlsx) {
      if (ext && ext !== '.xlsx') {
        throw new PolyglotFileError(`File has Excel (XLSX) structure but declared extension is "${ext}".`);
      }
      return { fileType: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    if (ext === '.docx') {
      return { fileType: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    if (ext === '.xlsx') {
      return { fileType: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    throw new UnsupportedTypeError('Generic ZIP archives without DOCX/XLSX structure are not supported.');
  }

  if (ext === '.docx' || ext === '.xlsx') {
    throw new PolyglotFileError(`File declared as ${ext.toUpperCase()} but is not a valid OpenXML package.`);
  }

  // 12. Text-like types (CSV, MD, TXT, JSON):
  // Must have no NUL bytes and must be strictly valid UTF-8
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x00) {
      throw new CorruptFileError('File contains unreadable binary data or NUL bytes (0x00).');
    }
  }

  let textContent = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    textContent = decoder.decode(buffer);
  } catch {
    throw new CorruptFileError('Invalid UTF-8 encoding detected. Text files must be strictly valid UTF-8.');
  }

  // Enforce line and column limits
  const lines = textContent.split(/\r?\n/);
  if (lines.length > 50000) {
    throw new FileSizeExceededError(`Text document exceeds maximum allowed line count (50,000 lines). Found ${lines.length} lines.`);
  }
  for (let i = 0; i < Math.min(lines.length, 500); i++) {
    if (lines[i].length > 50000) {
      throw new FileSizeExceededError(`Text document contains a line exceeding maximum allowable length (50,000 characters).`);
    }
  }

  const textSample = textContent.substring(0, 4096).trim();

  // JSON
  if (
    (textSample.startsWith('{') && textSample.includes('}')) ||
    (textSample.startsWith('[') && textSample.includes(']')) ||
    ext === '.json' ||
    declaredMimeType === 'application/json'
  ) {
    try {
      JSON.parse(textContent);
      return { fileType: 'json', mimeType: 'application/json' };
    } catch {
      if (ext === '.json') {
        throw new CorruptFileError('Invalid JSON format: syntax error encountered during parsing.');
      }
    }
  }

  // CSV
  if (ext === '.csv' || declaredMimeType === 'text/csv') {
    return { fileType: 'csv', mimeType: 'text/csv' };
  }

  // Markdown
  if (['.md', '.markdown'].includes(ext) || declaredMimeType === 'text/markdown') {
    return { fileType: 'markdown', mimeType: 'text/markdown' };
  }

  // Plain text or code
  if (
    ['.txt', '.text', '.log'].includes(ext) ||
    declaredMimeType.startsWith('text/') ||
    !ext
  ) {
    return { fileType: 'text', mimeType: 'text/plain' };
  }

  throw new UnsupportedTypeError(`Unsupported file extension "${ext}". Allowed: .pdf, .docx, .txt, .md, .csv, .xlsx, .json, .png, .jpg.`);
}

/**
 * Stores raw file buffer securely to disk outside web root under generated fileId
 * @param {string} fileId
 * @param {Buffer} buffer
 * @returns {string} Absolute file path on disk
 */
export async function storeRawFile(fileId, buffer) {
  const safeFilename = `${fileId}.bin`;
  const targetPath = path.join(UPLOAD_DIR, safeFilename);
  await fs.promises.writeFile(targetPath, buffer);
  return targetPath;
}

/**
 * Removes raw stored file from disk
 * @param {string} fileId
 */
export async function deleteRawFile(fileId) {
  const safeFilename = `${fileId}.bin`;
  const targetPath = path.join(UPLOAD_DIR, safeFilename);
  if (fs.existsSync(targetPath)) {
    try {
      await fs.promises.unlink(targetPath);
      return true;
    } catch (e) {
      console.warn(`Failed to unlink raw file ${targetPath}:`, e.message);
    }
  }
  return false;
}
