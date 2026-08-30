import { db } from '../db/store.js';
import { extractFactsWithLangChain } from './langchainMemory.js';

// Configurable Token Limits
export const MEMORY_MAX_TOKENS = Number(process.env.MEMORY_MAX_TOKENS) || 300;
export const KNOWLEDGE_MAX_TOKENS = Number(process.env.KNOWLEDGE_MAX_TOKENS) || 500;
export const CONTEXT_MAX_TOKENS = Number(process.env.CONTEXT_MAX_TOKENS) || 3500;

/**
 * Lightweight Text Vectorizer & Dense Embedding Generator
 */
export function vectorizeText(text) {
  if (!text || typeof text !== 'string') return {};

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const freqMap = {};
  for (const t of tokens) {
    freqMap[t] = (freqMap[t] || 0) + 1;
  }

  return freqMap;
}

/**
 * Cosine Similarity between two term vector frequency maps
 */
export function calculateVectorCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) return 0;
  const termsA = typeof vecA === 'object' && !Array.isArray(vecA) ? vecA : {};
  const termsB = typeof vecB === 'object' && !Array.isArray(vecB) ? vecB : {};

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const count of Object.values(termsA)) {
    normA += count * count;
  }
  for (const count of Object.values(termsB)) {
    normB += count * count;
  }

  if (normA === 0 || normB === 0) return 0;

  for (const [term, countA] of Object.entries(termsA)) {
    if (termsB[term]) {
      dotProduct += countA * termsB[term];
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fact Extractor Bridge
 * Combines LangChain LLM intelligence with fast heuristic backup
 */
export async function extractFactsFromMessage(text, existingMemories = []) {
  return await extractFactsWithLangChain(text, existingMemories);
}

/**
 * Auto-extract and persist/update/delete facts into Tier 2 User Memory Store
 */
export async function processAndSaveUserMemories(userId, text, sessionId) {
  if (!userId || !text) return [];

  const existingMemories = await db.getUserMemories(userId);
  const facts = await extractFactsWithLangChain(text, existingMemories);
  const savedMemories = [];

  for (const item of facts) {
    if (item.action === 'delete') {
      await db.deleteUserMemoryByKey(item.key, userId);
      continue;
    }

    const memory = await db.saveOrUpdateUserMemory({
      userId,
      key: item.key,
      fact: item.fact,
      category: item.category || 'general',
      sourceSessionId: sessionId,
      vector: vectorizeText(item.fact + ' ' + item.key),
    });
    savedMemories.push(memory);
  }

  return savedMemories;
}

/**
 * Semantic Vector Search over Tier 2 User Memory Store
 */
export async function searchUserMemories(userId, query, maxTokens = MEMORY_MAX_TOKENS, topK = 8) {
  if (!userId || !query) return [];

  const allMemories = await db.getUserMemories(userId);
  if (!allMemories || allMemories.length === 0) return [];

  const queryLower = query.toLowerCase();
  const queryVec = vectorizeText(query);
  const queryWords = new Set(
    queryLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2)
  );

  // Direct intent detectors
  const isAskingName = /(name|who am i|who i am|call me)/i.test(queryLower);
  const isAskingProject = /(project|app|building|working on|system)/i.test(queryLower);
  const isAskingTech = /(tech|stack|language|framework|code|tools|database)/i.test(queryLower);
  const isBroadMemoryQuery = /(what\s+(is|was|are|were)\s+my|who\s+am\s+i|remember|about\s+me|my\s+details|my\s+info|do\s+you\s+know\s+my)/i.test(queryLower);

  const scored = allMemories.map((mem) => {
    const memKey = mem.key.toLowerCase();
    const memFact = mem.fact.toLowerCase();
    const memVec = mem.vector && typeof mem.vector === 'object' ? mem.vector : vectorizeText(mem.fact + ' ' + mem.key);
    const cosineSim = calculateVectorCosineSimilarity(queryVec, memVec);

    let priorityBoost = 0;
    if (isAskingName && memKey === 'user_name') priorityBoost += 2.0;
    if (isAskingProject && memKey === 'project_name') priorityBoost += 2.0;
    if (isAskingTech && (memKey === 'tech_stack' || memKey === 'favorite_language')) priorityBoost += 1.5;

    // Keyword overlap
    let keywordMatches = 0;
    const words = (memFact + ' ' + memKey).split(/\s+/);
    for (const kw of queryWords) {
      if (words.some((w) => w.includes(kw) || kw.includes(w))) {
        keywordMatches++;
      }
    }
    const keywordScore = keywordMatches / Math.max(1, queryWords.size);

    const totalScore = cosineSim * 0.5 + keywordScore * 0.3 + priorityBoost;

    return {
      memory: mem,
      score: totalScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let tokenCount = 0;

  for (const item of scored) {
    if (selected.length >= topK) break;

    // Always include boosted memories or matches when asking broad questions
    if (item.score > 0.05 || isBroadMemoryQuery || selected.length === 0) {
      const tokensEst = Math.ceil(item.memory.fact.length / 4);
      if (tokenCount + tokensEst <= maxTokens) {
        selected.push(item.memory);
        tokenCount += tokensEst;
      }
    }
  }

  return selected;
}

/**
 * Cross-Session Previous Chat Semantic Search
 * Retrieves relevant turns or summaries from the user's past conversations (excluding active session).
 */
export async function searchPreviousChatHistory(userId, currentSessionId, query, maxTokens = 400, topK = 4) {
  if (!userId || !query) return [];

  const pastMessages = await db.searchPastMessages(userId, currentSessionId);
  const pastSessions = await db.getPastConversationsSummary(userId, currentSessionId);

  const queryLower = query.toLowerCase();
  const queryVec = vectorizeText(query);
  const queryWords = new Set(
    queryLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2)
  );

  const isAskingPastChats = /(previous|earlier|last\s+chat|past\s+chat|before|we\s+discussed|we\s+talked|history|topics|summarize\s+chats|other\s+conversations)/i.test(queryLower);

  // If user asks broad summary of past chats, return past session titles/summaries
  if (isAskingPastChats && pastMessages.length === 0 && pastSessions.length > 0) {
    return pastSessions.map((s) => ({
      role: 'system',
      sessionTitle: s.title,
      content: `Previous chat titled: "${s.title}" (${s.messageCount || 0} turns).`,
    }));
  }

  if (pastMessages.length === 0) return [];

  const scored = pastMessages.map((msg) => {
    const msgVec = msg.vector && typeof msg.vector === 'object' ? msg.vector : vectorizeText(msg.content);
    const cosineSim = calculateVectorCosineSimilarity(queryVec, msgVec);

    let keywordMatches = 0;
    const words = msg.content.toLowerCase().split(/\s+/);
    for (const kw of queryWords) {
      if (words.some((w) => w.includes(kw) || kw.includes(w))) {
        keywordMatches++;
      }
    }
    const keywordScore = keywordMatches / Math.max(1, queryWords.size);

    const totalScore = cosineSim * 0.6 + keywordScore * 0.4;
    return { message: msg, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let tokenCount = 0;

  for (const item of scored) {
    if (selected.length >= topK) break;
    if (item.score > 0.08 || (isAskingPastChats && selected.length < 3)) {
      const tokensEst = Math.ceil(item.message.content.length / 4);
      if (tokenCount + tokensEst <= maxTokens) {
        selected.push(item.message);
        tokenCount += tokensEst;
      }
    }
  }

  return selected;
}

/**
 * Semantic Vector Search over Tier 3 Domain Knowledge Base
 */
export async function searchKnowledgeBase(query, maxTokens = KNOWLEDGE_MAX_TOKENS, topK = 2) {
  if (!query) return [];

  const chunks = await db.getKnowledgeChunks();
  if (!chunks || chunks.length === 0) return [];

  const queryVec = vectorizeText(query);
  const queryLower = query.toLowerCase();

  const scored = chunks.map((chunk) => {
    const chunkVec = vectorizeText(chunk.title + ' ' + chunk.content + ' ' + (chunk.tags || []).join(' '));
    const cosineSim = calculateVectorCosineSimilarity(queryVec, chunkVec);

    let tagMatchBonus = 0;
    if (chunk.tags && Array.isArray(chunk.tags)) {
      for (const tag of chunk.tags) {
        if (queryLower.includes(tag.toLowerCase())) {
          tagMatchBonus += 0.25;
        }
      }
    }

    const score = cosineSim * 0.7 + Math.min(tagMatchBonus, 0.3);
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let tokenCount = 0;

  for (const item of scored) {
    if (selected.length >= topK) break;
    if (item.score > 0.12) {
      const tokensEst = Math.ceil(item.chunk.content.length / 4);
      if (tokenCount + tokensEst <= maxTokens) {
        selected.push(item.chunk);
        tokenCount += tokensEst;
      }
    }
  }

  return selected;
}
