import { db } from '../db/store.js';
import {
  searchUserMemories,
  searchPreviousChatHistory,
  searchKnowledgeBase,
  MEMORY_MAX_TOKENS,
  KNOWLEDGE_MAX_TOKENS,
  CONTEXT_MAX_TOKENS,
} from './memoryManager.js';
import { retrieveRelevantChunks, getDocumentMetadata } from './ragService.js';

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_HISTORY_TOKENS = 1800;
const MAX_PAST_CONVERSATIONS_TOKENS = 1200;
const MIN_DOCUMENT_TEXT_THRESHOLD = 50; // Minimum characters required for valid RAG grounding

export function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateHistoryToTokenBudget(history, maxTokens = DEFAULT_MAX_HISTORY_TOKENS) {
  let totalTokens = 0;
  for (const msg of history) {
    totalTokens += estimateTokenCount(msg.content);
  }

  if (totalTokens <= maxTokens) {
    return {
      truncatedHistory: history,
      tokensUsed: totalTokens,
      droppedTurns: 0,
    };
  }

  const copy = [...history];
  let droppedTurns = 0;

  while (copy.length > 2 && totalTokens > maxTokens) {
    const dropped1 = copy.shift();
    const dropped2 = copy.shift();
    droppedTurns += 1;

    totalTokens -= estimateTokenCount(dropped1?.content || '');
    totalTokens -= estimateTokenCount(dropped2?.content || '');
  }

  return {
    truncatedHistory: copy,
    tokensUsed: totalTokens,
    droppedTurns,
  };
}

/**
 * 3-Tier Multi-Context Assembler with Token-Bounded Full Past Conversation History Access,
 * LangChain RAG Document Retrieval, and Strict Anti-Hallucination Guardrails
 */
export async function getSessionContext(sessionId, currentQuery = '', userId = 'guest-user-default', options = {}) {
  const maxHistoryTokens = options.maxHistoryTokens || DEFAULT_MAX_HISTORY_TOKENS;
  const maxMemoryTokens = options.maxMemoryTokens || MEMORY_MAX_TOKENS;
  const maxKnowledgeTokens = options.maxKnowledgeTokens || KNOWLEDGE_MAX_TOKENS;
  const fileId = options.fileId || null;

  // 1. Tier 1: Load active session messages
  const rawMessages = await db.getMessagesBySession(sessionId);

  const formatted = rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const { truncatedHistory, tokensUsed, droppedTurns } = truncateHistoryToTokenBudget(
    formatted,
    maxHistoryTokens
  );

  // 2. Tier 2: Semantic search for relevant user memories (structured facts)
  const relevantMemories = currentQuery
    ? await searchUserMemories(userId, currentQuery, maxMemoryTokens)
    : [];

  // 2.5. Full Access to Past Conversations (Token-Bounded to prevent TPM overflow)
  const allPastConversations = await db.getAllPastConversationsWithFullHistory(userId, sessionId);
  const relevantPastChats = currentQuery
    ? await searchPreviousChatHistory(userId, sessionId, currentQuery)
    : [];

  // 3. Tier 3: Semantic search for relevant domain knowledge chunks
  const relevantKnowledge = currentQuery
    ? await searchKnowledgeBase(currentQuery, maxKnowledgeTokens)
    : [];

  // 4. RAG Document Retrieval & Anti-Hallucination Check
  let relevantDocumentChunks = [];
  let attachedDocumentMeta = null;
  let totalDocumentExtractedChars = 0;

  if (fileId) {
    attachedDocumentMeta = getDocumentMetadata(fileId);
    relevantDocumentChunks = retrieveRelevantChunks(fileId, currentQuery, 5);
    totalDocumentExtractedChars = relevantDocumentChunks.reduce(
      (acc, c) => acc + (c.content?.length || 0),
      0
    );
  }

  // Build Enriched Context Prompt Fragment
  let contextualMemorySection = '';

  // Injected RAG Document Context with Strict Anti-Hallucination Guardrails
  if (fileId) {
    const filename = attachedDocumentMeta?.filename || 'Attached Document';

    if (!attachedDocumentMeta || relevantDocumentChunks.length === 0 || totalDocumentExtractedChars < MIN_DOCUMENT_TEXT_THRESHOLD) {
      // Guardrail: Explicitly intercept extraction failure and forbid filename guessing
      contextualMemorySection += `\n\n[ATTACHED DOCUMENT NOTICE - EXTRACTION FAILED / EMPTY]: "${filename}"\n`;
      contextualMemorySection += `SYSTEM ALERT: Text extraction from the attached file "${filename}" returned EMPTY or unreadable content (less than ${MIN_DOCUMENT_TEXT_THRESHOLD} characters of readable text found).\n`;
      contextualMemorySection += `STRICT ANTI-HALLUCINATION DIRECTIVES (MANDATORY):\n`;
      contextualMemorySection += `1. DO NOT GUESS, extrapolate, infer, or fabricate document content based purely on the filename "${filename}" or general domain knowledge.\n`;
      contextualMemorySection += `2. You MUST state clearly and directly: "I was unable to extract readable text from '${filename}'. The file may be a scanned document, image-only slide export, or contains no selectable digital text."\n`;
      contextualMemorySection += `3. Politely ask the user to verify if the file contains selectable digital text, or upload a text-based version.\n`;
      contextualMemorySection += `4. NEVER present a generic summary as if it were extracted from this file.\n`;
    } else {
      // Valid extracted content present: Inject chunks with strict factual grounding directive
      contextualMemorySection += `\n\n[UPLOADED DOCUMENT CONTEXT (RAG)]: "${filename}"\n`;
      contextualMemorySection += 'The user has attached the document below for analysis. Ground your answers strictly in the following extracted excerpts:\n';
      for (const chunk of relevantDocumentChunks) {
        contextualMemorySection += `--- Excerpt (Index ${chunk.chunkIndex + 1}) ---\n${chunk.content}\n`;
      }
      contextualMemorySection += '\nSTRICT FACTUAL GROUNDING & ANTI-HALLUCINATION DIRECTIVES:\n';
      contextualMemorySection += '- Answer ONLY using the factual statements present in the document excerpts above.\n';
      contextualMemorySection += '- If the excerpts do NOT contain information needed to answer the question, explicitly state: "The attached document does not contain details regarding [topic]."\n';
      contextualMemorySection += '- DO NOT invent facts, extrapolate, or bring in outside assumptions not substantiated by the document.\n';
    }
  }

  if (relevantMemories.length > 0) {
    contextualMemorySection += '\n\n[USER PROFILE & LONG-TERM MEMORIES STORE]:\n';
    contextualMemorySection += 'The following persistent facts about this user are stored in memory across conversations:\n';
    for (const mem of relevantMemories) {
      contextualMemorySection += `- ${mem.fact}\n`;
    }
    contextualMemorySection += 'CRITICAL: If the user asks about their name, project, tech stack, or background, ALWAYS refer to the stored facts above to answer directly and accurately.\n';
  }

  // Token-Bounded Full Past Conversation Catalog
  if (allPastConversations && allPastConversations.length > 0) {
    contextualMemorySection += '\n\n[FULL CATALOG OF USER\'S PAST CONVERSATIONS & SESSIONS]:\n';
    contextualMemorySection += 'You have access to the user\'s past conversation sessions below. Reference them whenever the user asks about previous chats, earlier topics, or past responses:\n';

    let pastTokensCount = 0;
    for (const conv of allPastConversations) {
      if (pastTokensCount >= MAX_PAST_CONVERSATIONS_TOKENS) break;

      const header = `\n--- Session: "${conv.title}" ---\n`;
      contextualMemorySection += header;
      pastTokensCount += estimateTokenCount(header);

      // Take the most recent/relevant turns of each session
      const recentMsgs = conv.messages.slice(-4);
      for (const msg of recentMsgs) {
        if (pastTokensCount >= MAX_PAST_CONVERSATIONS_TOKENS) break;
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        const line = `  [${roleLabel}]: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}\n`;
        contextualMemorySection += line;
        pastTokensCount += estimateTokenCount(line);
      }
    }
    contextualMemorySection += '\nCRITICAL: If the user asks what was discussed in previous conversations, refers to previous chats, or asks questions related to past topics, answer accurately using the conversation history above.\n';
  } else if (relevantPastChats.length > 0) {
    contextualMemorySection += '\n\n[EXCERPTS FROM USER\'S PREVIOUS CHATS & CONVERSATIONS]:\n';
    contextualMemorySection += 'The user discussed the following in other conversation sessions:\n';
    for (const chat of relevantPastChats) {
      const title = chat.sessionTitle || 'Previous Chat';
      const rolePrefix = chat.role === 'user' ? 'User asked' : 'Assistant noted';
      contextualMemorySection += `- In chat "${title}" (${rolePrefix}): "${chat.content}"\n`;
    }
    contextualMemorySection += 'CRITICAL: If the user asks what was discussed in previous conversations, reference the excerpts above accurately.\n';
  }

  if (relevantKnowledge.length > 0) {
    contextualMemorySection += '\n\n[DOMAIN KNOWLEDGE BASE]:\n';
    for (const k of relevantKnowledge) {
      contextualMemorySection += `[${k.title}]: ${k.content}\n`;
    }
  }

  return {
    history: truncatedHistory,
    totalTokensEstimated: tokensUsed,
    droppedTurns,
    rawCount: rawMessages.length,
    relevantMemories,
    relevantPastChats,
    allPastConversations,
    relevantKnowledge,
    relevantDocumentChunks,
    attachedDocumentMeta,
    totalDocumentExtractedChars,
    contextualMemorySection,
  };
}
