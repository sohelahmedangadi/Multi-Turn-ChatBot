import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import {
  tavilySearch,
  formatTavilyResultsForContext,
  formatThinResultsWarning,
  extractGeminiGroundingSources,
  extractSearchQueryFromText,
  isIdentityOrFactualQuery,
  checkForUnverifiedFactualClaims,
  isTavilyConfigured,
} from './webSearchService.js';

// Global cached client instances with lazy init
let geminiClient = null;
let cachedGeminiKey = null;
let groqClient = null;
let cachedGroqKey = null;

export function getActiveProviderName() {
  return 'gemini';
}

export function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  if (!geminiClient || cachedGeminiKey !== apiKey) {
    cachedGeminiKey = apiKey;
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export function getGroqClient() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in environment.');
  }
  if (!groqClient || cachedGroqKey !== apiKey) {
    cachedGroqKey = apiKey;
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Supported Gemini models in primary order
 */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-pro-preview',
];

/**
 * Active fallback models on Groq
 */
const GROQ_FALLBACK_MODELS = [
  'qwen/qwen3.8-27b',
  'groq/compound',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'qwen/qwen3.6-27b',
  'allam-2-7b',
];

/**
 * Circuit Breaker State for Gemini
 */
let geminiCircuitOpenUntil = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000; // 60s cooldown on 429 quota exhaustion
const PER_CALL_TIMEOUT_MS = 9000; // 9s max per individual model call

/**
 * Hard per-call timeout helper
 */
function withTimeout(promise, timeoutMs = PER_CALL_TIMEOUT_MS, errorLabel = 'LLM API Call') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${errorLabel} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
    }),
  ]);
}

export function isGeminiCircuitOpen() {
  return Date.now() < geminiCircuitOpenUntil;
}

export function tripGeminiCircuitBreaker() {
  geminiCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  console.warn(`[Gemini Circuit Breaker] 429 quota error encountered. Opening circuit breaker for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`);
}

/**
 * Universal Non-Streaming Response Generator
 * Primary: Google Gemini with Native Google Search Grounding & Mandatory Identity Search Injection.
 * Fallback: Groq with Tavily Search API.
 */
export async function generateResponse(
  history,
  message,
  systemPrompt = 'You are a helpful, precise multi-turn conversational AI assistant.',
  options = {}
) {
  const startTime = Date.now();

  // Check if query asks for identity / real name / biographical facts
  const isFactualOrIdentity = isIdentityOrFactualQuery(message);
  let proactiveSearchContext = '';
  let proactiveSources = [];
  let forcedSearch = false;
  let searchQuery = null;

  if (isFactualOrIdentity && isTavilyConfigured()) {
    forcedSearch = true;
    searchQuery = message.trim();
    console.log(`[Mandatory Search] Identified factual/identity query: "${searchQuery}". Proactively querying Tavily...`);
    try {
      const searchResult = await tavilySearch(searchQuery, { maxResults: 5, timeoutMs: 7000 });
      if (searchResult && (!searchResult.error || searchResult.results?.length > 0)) {
        proactiveSources = (searchResult.results || []).map((r) => ({
          title: r.title || 'Web Source',
          url: r.url || '',
        })).filter((s) => s.url);

        proactiveSearchContext = '\n\n' + formatTavilyResultsForContext(searchResult);
      } else {
        proactiveSearchContext = '\n\n' + formatThinResultsWarning(searchQuery, searchResult?.error || 'No relevant results found');
      }
    } catch (err) {
      console.warn('[Mandatory Search] Proactive search error:', err.message);
      proactiveSearchContext = '\n\n' + formatThinResultsWarning(searchQuery, err.message);
    }
  }

  const effectiveSystemPromptWithSearch = systemPrompt + proactiveSearchContext;

  // 1. Primary Engine: Gemini with Native Google Search Grounding
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    if (isGeminiCircuitOpen()) {
      const remainingSec = Math.ceil((geminiCircuitOpenUntil - Date.now()) / 1000);
      console.warn(`[Gemini Circuit Breaker] Circuit is OPEN (cooling down for ${remainingSec}s). Fast-routing directly to Groq fallback.`);
    } else {
      try {
        const ai = getGeminiClient();
        const candidateModels = options?.model
          ? [options.model, ...GEMINI_MODELS.filter((m) => m !== options.model)]
          : GEMINI_MODELS;

        const contents = [
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ];

        for (const model of candidateModels) {
          try {
            // Enable native Google Search Grounding tool
            const response = await withTimeout(
              ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction: effectiveSystemPromptWithSearch,
                  temperature: 0.7,
                  tools: [{ googleSearch: {} }],
                },
              }),
              PER_CALL_TIMEOUT_MS,
              `Gemini Grounded (${model})`
            );

            const text = response.text || '';
            const latencyMs = Date.now() - startTime;
            const tokensEstimated = Math.ceil((text.length + message.length) / 4);

            // Extract Google Search Grounding citations and queries
            const groundingInfo = extractGeminiGroundingSources(response);

            // Merge proactive Tavily sources with Gemini grounding sources (deduplicating URLs)
            const combinedSourcesMap = new Map();
            for (const s of [...proactiveSources, ...(groundingInfo.sources || [])]) {
              if (s.url && !combinedSourcesMap.has(s.url)) {
                combinedSourcesMap.set(s.url, s);
              }
            }
            const sources = Array.from(combinedSourcesMap.values());
            const usedWebSearch = Boolean(groundingInfo.usedWebSearch || forcedSearch || sources.length > 0);
            const activeSearchQuery = groundingInfo.searchQueries[0] || searchQuery || null;

            // Zero-Source / Unverified claim post-processing guard
            const claimCheck = checkForUnverifiedFactualClaims(text, sources, usedWebSearch);

            console.log(`[LLM Response] Provider: gemini, Model: ${model}, Latency: ${latencyMs}ms, UsedWebSearch: ${usedWebSearch}, ForcedSearch: ${forcedSearch}, SourcesCount: ${sources.length}, UnverifiedClaim: ${claimCheck.hasUnverifiedClaim}`);

            return {
              text,
              provider: 'gemini',
              model,
              latencyMs,
              tokensEstimated,
              isFallback: false,
              usedWebSearch,
              forcedSearch,
              searchQuery: activeSearchQuery,
              sources,
              unverifiedClaim: claimCheck.hasUnverifiedClaim,
              unverifiedWarning: claimCheck.warning,
            };
          } catch (err) {
            const errMsg = err?.message || String(err);
            const isQuota =
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('GenerateRequestsPerDay') ||
              errMsg.includes('429') ||
              errMsg.includes('quota');

            if (isQuota) {
              tripGeminiCircuitBreaker();
              break; // Fail over immediately to Groq without trying other Gemini models
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[Gemini] Generation failed, initiating Groq fallback:', geminiErr?.message || geminiErr);
      }
    }
  }

  // 2. Secondary Engine: Automatic Failover to Groq + Tavily Search
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    try {
      const groq = getGroqClient();
      const safeSystemPrompt =
        typeof effectiveSystemPromptWithSearch === 'string' && effectiveSystemPromptWithSearch.trim()
          ? effectiveSystemPromptWithSearch.trim()
          : 'You are a helpful, precise multi-turn conversational AI assistant.';

      const messages = [
        { role: 'system', content: safeSystemPrompt },
        ...(Array.isArray(history) ? history : [])
          .filter((m) => m && m.content && typeof m.content === 'string' && m.content.trim())
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim(),
          })),
        { role: 'user', content: String(message || '').trim() || 'Hello' },
      ];

      for (const model of GROQ_FALLBACK_MODELS) {
        try {
          const completion = await withTimeout(
            groq.chat.completions.create({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 1024,
            }),
            PER_CALL_TIMEOUT_MS,
            `Groq (${model})`
          );

          let text = completion.choices[0]?.message?.content || '';
          let usedWebSearch = forcedSearch;
          let activeSearchQuery = searchQuery;
          let sources = [...proactiveSources];

          // If proactive search didn't run, check if Groq requested search via [SEARCH: ...]
          const extractedQuery = extractSearchQueryFromText(text);

          if (!forcedSearch && extractedQuery && isTavilyConfigured()) {
            activeSearchQuery = extractedQuery;
            console.log(`[Groq Fallback] Detected search request: "${activeSearchQuery}". Querying Tavily Search API...`);

            try {
              const searchResult = await tavilySearch(activeSearchQuery, { maxResults: 5, timeoutMs: 7000 });

              if (searchResult && (!searchResult.error || searchResult.results?.length > 0)) {
                usedWebSearch = true;
                sources = (searchResult.results || []).map((r) => ({
                  title: r.title || 'Web Source',
                  url: r.url || '',
                })).filter((s) => s.url);

                const searchContext = formatTavilyResultsForContext(searchResult);

                // Re-prompt Groq with the verified search results injected
                const retryMessages = [
                  ...messages,
                  { role: 'assistant', content: text },
                  {
                    role: 'user',
                    content: `Search Results for "${activeSearchQuery}":\n\n${searchContext}\n\nUse these verified search results to synthesize an accurate, direct answer to the original user question. If the information is not present in the search results, state clearly that it could not be verified. Do NOT invent names, aliases, or details. Cite sources with markdown links.`,
                  },
                ];

                const retryCompletion = await withTimeout(
                  groq.chat.completions.create({
                    model,
                    messages: retryMessages,
                    temperature: 0.7,
                    max_tokens: 1024,
                  }),
                  PER_CALL_TIMEOUT_MS,
                  `Groq Search Synthesis (${model})`
                );

                text = retryCompletion.choices[0]?.message?.content || text;
              } else {
                console.warn(`[Groq Fallback] Tavily search returned no results or error:`, searchResult?.error);
              }
            } catch (searchErr) {
              console.warn('[Groq Fallback] Search integration error:', searchErr?.message || searchErr);
            }
          }

          const latencyMs = Date.now() - startTime;
          const tokensEstimated =
            completion.usage?.total_tokens || Math.ceil((text.length + message.length) / 4);

          // Zero-Source / Unverified claim post-processing guard
          const claimCheck = checkForUnverifiedFactualClaims(text, sources, usedWebSearch);

          console.log(`[LLM Response] Provider: groq, Model: ${model}, Latency: ${latencyMs}ms, UsedWebSearch: ${usedWebSearch}, ForcedSearch: ${forcedSearch}, SourcesCount: ${sources.length}, UnverifiedClaim: ${claimCheck.hasUnverifiedClaim}`);

          return {
            text,
            provider: 'groq',
            model,
            latencyMs,
            tokensEstimated,
            isFallback: true,
            usedWebSearch,
            forcedSearch,
            searchQuery: activeSearchQuery,
            sources,
            unverifiedClaim: claimCheck.hasUnverifiedClaim,
            unverifiedWarning: claimCheck.warning,
          };
        } catch (groqModelErr) {
          console.warn(`[Groq Fallback] Model ${model} failed (${groqModelErr?.message}), trying next candidate...`);
        }
      }
    } catch (groqErr) {
      console.error('[Groq Fallback] Error executing fallback:', groqErr?.message || groqErr);
    }
  }

  throw new Error('LLM Generation Error: Both Gemini and fallback services are currently unavailable. Please check your API keys in .env.');
}

/**
 * Universal Streaming Response Generator
 * Primary: Google Gemini with Native Google Search Grounding & Mandatory Identity Search Injection.
 * Fallback: Groq with Tavily Search API.
 */
export async function generateStreamResponse(
  history,
  message,
  systemPrompt = 'You are a helpful, precise multi-turn conversational AI assistant.',
  onChunk,
  options = {}
) {
  const startTime = Date.now();

  // Check if query asks for identity / real name / biographical facts
  const isFactualOrIdentity = isIdentityOrFactualQuery(message);
  let proactiveSearchContext = '';
  let proactiveSources = [];
  let forcedSearch = false;
  let searchQuery = null;

  if (isFactualOrIdentity && isTavilyConfigured()) {
    forcedSearch = true;
    searchQuery = message.trim();
    console.log(`[Mandatory Stream Search] Identified factual/identity query: "${searchQuery}". Proactively querying Tavily...`);
    try {
      const searchResult = await tavilySearch(searchQuery, { maxResults: 5, timeoutMs: 7000 });
      if (searchResult && (!searchResult.error || searchResult.results?.length > 0)) {
        proactiveSources = (searchResult.results || []).map((r) => ({
          title: r.title || 'Web Source',
          url: r.url || '',
        })).filter((s) => s.url);

        proactiveSearchContext = '\n\n' + formatTavilyResultsForContext(searchResult);
      } else {
        proactiveSearchContext = '\n\n' + formatThinResultsWarning(searchQuery, searchResult?.error || 'No relevant results found');
      }
    } catch (err) {
      console.warn('[Mandatory Stream Search] Proactive search error:', err.message);
      proactiveSearchContext = '\n\n' + formatThinResultsWarning(searchQuery, err.message);
    }
  }

  const effectiveSystemPromptWithSearch = systemPrompt + proactiveSearchContext;

  // 1. Primary Engine: Gemini Streaming with Native Google Search Grounding
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    if (isGeminiCircuitOpen()) {
      const remainingSec = Math.ceil((geminiCircuitOpenUntil - Date.now()) / 1000);
      console.warn(`[Gemini Stream Circuit Breaker] Circuit is OPEN (cooling down for ${remainingSec}s). Fast-routing directly to Groq stream fallback.`);
    } else {
      try {
        const ai = getGeminiClient();
        const candidateModels = options?.model
          ? [options.model, ...GEMINI_MODELS.filter((m) => m !== options.model)]
          : GEMINI_MODELS;

        const contents = [
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ];

        for (const model of candidateModels) {
          try {
            const responseStream = await withTimeout(
              ai.models.generateContentStream({
                model,
                contents,
                config: {
                  systemInstruction: effectiveSystemPromptWithSearch,
                  temperature: 0.7,
                  tools: [{ googleSearch: {} }],
                },
              }),
              PER_CALL_TIMEOUT_MS,
              `Gemini Stream Grounded (${model})`
            );

            let fullText = '';
            let lastChunk = null;

            for await (const chunk of responseStream) {
              lastChunk = chunk;
              const chunkText = chunk.text || '';
              if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
              }
            }

            const latencyMs = Date.now() - startTime;
            const tokensEstimated = Math.ceil((fullText.length + message.length) / 4);

            // Extract Google Search Grounding info from the streaming response
            const groundingInfo = extractGeminiGroundingSources(lastChunk);

            // Merge proactive Tavily sources with Gemini grounding sources (deduplicating URLs)
            const combinedSourcesMap = new Map();
            for (const s of [...proactiveSources, ...(groundingInfo.sources || [])]) {
              if (s.url && !combinedSourcesMap.has(s.url)) {
                combinedSourcesMap.set(s.url, s);
              }
            }
            const sources = Array.from(combinedSourcesMap.values());
            const usedWebSearch = Boolean(groundingInfo.usedWebSearch || forcedSearch || sources.length > 0);
            const activeSearchQuery = groundingInfo.searchQueries[0] || searchQuery || null;

            // Zero-Source / Unverified claim post-processing guard
            const claimCheck = checkForUnverifiedFactualClaims(fullText, sources, usedWebSearch);

            console.log(`[LLM Stream Response] Provider: gemini, Model: ${model}, Latency: ${latencyMs}ms, UsedWebSearch: ${usedWebSearch}, ForcedSearch: ${forcedSearch}, SourcesCount: ${sources.length}, UnverifiedClaim: ${claimCheck.hasUnverifiedClaim}`);

            return {
              text: fullText,
              provider: 'gemini',
              model,
              latencyMs,
              tokensEstimated,
              isFallback: false,
              usedWebSearch,
              forcedSearch,
              searchQuery: activeSearchQuery,
              sources,
              unverifiedClaim: claimCheck.hasUnverifiedClaim,
              unverifiedWarning: claimCheck.warning,
            };
          } catch (err) {
            const errMsg = err?.message || String(err);
            const isQuota =
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('GenerateRequestsPerDay') ||
              errMsg.includes('429') ||
              errMsg.includes('quota');

            if (isQuota) {
              tripGeminiCircuitBreaker();
              break; // Fail over immediately to Groq stream
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[Gemini Stream] Stream failed, initiating Groq fallback:', geminiErr?.message || geminiErr);
      }
    }
  }

  // 2. Secondary Engine: Automatic Stream Failover to Groq + Tavily
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    try {
      const groq = getGroqClient();
      const safeSystemPrompt =
        typeof effectiveSystemPromptWithSearch === 'string' && effectiveSystemPromptWithSearch.trim()
          ? effectiveSystemPromptWithSearch.trim()
          : 'You are a helpful, precise multi-turn conversational AI assistant.';

      const messages = [
        { role: 'system', content: safeSystemPrompt },
        ...(Array.isArray(history) ? history : [])
          .filter((m) => m && m.content && typeof m.content === 'string' && m.content.trim())
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim(),
          })),
        { role: 'user', content: String(message || '').trim() || 'Hello' },
      ];

      for (const model of GROQ_FALLBACK_MODELS) {
        try {
          const stream = await withTimeout(
            groq.chat.completions.create({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 1024,
              stream: true,
            }),
            PER_CALL_TIMEOUT_MS,
            `Groq Stream (${model})`
          );

          let fullText = '';
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
          }

          let usedWebSearch = forcedSearch;
          let activeSearchQuery = searchQuery;
          let sources = [...proactiveSources];

          // Detect search trigger from Groq stream if not already forced
          const extractedStreamQuery = extractSearchQueryFromText(fullText);

          if (!forcedSearch && extractedStreamQuery && isTavilyConfigured()) {
            activeSearchQuery = extractedStreamQuery;
            console.log(`[Groq Stream Fallback] Detected search request: "${activeSearchQuery}". Querying Tavily Search API...`);

            try {
              const searchResult = await tavilySearch(activeSearchQuery, { maxResults: 5, timeoutMs: 7000 });

              if (searchResult && (!searchResult.error || searchResult.results?.length > 0)) {
                usedWebSearch = true;
                sources = (searchResult.results || []).map((r) => ({
                  title: r.title || 'Web Source',
                  url: r.url || '',
                })).filter((s) => s.url);

                const searchContext = formatTavilyResultsForContext(searchResult);
                onChunk('\n\n🔍 *Verified live data retrieved via Tavily. Synthesizing response...*\n\n');

                const retryMessages = [
                  ...messages,
                  { role: 'assistant', content: fullText },
                  {
                    role: 'user',
                    content: `Search Results for "${activeSearchQuery}":\n\n${searchContext}\n\nUse these verified search results to synthesize an accurate, direct answer to the original user question. If the information is not present in the search results, state clearly that it could not be verified. Do NOT invent names, aliases, or details. Cite sources with markdown links.`,
                  },
                ];

                const retryStream = await withTimeout(
                  groq.chat.completions.create({
                    model,
                    messages: retryMessages,
                    temperature: 0.7,
                    max_tokens: 1024,
                    stream: true,
                  }),
                  PER_CALL_TIMEOUT_MS,
                  `Groq Search Synthesis Stream (${model})`
                );

                fullText = '';
                for await (const chunk of retryStream) {
                  const delta = chunk.choices[0]?.delta?.content || '';
                  if (delta) {
                    fullText += delta;
                    onChunk(delta);
                  }
                }
              } else {
                console.warn(`[Groq Stream Fallback] Tavily returned no results or error:`, searchResult?.error);
              }
            } catch (searchErr) {
              console.warn('[Groq Stream Fallback] Tavily search error:', searchErr?.message || searchErr);
            }
          }

          const latencyMs = Date.now() - startTime;
          const tokensEstimated = Math.ceil((fullText.length + message.length) / 4);

          // Zero-Source / Unverified claim post-processing guard
          const claimCheck = checkForUnverifiedFactualClaims(fullText, sources, usedWebSearch);

          console.log(`[LLM Stream Response] Provider: groq, Model: ${model}, Latency: ${latencyMs}ms, UsedWebSearch: ${usedWebSearch}, ForcedSearch: ${forcedSearch}, SourcesCount: ${sources.length}, UnverifiedClaim: ${claimCheck.hasUnverifiedClaim}`);

          return {
            text: fullText,
            provider: 'groq',
            model,
            latencyMs,
            tokensEstimated,
            isFallback: true,
            usedWebSearch,
            forcedSearch,
            searchQuery: activeSearchQuery,
            sources,
            unverifiedClaim: claimCheck.hasUnverifiedClaim,
            unverifiedWarning: claimCheck.warning,
          };
        } catch (groqModelErr) {
          console.warn(`[Groq Stream Fallback] Model ${model} failed (${groqModelErr?.message}), trying next candidate...`);
        }
      }
    } catch (groqStreamErr) {
      console.error('[Groq Stream Fallback] Error in fallback stream:', groqStreamErr?.message || groqStreamErr);
    }
  }

  throw new Error('LLM Streaming Error: Both Gemini and fallback services are currently unavailable. Please check your API keys in .env.');
}
