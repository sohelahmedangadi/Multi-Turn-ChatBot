import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * In-Memory RAG Document Index Store (maps fileId -> document entry)
 */
const documentStore = new Map();

/**
 * Splits and indexes an uploaded document using LangChain RecursiveCharacterTextSplitter
 * @param {string} fileId - Unique identifier for the document
 * @param {object} parsedFile - { filename, fileType, textContent, wordCount, estimatedTokens }
 * @param {string} userId - User ID owner
 * @returns {Promise<{ fileId: string, filename: string, totalChunks: number, wordCount: number }>}
 */
export async function indexDocument(fileId, parsedFile, userId = 'guest-user-default') {
  if (!parsedFile || !parsedFile.textContent) {
    throw new Error('Document content is empty or invalid.');
  }

  // 1. Configure LangChain Text Splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 150,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  // 2. Split text into LangChain chunks
  const chunks = await splitter.splitText(parsedFile.textContent);

  const indexedChunks = chunks.map((chunkText, idx) => ({
    id: `${fileId}_chunk_${idx}`,
    chunkIndex: idx,
    content: chunkText.trim(),
    charCount: chunkText.length,
    tokensEstimated: Math.ceil(chunkText.length / 4),
  }));

  const docEntry = {
    fileId,
    userId,
    filename: parsedFile.filename,
    fileType: parsedFile.fileType,
    fullText: parsedFile.textContent,
    wordCount: parsedFile.wordCount,
    estimatedTokens: parsedFile.estimatedTokens,
    totalChunks: indexedChunks.length,
    chunks: indexedChunks,
    uploadedAt: new Date().toISOString(),
  };

  documentStore.set(fileId, docEntry);

  return {
    fileId,
    filename: docEntry.filename,
    fileType: docEntry.fileType,
    totalChunks: docEntry.totalChunks,
    wordCount: docEntry.wordCount,
    estimatedTokens: docEntry.estimatedTokens,
  };
}

/**
 * Semantic & Keyword BM25-inspired retrieval from document chunks
 * @param {string} fileId - Document ID
 * @param {string} query - User query/question
 * @param {number} topK - Number of top chunks to return
 * @returns {Array<{ chunkIndex: number, content: string, score: number }>}
 */
export function retrieveRelevantChunks(fileId, query, topK = 4) {
  const doc = documentStore.get(fileId);
  if (!doc || !doc.chunks || doc.chunks.length === 0) {
    return [];
  }

  // If document is small (<= topK chunks), return all chunks in order
  if (doc.chunks.length <= topK) {
    return doc.chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      content: c.content,
      score: 1.0,
    }));
  }

  // Extract query keywords (lowercased, filtering small stopwords)
  const queryTokens = (query || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scoredChunks = doc.chunks.map((chunk) => {
    const chunkLower = chunk.content.toLowerCase();
    let matchScore = 0;

    for (const token of queryTokens) {
      if (chunkLower.includes(token)) {
        // Count frequency of occurrence
        const occurrences = chunkLower.split(token).length - 1;
        matchScore += occurrences * 1.5;
      }
    }

    // Proximity bonus if multiple keywords appear in the same chunk
    const distinctMatches = queryTokens.filter((t) => chunkLower.includes(t)).length;
    if (distinctMatches > 1) {
      matchScore += distinctMatches * 2.0;
    }

    return {
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: matchScore,
    };
  });

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  // If query had no matches, take the first topK chunks (e.g. document summary/beginning)
  const topResults = scoredChunks.slice(0, topK);
  // Sort selected chunks chronologically by chunkIndex for coherent reading
  topResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

  return topResults;
}

/**
 * Gets metadata for a stored document
 * @param {string} fileId
 */
export function getDocumentMetadata(fileId) {
  const doc = documentStore.get(fileId);
  if (!doc) return null;
  return {
    fileId: doc.fileId,
    filename: doc.filename,
    fileType: doc.fileType,
    totalChunks: doc.totalChunks,
    wordCount: doc.wordCount,
    estimatedTokens: doc.estimatedTokens,
    uploadedAt: doc.uploadedAt,
  };
}

/**
 * Deletes a document from the index store
 * @param {string} fileId
 */
export function deleteDocument(fileId) {
  return documentStore.delete(fileId);
}
