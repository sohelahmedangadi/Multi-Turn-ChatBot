import { ChromaClient } from 'chromadb';
import { getEmbeddingModel } from '../config/models.js';

let chromaClient = null;
let isChromaConnected = false;
let userMemoriesCollection = null;
let knowledgeCollection = null;
let documentChunksCollection = null;

const DEFAULT_CHROMA_URL = process.env.CHROMA_URL || 'http://127.0.0.1:8000';

export const EMBEDDING_VERSION_HASHED = 'hashed-v2-fnv1a';
export const EMBEDDING_VERSION_REAL = 'gemini-text-embedding-004';

// Common English Stopwords for Hashed Term Vector Normalization
export const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'is',
  'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'it', 'its', 'they', 'them', 'their',
]);

/**
 * Light English Stemmer (suffix stripping without heavy external dependencies)
 */
export function lightEnglishStem(word) {
  if (typeof word !== 'string' || word.length <= 3) return word;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ly') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ation') && word.length > 6) return word.slice(0, -5) + 'e';
  if (word.endsWith('tion') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Stable 32-bit FNV-1a Hash
 */
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Hash token to bucket index and compute signed trick (+1 or -1) to reduce collision bias
 */
function hashTokenWithSign(token, dim) {
  const h = fnv1a(token);
  const idx = h % dim;
  // Signed hashing trick (Weinberger et al. 2009): reduces collision bias
  const hSign = fnv1a(token + '_s');
  const sign = hSign & 1 ? 1 : -1;
  return { idx, sign };
}

/**
 * Unicode-aware Tokenizer with NFKC normalization
 * Preserves Indic scripts (Kannada, Hindi, Tamil, etc.), CJK, Latin, numbers
 */
export function tokenizeTextUnicode(text) {
  if (!text || typeof text !== 'string') return [];
  // 1. NFKC normalization
  const normalized = text.normalize('NFKC');
  // 2. Unicode-aware regex /[\p{L}\p{N}]+/gu
  const rawTokens = normalized.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!rawTokens || rawTokens.length === 0) return [];

  const processed = [];
  for (const t of rawTokens) {
    if (t.length <= 1) continue;
    // English stopword filter
    if (ENGLISH_STOPWORDS.has(t)) continue;
    // Light stemming
    const stemmed = lightEnglishStem(t);
    processed.push(stemmed);
  }
  return processed;
}

/**
 * Check if a vector is an all-zero vector
 */
export function isZeroVector(vec) {
  if (!vec || !Array.isArray(vec) || vec.length === 0) return true;
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] !== 0) return false;
  }
  return true;
}

/**
 * Dense Cosine Similarity with strict Zero-Vector Guard (NEVER returns NaN, returns 0)
 */
export function calculateDenseCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !vecA.length || !vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA <= 0 || normB <= 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (Number.isNaN(sim) || !Number.isFinite(sim)) return 0;
  return sim;
}

/**
 * Synchronous Deterministic Dense Embedding Generator (256-dim unit vector)
 */
export function generateDenseVectorSync(text, dim = 256) {
  const vec = new Float32Array(dim);
  if (!text || typeof text !== 'string') return Array.from(vec);

  const tokens = tokenizeTextUnicode(text);
  if (tokens.length === 0) return Array.from(vec);

  for (const token of tokens) {
    const { idx, sign } = hashTokenWithSign(token, dim);
    vec[idx] += sign;
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}

// Backwards-compatible alias
export function createDeterministicDenseEmbedding(text, dim = 256) {
  return generateDenseVectorSync(text, dim);
}

let testEmbeddingProvider = null;

export function setEmbeddingProviderForTesting(fn) {
  testEmbeddingProvider = fn;
}

/**
 * Dense vector generator supporting real embeddings (Gemini) when enabled,
 * or deterministic hashed fallback. Works synchronously when real embeddings are not requested.
 */
export function generateDenseVector(text, dim = 256, options = {}) {
  const useReal = options.useRealEmbeddings ?? process.env.USE_REAL_EMBEDDINGS === 'true';

  if (useReal) {
    return (async () => {
      if (testEmbeddingProvider) {
        try {
          const testVec = await testEmbeddingProvider(text, dim);
          if (testVec && Array.isArray(testVec) && testVec.length > 0) {
            return testVec;
          }
        } catch (err) {
          console.warn('[Embeddings] Test embedder error, falling back to hashed:', err.message);
        }
      }

      // Real Gemini embedding API path
      const apiKey = (process.env.GEMINI_API_KEY || '').trim();
      if (apiKey) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });
          const res = await ai.models.embedContent({
            model: getEmbeddingModel(),
            contents: text,
          });
          if (res?.embedding?.values && Array.isArray(res.embedding.values)) {
            return res.embedding.values;
          }
        } catch (geminiErr) {
          console.warn('[Embeddings] Gemini real embedding failed, falling back to hashed:', geminiErr.message);
        }
      }

      return generateDenseVectorSync(text, dim);
    })();
  }

  return generateDenseVectorSync(text, dim);
}

/**
 * Migration Script: Re-embed existing records and record embedding version
 */
export async function reembedExistingRecords(options = {}) {
  const records = options.records || [];
  const targetVersion =
    options.targetVersion ||
    (process.env.USE_REAL_EMBEDDINGS === 'true' ? EMBEDDING_VERSION_REAL : EMBEDDING_VERSION_HASHED);
  const embedder =
    options.mockEmbedder ||
    ((txt) => generateDenseVector(txt, 256, { useRealEmbeddings: targetVersion === EMBEDDING_VERSION_REAL }));

  let migratedCount = 0;
  for (const record of records) {
    if (record.embeddingVersion !== targetVersion) {
      const text = record.text || record.content || record.fact || '';
      record.embedding = await embedder(text);
      record.embeddingVersion = targetVersion;
      record.updatedAt = new Date().toISOString();
      migratedCount++;
    }
  }

  return {
    success: true,
    migratedCount,
    targetVersion,
    records,
  };
}

export class CosmoEmbeddingFunction {
  constructor() {
    this.name = 'cosmo-embed';
  }
  getConfig() {
    return {};
  }
  static buildFromConfig() {
    return new CosmoEmbeddingFunction();
  }
  async generate(texts) {
    return texts.map((t) => generateDenseVectorSync(t, 256));
  }
}

export const cosmoEmbeddingFunction = new CosmoEmbeddingFunction();

/**
 * Verifies that a host is strictly a loopback interface (localhost / 127.0.0.1 / ::1 / 127.0.0.0/8).
 */
export function isLoopbackHost(hostname) {
  if (!hostname) return false;
  const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase().trim();
  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') {
    return true;
  }
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Startup Guard: Refuses to run if Chroma answers on or points to a non-loopback address.
 * Throws fatal error to enforce local vector store isolation.
 */
export function assertChromaLoopback(urlStr = process.env.CHROMA_URL || DEFAULT_CHROMA_URL) {
  if (!urlStr || typeof urlStr !== 'string') {
    throw new Error('[Chroma Security] Fatal: Missing or invalid Chroma URL.');
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (err) {
    throw new Error(`[Chroma Security] Fatal: Invalid Chroma URL format "${urlStr}": ${err.message}`);
  }

  const hostname = parsed.hostname;
  if (!isLoopbackHost(hostname)) {
    throw new Error(
      `[Chroma Security] Fatal: Chroma server must run on loopback (127.0.0.1 / localhost) for local isolation, but configured address "${urlStr}" (host: "${hostname}") is non-loopback. Refusing to run.`
    );
  }

  return true;
}

function parseChromaUrl(urlStr) {
  assertChromaLoopback(urlStr);
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 8000),
      ssl: parsed.protocol === 'https:',
    };
  } catch (err) {
    if (err.message.includes('Fatal: Chroma server must run on loopback')) {
      throw err;
    }
    return { host: '127.0.0.1', port: 8000, ssl: false };
  }
}

/**
 * Initialize Chroma Client & Collections
 * Retries up to maxRetries to allow background Chroma server to boot
 */
export async function initChroma(optionsOrRetries = 2, retryDelayMs = 1000) {
  const activeUrl = process.env.CHROMA_URL || DEFAULT_CHROMA_URL;
  assertChromaLoopback(activeUrl);
  const urlConfig = parseChromaUrl(activeUrl);
  
  let maxRetries = 2;
  let timeoutMs = 1500;

  if (typeof optionsOrRetries === 'number') {
    if (optionsOrRetries > 20) {
      maxRetries = 1;
      timeoutMs = optionsOrRetries;
    } else {
      maxRetries = optionsOrRetries;
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      chromaClient = new ChromaClient({
        host: urlConfig.host,
        port: urlConfig.port,
        ssl: urlConfig.ssl,
      });

      // Check heartbeat with timeout
      await Promise.race([
        chromaClient.heartbeat(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Chroma heartbeat timed out')), timeoutMs)
        ),
      ]);

      isChromaConnected = true;
      console.log(`✅ Connected to Chroma Vector Database at: ${DEFAULT_CHROMA_URL}`);

      const collPrefix = process.env.CHROMA_COLLECTION_PREFIX || '';
      // Initialize collections with dedicated embedding function
      const origWarn = console.warn;
      console.warn = (...args) => {
        if (
          typeof args[0] === 'string' &&
          args[0].includes('Cannot instantiate a collection with the DefaultEmbeddingFunction')
        ) {
          return;
        }
        origWarn.apply(console, args);
      };

      try {
        userMemoriesCollection = await chromaClient.getOrCreateCollection({
          name: `${collPrefix}cosmo_user_memories`,
          embeddingFunction: cosmoEmbeddingFunction,
          metadata: { description: 'Tier 2 Long-Term User Memories & Profile Facts' },
        });
        knowledgeCollection = await chromaClient.getOrCreateCollection({
          name: `${collPrefix}cosmo_knowledge_base`,
          embeddingFunction: cosmoEmbeddingFunction,
          metadata: { description: 'Tier 3 Domain Architecture & System Knowledge' },
        });
        documentChunksCollection = await chromaClient.getOrCreateCollection({
          name: `${collPrefix}cosmo_document_chunks`,
          embeddingFunction: cosmoEmbeddingFunction,
          metadata: { description: 'Document Analysis & RAG Chunks' },
        });
        console.log(`✅ Chroma collections ready (${collPrefix}cosmo_user_memories, ${collPrefix}cosmo_knowledge_base, ${collPrefix}cosmo_document_chunks)`);
      } catch (collErr) {
        origWarn('⚠️ Chroma collection initialization notice:', collErr.message);
      } finally {
        console.warn = origWarn;
      }

      return { connected: true, url: DEFAULT_CHROMA_URL };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      } else {
        isChromaConnected = false;
        userMemoriesCollection = null;
        knowledgeCollection = null;
        documentChunksCollection = null;
        console.log(`ℹ️ Chroma DB not reachable at ${DEFAULT_CHROMA_URL} (${err.message}).`);
        console.log('   Operating with local vector engine. (To run Chroma: npm run chroma)');
        return { connected: false, error: err.message };
      }
    }
  }
}

export function isChromaAvailable() {
  return isChromaConnected && userMemoriesCollection !== null;
}

export function getChromaStatus() {
  return {
    provider: 'chroma',
    connected: isChromaConnected,
    url: DEFAULT_CHROMA_URL,
    collectionsReady: Boolean(userMemoriesCollection && knowledgeCollection),
  };
}

export async function cleanupTestCollections() {
  const collPrefix = process.env.CHROMA_COLLECTION_PREFIX;
  if (!collPrefix || !chromaClient || !isChromaConnected) return;
  const names = [
    `${collPrefix}cosmo_user_memories`,
    `${collPrefix}cosmo_knowledge_base`,
    `${collPrefix}cosmo_document_chunks`,
  ];
  for (const n of names) {
    try {
      await chromaClient.deleteCollection({ name: n });
    } catch (e) {}
  }
}

/**
 * Upsert User Memory into Chroma
 */
export async function upsertMemoryToChroma({ userId, key, fact, category, memoryId, embeddingVersion }) {
  if (!isChromaAvailable()) return null;
  try {
    const docId = `mem_${userId}_${key}`;
    const embedding = generateDenseVectorSync(fact + ' ' + key);
    if (isZeroVector(embedding)) {
      console.warn('[Chroma] Skipping memory upsert for zero/empty vector:', key);
      return null;
    }
    const version =
      embeddingVersion ||
      (process.env.USE_REAL_EMBEDDINGS === 'true' ? EMBEDDING_VERSION_REAL : EMBEDDING_VERSION_HASHED);
    await userMemoriesCollection.upsert({
      ids: [docId],
      documents: [fact],
      embeddings: [embedding],
      metadatas: [
        {
          userId,
          key,
          category: category || 'general',
          memoryId: memoryId || docId,
          fact,
          embeddingVersion: version,
        },
      ],
    });
    return docId;
  } catch (err) {
    console.warn('[Chroma] Error upserting memory:', err.message);
    return null;
  }
}

/**
 * Delete User Memory from Chroma
 */
export async function deleteMemoryFromChroma(userId, key) {
  if (!isChromaAvailable()) return false;
  try {
    const docId = `mem_${userId}_${key}`;
    await userMemoriesCollection.delete({
      ids: [docId],
    });
    return true;
  } catch (err) {
    console.warn('[Chroma] Error deleting memory:', err.message);
    return false;
  }
}

/**
 * Query User Memories via Chroma Vector Search
 */
export async function searchMemoriesInChroma(userId, queryText, topK = 6) {
  if (!isChromaAvailable() || !queryText) return [];
  try {
    const queryVec = createDeterministicDenseEmbedding(queryText);
    const results = await userMemoriesCollection.query({
      queryEmbeddings: [queryVec],
      queryTexts: [queryText],
      nResults: topK,
      where: { userId },
    });

    if (!results || !results.documents || results.documents.length === 0) {
      return [];
    }

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances ? results.distances[0] || [] : [];
    const ids = results.ids[0] || [];

    const memories = [];
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i]) continue;
      const meta = metadatas[i] || {};
      memories.push({
        id: meta.memoryId || ids[i],
        userId: meta.userId || userId,
        key: meta.key || '',
        fact: meta.fact || docs[i],
        category: meta.category || 'general',
        similarity: distances[i] !== undefined ? Math.max(0, 1 - distances[i]) : 1.0,
      });
    }

    return memories;
  } catch (err) {
    console.warn('[Chroma] Error querying memories:', err.message);
    return [];
  }
}

/**
 * Seed Knowledge Chunks into Chroma Knowledge Collection
 */
export async function seedKnowledgeToChroma(chunks = []) {
  if (!isChromaConnected || !knowledgeCollection || chunks.length === 0) return;
  try {
    const ids = chunks.map((c) => c.id);
    const documents = chunks.map((c) => `${c.title}\n${c.content}`);
    const embeddings = documents.map((doc) => createDeterministicDenseEmbedding(doc));
    const metadatas = chunks.map((c) => ({
      title: c.title,
      category: c.category || 'general',
      tags: Array.isArray(c.tags) ? c.tags.join(',') : '',
    }));

    await knowledgeCollection.upsert({
      ids,
      documents,
      embeddings,
      metadatas,
    });
  } catch (err) {
    console.warn('[Chroma] Error seeding knowledge chunks:', err.message);
  }
}

/**
 * Query Knowledge Base via Chroma Vector Search
 */
export async function searchKnowledgeInChroma(queryText, topK = 3) {
  if (!isChromaConnected || !knowledgeCollection || !queryText) return [];
  try {
    const queryVec = createDeterministicDenseEmbedding(queryText);
    const results = await knowledgeCollection.query({
      queryEmbeddings: [queryVec],
      queryTexts: [queryText],
      nResults: topK,
    });

    if (!results || !results.documents || results.documents.length === 0) {
      return [];
    }

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const ids = results.ids[0] || [];

    const chunks = [];
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i]) continue;
      const meta = metadatas[i] || {};
      chunks.push({
        id: ids[i],
        title: meta.title || '',
        content: docs[i],
        category: meta.category || 'general',
        tags: meta.tags ? String(meta.tags).split(',') : [],
      });
    }

    return chunks;
  } catch (err) {
    console.warn('[Chroma] Error querying knowledge base:', err.message);
    return [];
  }
}

/**
 * Upsert Document Chunks into Chroma Vector Store
 */
export async function upsertDocumentChunksToChroma(sessionId, fileId, chunks = [], options = {}) {
  if (!isChromaConnected || !documentChunksCollection || chunks.length === 0) return;
  try {
    const validIds = [];
    const validDocs = [];
    const validEmbeddings = [];
    const validMetadatas = [];
    const defaultVersion =
      options.embeddingVersion ||
      (process.env.USE_REAL_EMBEDDINGS === 'true' ? EMBEDDING_VERSION_REAL : EMBEDDING_VERSION_HASHED);

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const textToEmbed = c.content + ' ' + (c.heading || '') + ' ' + (c.section || '');
      const emb = generateDenseVectorSync(textToEmbed);
      if (isZeroVector(emb)) {
        // Guard zero vectors: skip empty vectors on insert
        continue;
      }
      validIds.push(c.id || `chk_${fileId}_${c.chunkIndex ?? i}`);
      validDocs.push(c.content);
      validEmbeddings.push(emb);
      validMetadatas.push({
        sessionId,
        fileId,
        userId: options.userId || c.userId || '',
        chunkIndex: Number(c.chunkIndex) || i,
        page: Number(c.page) || 1,
        heading: c.heading || '',
        section: c.section || '',
        embeddingVersion: c.embeddingVersion || defaultVersion,
      });
    }

    if (validIds.length === 0) return;

    await documentChunksCollection.upsert({
      ids: validIds,
      documents: validDocs,
      embeddings: validEmbeddings,
      metadatas: validMetadatas,
    });
  } catch (err) {
    console.warn('[Chroma] Error indexing document chunks:', err.message);
  }
}

/**
 * Query Document Chunks via Chroma Vector Search
 */
export async function searchDocumentChunksInChroma(sessionId, queryText, options = {}) {
  if (!isChromaConnected || !documentChunksCollection || !queryText) return [];
  try {
    const topK = options.topK || 5;
    const conditions = [{ sessionId: { $eq: sessionId } }];
    if (options.fileId) {
      conditions.push({ fileId: { $eq: options.fileId } });
    }
    if (options.userId) {
      conditions.push({ userId: { $eq: options.userId } });
    }
    const whereFilter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const queryVec = createDeterministicDenseEmbedding(queryText);
    const results = await documentChunksCollection.query({
      queryEmbeddings: [queryVec],
      queryTexts: [queryText],
      nResults: topK,
      where: whereFilter,
    });

    if (!results || !results.documents || results.documents.length === 0) {
      return [];
    }

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances ? results.distances[0] || [] : [];
    const ids = results.ids[0] || [];

    const chunks = [];
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i]) continue;
      const meta = metadatas[i] || {};
      chunks.push({
        id: ids[i],
        content: docs[i],
        chunkIndex: meta.chunkIndex || i,
        score: distances[i] !== undefined ? Math.max(0, 1 - distances[i]) : 1.0,
        citation: {
          fileId: meta.fileId || options.fileId,
          page: meta.page || 1,
          heading: meta.heading || null,
          section: meta.section || null,
          chunkIndex: meta.chunkIndex || i,
        },
      });
    }

    return chunks;
  } catch (err) {
    console.warn('[Chroma] Error searching document chunks:', err.message);
    return [];
  }
}

/**
 * Delete Document Chunks from Chroma
 */
export async function deleteDocumentChunksFromChroma(fileId) {
  if (!isChromaConnected || !documentChunksCollection || !fileId) return false;
  try {
    await documentChunksCollection.delete({
      where: { fileId: { $eq: fileId } },
    });
    return true;
  } catch (err) {
    console.warn('[Chroma] Error deleting document chunks:', err.message);
    return false;
  }
}

