import { db } from '../db/store.js';
import { vectorizeText, calculateVectorCosineSimilarity } from './memoryManager.js';
import { estimateTokenCount } from './extractors/baseExtractor.js';
import {
  isChromaAvailable,
  upsertDocumentChunksToChroma,
  searchDocumentChunksInChroma,
  deleteDocumentChunksFromChroma,
} from './chromaService.js';

// Target Chunk Limits
export const TARGET_CHUNK_TOKENS = 350;
export const CHUNK_OVERLAP_TOKENS = 50;
export const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * 4; // ~1400 chars
export const CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * 4; // ~200 chars

/**
 * Splits text into structure-aware chunks respecting paragraph and sentence boundaries
 * @param {string} text
 * @param {number} maxChars
 * @param {number} overlapChars
 * @returns {string[]}
 */
export function splitTextIntoChunks(text, maxChars = TARGET_CHUNK_CHARS, overlapChars = CHUNK_OVERLAP_CHARS) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (clean.length <= maxChars) {
    return [clean];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + maxChars;

    if (endIndex >= clean.length) {
      chunks.push(clean.substring(startIndex).trim());
      break;
    }

    // Try finding paragraph or sentence break near endIndex
    let breakIndex = -1;
    const searchWindow = clean.substring(startIndex + Math.floor(maxChars * 0.7), endIndex + 50);

    const paraBreak = searchWindow.lastIndexOf('\n\n');
    if (paraBreak !== -1) {
      breakIndex = startIndex + Math.floor(maxChars * 0.7) + paraBreak + 2;
    } else {
      const sentenceBreak = searchWindow.lastIndexOf('. ');
      if (sentenceBreak !== -1) {
        breakIndex = startIndex + Math.floor(maxChars * 0.7) + sentenceBreak + 2;
      } else {
        const lineBreak = searchWindow.lastIndexOf('\n');
        if (lineBreak !== -1) {
          breakIndex = startIndex + Math.floor(maxChars * 0.7) + lineBreak + 1;
        } else {
          const spaceBreak = searchWindow.lastIndexOf(' ');
          if (spaceBreak !== -1) {
            breakIndex = startIndex + Math.floor(maxChars * 0.7) + spaceBreak + 1;
          }
        }
      }
    }

    if (breakIndex <= startIndex || breakIndex > clean.length) {
      breakIndex = endIndex;
    }

    const chunkContent = clean.substring(startIndex, breakIndex).trim();
    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    startIndex = Math.max(startIndex + 1, breakIndex - overlapChars);
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Generates an automatic document summary and key entities from structured parsed text
 * @param {object} parsedDocument
 * @returns {{ summary: string, entities: string[] }}
 */
export function generateDocumentSummaryAndEntities(parsedDocument) {
  const fullText = parsedDocument.fullText || '';
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  // Take top sentences / headings
  const topLines = lines.slice(0, 10).join(' ');
  const summary = topLines.length > 500 ? topLines.substring(0, 500) + '...' : topLines;

  // Extract key entity capitalized phrases and code terms
  const words = fullText.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (['The', 'This', 'That', 'With', 'From', 'Into', 'When', 'What', 'Where', 'Table', 'Page'].includes(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }

  const sortedEntities = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);

  return {
    summary: summary || `Document "${parsedDocument.filename}" with ${parsedDocument.page_count || 1} pages.`,
    entities: sortedEntities,
  };
}

/**
 * Indexes a parsed document into the database with structure-aware chunking,
 * namespaced strictly by sessionId
 * @param {string} fileId
 * @param {object} parsedDoc
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function indexDocument(fileId, parsedDoc, sessionId, userId = 'guest-user-default') {
  if (!parsedDoc || (!parsedDoc.fullText && (!parsedDoc.text_blocks || parsedDoc.text_blocks.length === 0))) {
    throw new Error('Document content is empty or invalid for indexing.');
  }

  const chunksToIndex = [];
  let chunkGlobalIndex = 0;

  // 1. Structure-aware chunking by text blocks (headings, pages, sheets)
  const blocks = parsedDoc.text_blocks && parsedDoc.text_blocks.length > 0
    ? parsedDoc.text_blocks
    : [{ text: parsedDoc.fullText, page: 1, section: 'Document Body' }];

  for (const block of blocks) {
    const rawBlockText = block.text || '';
    const blockSubChunks = splitTextIntoChunks(rawBlockText, TARGET_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);

    for (const subChunk of blockSubChunks) {
      const chunkId = `${fileId}_chunk_${chunkGlobalIndex}`;
      const vector = vectorizeText(subChunk + ' ' + (block.heading || '') + ' ' + (block.section || ''));

      chunksToIndex.push({
        id: chunkId,
        fileId,
        sessionId,
        userId,
        chunkIndex: chunkGlobalIndex,
        content: subChunk,
        page: block.page || 1,
        sheet: block.sheet || null,
        heading: block.heading || null,
        section: block.section || null,
        tokensEstimated: estimateTokenCount(subChunk),
        vector,
      });

      chunkGlobalIndex++;
    }
  }

  // 2. Generate and cache document summary and key entities
  const { summary, entities } = generateDocumentSummaryAndEntities(parsedDoc);

  // 3. Save chunks in DB namespaced by sessionId
  await db.saveDocumentChunks(chunksToIndex);

  // Sync to Chroma vector collection if Chroma DB is active
  if (isChromaAvailable()) {
    await upsertDocumentChunksToChroma(sessionId, fileId, chunksToIndex, { userId });
  }

  // 4. Save file metadata
  const metaDoc = {
    fileId,
    sessionId,
    userId,
    filename: parsedDoc.filename,
    mimeType: parsedDoc.mime_type || 'text/plain',
    size: parsedDoc.size || 0,
    sha256: parsedDoc.metadata?.sha256 || '',
    fileType: parsedDoc.fileType || 'text',
    uploadedAt: new Date().toISOString(),
    summary,
    entities,
    pageCount: parsedDoc.page_count || 1,
    wordCount: parsedDoc.wordCount || 0,
    charCount: parsedDoc.charCount || 0,
    estimatedTokens: parsedDoc.estimatedTokens || 0,
    isScanned: Boolean(parsedDoc.metadata?.isScanned),
  };

  await db.saveFileMetadata(metaDoc);

  // Cache parsed document per user for deduplication
  if (metaDoc.sha256) {
    await db.saveParsedDocumentCache(userId, metaDoc.sha256, parsedDoc);
  }

  return {
    fileId,
    sessionId,
    filename: metaDoc.filename,
    fileType: metaDoc.fileType,
    totalChunks: chunksToIndex.length,
    wordCount: metaDoc.wordCount,
    estimatedTokens: metaDoc.estimatedTokens,
    summary,
    entities,
  };
}

/**
 * Detects if a user query is asking for a document-level summary or overview
 * @param {string} query
 * @returns {boolean}
 */
export function isWholeDocumentQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();
  return (
    /\b(summarize|summary|synopsis|executive summary|tldr)\b/i.test(q) ||
    /^(overview|high-level overview|brief overview|give me an? (summary|overview)|what is this (document|file|report|paper|pdf) about)/i.test(q) ||
    /\b(what does this (document|file|report) (say|contain|cover|talk about))\b/i.test(q) ||
    /\b(overview of (the|this) (document|file|report))\b/i.test(q)
  );
}

/**
 * Hybrid vector + BM25 keyword retrieval, strictly namespaced to a session
 * @param {string} sessionId
 * @param {string} query
 * @param {object} options - { fileId, topK }
 * @returns {Promise<Array<{ chunkIndex: number, content: string, score: number, citation: object }>>}
 */
export async function retrieveRelevantChunks(sessionId, query, options = {}) {
  const topK = options.topK || 5;
  const fileId = options.fileId || null;
  const userId = options.userId || null;

  // 1. High-Performance Chroma DB Semantic Vector Retrieval when available
  if (isChromaAvailable()) {
    try {
      const chromaChunks = await searchDocumentChunksInChroma(sessionId, query, { fileId, topK, userId });
      if (chromaChunks && chromaChunks.length > 0) {
        const allSessionFiles = await db.getFilesBySession(sessionId);
        const sessionFiles = allSessionFiles.filter((f) => !userId || f.userId === userId);
        const fileMap = new Map(sessionFiles.map((f) => [f.fileId, f]));
        for (const c of chromaChunks) {
          if (c.citation) {
            const fid = c.citation.fileId || fileId;
            c.citation.filename = fileMap.get(fid)?.filename || 'Document';
          }
        }
        return chromaChunks;
      }
    } catch (chromaErr) {
      console.warn('[RAG] Chroma document search notice, falling back to local vector:', chromaErr.message);
    }
  }

  // 2. Built-in Local Hybrid Keyword & Cosine Similarity Engine
  const chunks = await db.getDocumentChunksBySession(sessionId, fileId, userId);
  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Get file metadata map for citations
  const allSessionFiles = await db.getFilesBySession(sessionId);
  const sessionFiles = allSessionFiles.filter((f) => !userId || f.userId === userId);
  const fileMap = new Map(sessionFiles.map((f) => [f.fileId, f]));

  // If total chunks <= topK, return all in order with citations
  if (chunks.length <= topK) {
    return chunks.map((c) => {
      const fileMeta = fileMap.get(c.fileId);
      const filename = fileMeta?.filename || 'Document';
      return {
        chunkIndex: c.chunkIndex,
        content: c.content,
        score: 1.0,
        citation: {
          fileId: c.fileId,
          filename,
          page: c.page || 1,
          sheet: c.sheet || null,
          heading: c.heading || null,
          section: c.section || null,
          chunkIndex: c.chunkIndex,
        },
      };
    });
  }

  // Compute Hybrid Score: Vector Cosine Sim + Keyword Overlap
  const queryVec = vectorizeText(query);
  const queryTokens = (query || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = chunks.map((chunk) => {
    const chunkVec = chunk.vector && typeof chunk.vector === 'object'
      ? chunk.vector
      : vectorizeText(chunk.content + ' ' + (chunk.heading || ''));

    const cosineSim = calculateVectorCosineSimilarity(queryVec, chunkVec);
    const chunkLower = chunk.content.toLowerCase();

    let keywordScore = 0;
    for (const token of queryTokens) {
      if (chunkLower.includes(token)) {
        keywordScore += 1.5;
      }
    }

    const distinctMatches = queryTokens.filter((t) => chunkLower.includes(t)).length;
    if (distinctMatches > 1) {
      keywordScore += distinctMatches * 2.0;
    }

    // Heading match boost
    if (chunk.heading && queryTokens.some((t) => chunk.heading.toLowerCase().includes(t))) {
      keywordScore += 3.0;
    }

    const totalScore = cosineSim * 0.6 + keywordScore * 0.4;
    const fileMeta = fileMap.get(chunk.fileId);
    const filename = fileMeta?.filename || 'Document';

    return {
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: totalScore,
      citation: {
        fileId: chunk.fileId,
        filename,
        page: chunk.page || 1,
        sheet: chunk.sheet || null,
        heading: chunk.heading || null,
        section: chunk.section || null,
        chunkIndex: chunk.chunkIndex,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Take topK and re-sort chronologically for reading coherence
  const topResults = scored.slice(0, topK);
  topResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

  return topResults;
}

/**
 * Gets metadata for a stored document
 * @param {string} fileId
 */
export async function getDocumentMetadata(fileId) {
  return await db.getFileMetadata(fileId);
}

/**
 * Deletes document and its chunks from storage and DB
 * @param {string} fileId
 */
export async function deleteDocument(fileId) {
  if (isChromaAvailable()) {
    try {
      await deleteDocumentChunksFromChroma(fileId);
    } catch (e) {
      // Non-blocking
    }
  }
  return await db.deleteFile(fileId);
}
