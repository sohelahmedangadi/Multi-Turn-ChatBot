/**
 * Web Search Service — Google Search Grounding, Tavily API Integration & Fact Verification Guardrails
 * 
 * Provides:
 * 1. Pre-classifier for mandatory search on identity/biographical/factual queries.
 * 2. Gemini Path: Native Google Search Grounding metadata extraction (queries, citations, sources).
 * 3. Groq Path: Tavily Search API with summarized answer extraction, timeout protection, and clean prompt formatting.
 * 4. Thin-results & unverified factual claims detection guards.
 */

const TAVILY_API_URL = 'https://api.tavily.com/search';
const DEFAULT_SEARCH_TIMEOUT_MS = 7000; // 7s timeout for Tavily search requests

/**
 * Check if Tavily Search is configured via environment variables.
 */
export function isTavilyConfigured() {
  return Boolean((process.env.TAVILY_API_KEY || '').trim());
}

/**
 * Pre-classifier: Detects queries asking for identity, real names, biographical facts,
 * current events, or specific real-world entity properties where search MUST be forced.
 * 
 * @param {string} query - The incoming user message
 * @returns {boolean}
 */
export function isIdentityOrFactualQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();

  // Pattern checks for identity / real name / biographical / event questions
  const patterns = [
    /\bwho\s+(is|was|are|were)\b/i,
    /\bwhat\s+is\s+.+\b(real\s+name|full\s+name|actual\s+name|birth\s+name|age|birthday|birth\s+date|net\s+worth|origin|wife|husband|spouse|salary|height)\b/i,
    /\b(real\s+name|full\s+name|birth\s+name|actual\s+name)\s+of\b/i,
    /\bwho\s+(plays|played|voiced|portrayed|acts\s+as)\b/i,
    /\b(contestant|participant|winner|runner[\s-]up|host|judge|cast)\s+(on|in|from|of)\b/i,
    /\b(when|where)\s+was\s+.+\s+born\b/i,
    /\b(release\s+date|launch\s+date|air\s+date)\s+of\b/i,
    /\bwhen\s+did\s+.+\s+(release|launch|air|happen|occur|die)\b/i,
    /\b(current\s+)?(president|prime\s+minister|ceo|founder|director|governor|mayor)\s+of\b/i,
    /\bwho\s+won\s+(the\s+)?/i,
    /\bwhat\s+happened\s+to\b/i,
    /\bwhere\s+is\s+.+\s+now\b/i,
    /\b(latest|recent|newest)\s+(version|update|news|score|episode|season)\s+of\b/i,
  ];

  return patterns.some((p) => p.test(q));
}

/**
 * Format thin / empty search results warning for prompt injection.
 * 
 * @param {string} query - Search query
 * @param {string} errorOrDetails - Error reason or details
 * @returns {string}
 */
export function formatThinResultsWarning(query, errorOrDetails = 'Limited results found') {
  let warning = `\n[SEARCH NOTICE - LIMITED/UNVERIFIED SEARCH RESULTS FOR "${query}"]:\n`;
  warning += `Web search returned thin or unverified results (${errorOrDetails}).\n`;
  warning += `MANDATORY ANTI-HALLUCINATION DIRECTIVES:\n`;
  warning += `1. Do NOT guess, extrapolate, or invent missing details (such as real names, aliases, birthplaces, or dates).\n`;
  warning += `2. If the search results do not explicitly confirm a specific fact, state clearly: "This information (e.g. real name/specific detail) could not be verified in available public search sources."\n`;
  warning += `3. Never invent names or aliases not present in verified source material.\n`;
  return warning;
}

/**
 * Post-processing guard: Checks if the generated response makes specific unverified factual claims
 * (such as asserting a person's real name or birth date) when no web sources were confirmed.
 * 
 * @param {string} responseText - Generated LLM response text
 * @param {Array} sources - Array of confirmed citation sources
 * @param {boolean} usedWebSearch - Whether web search was successfully utilized
 * @returns {{hasUnverifiedClaim: boolean, warning: string | null}}
 */
export function checkForUnverifiedFactualClaims(responseText, sources = [], usedWebSearch = false) {
  if (!responseText || typeof responseText !== 'string') {
    return { hasUnverifiedClaim: false, warning: null };
  }

  // If search was used and we have confirmed sources, claim is supported
  if (usedWebSearch && Array.isArray(sources) && sources.length > 0) {
    return { hasUnverifiedClaim: false, warning: null };
  }

  // Patterns that indicate specific factual assertions that might be ungrounded hallucinations
  const ungroundedAssertionPatterns = [
    /\b(real\s+name|legal\s+name|birth\s+name|actual\s+name)\s+(is|was)\s+["']?[A-Z][a-z]+/i,
    /\b(known\s+as|alias\s+is|goes\s+by)\s+["']?[A-Z][a-z]+/i,
    /\bwas\s+born\s+on\s+[A-Z][a-z]+\s+\d{1,2}/i,
    /\b(lives\s+in|resides\s+in|hails\s+from)\s+[A-Z][a-z]+/i,
  ];

  const hasAssertion = ungroundedAssertionPatterns.some((p) => p.test(responseText));

  if (hasAssertion && (!sources || sources.length === 0)) {
    return {
      hasUnverifiedClaim: true,
      warning: '⚠️ Specific biographical claims in this response could not be verified by web search sources.',
    };
  }

  return { hasUnverifiedClaim: false, warning: null };
}

/**
 * Execute a web search query using the Tavily Search API.
 * Requests summarized/answer-focused results (top 3-5).
 * 
 * @param {string} query - Search query string
 * @param {Object} options - Search configuration options
 * @returns {Promise<{results: Array<{title: string, content: string, url: string}>, answer?: string, error?: string}>}
 */
export async function tavilySearch(query, options = {}) {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  const maxResults = options.maxResults || 5;
  const timeoutMs = options.timeoutMs || DEFAULT_SEARCH_TIMEOUT_MS;

  if (!apiKey) {
    console.warn('[Tavily] TAVILY_API_KEY is not configured in environment.');
    return {
      error: 'Tavily web search is not configured. Missing TAVILY_API_KEY.',
      results: [],
      answer: null,
    };
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      error: 'Invalid or empty search query.',
      results: [],
      answer: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (timer.unref) timer.unref();

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[Tavily] API returned status ${response.status}: ${errorText}`);
      return {
        error: `Tavily API returned status ${response.status}`,
        results: [],
        answer: null,
      };
    }

    const data = await response.json();
    const rawResults = data.results || [];
    const formattedResults = rawResults.slice(0, maxResults).map((r) => ({
      title: r.title || 'Untitled',
      content: r.content || r.snippet || '',
      url: r.url || '',
    }));

    const answer = data.answer || null;

    if (formattedResults.length === 0 && !answer) {
      return {
        error: `No relevant search results found for: "${query}"`,
        results: [],
        answer: null,
      };
    }

    console.log(`[Tavily] Query: "${query}" → ${formattedResults.length} results returned (Answer: ${Boolean(answer)})`);

    return {
      results: formattedResults,
      answer,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    const message = isTimeout
      ? `Search request timed out after ${timeoutMs}ms`
      : err.message || 'Unknown network error';
    
    console.warn(`[Tavily] Search error for query "${query}":`, message);

    return {
      error: `Web search unavailable (${message})`,
      results: [],
      answer: null,
    };
  }
}

/**
 * Format Tavily search results into a clean, context-injected block for the LLM prompt.
 * 
 * @param {Object} searchResult - The output from tavilySearch()
 * @returns {string} Formatted markdown block
 */
export function formatTavilyResultsForContext(searchResult) {
  if (!searchResult || (searchResult.error && (!searchResult.results || searchResult.results.length === 0))) {
    return `[SEARCH STATUS: FAILED/EMPTY - ${searchResult?.error || 'No results available'}]`;
  }

  let formatted = '[VERIFIED WEB SEARCH RESULTS (via Tavily)]:\n';

  if (searchResult.answer) {
    formatted += `\nDirect Summary Answer:\n${searchResult.answer}\n`;
  }

  if (Array.isArray(searchResult.results) && searchResult.results.length > 0) {
    formatted += '\nRelevant Web Sources:\n';
    for (let i = 0; i < searchResult.results.length; i++) {
      const item = searchResult.results[i];
      formatted += `[${i + 1}] ${item.title}\n`;
      if (item.content) {
        formatted += `    Summary: ${item.content}\n`;
      }
      formatted += `    URL: ${item.url}\n\n`;
    }
  }

  formatted += 'STRICT INSTRUCTIONS FOR ANSWER SYNTHESIS:\n';
  formatted += '- Ground your response strictly in the verified search data above.\n';
  formatted += '- When answering about a person\'s real name, origin, or facts, ONLY use details explicitly stated in the sources.\n';
  formatted += '- If the search results do not confirm a specific detail, state that it could not be verified. Do NOT invent plausible names or aliases.\n';
  formatted += '- Cite the source URLs clearly (e.g. "[Source Name](url)").\n';

  return formatted;
}

/**
 * Extract Google Search Grounding metadata and citations from Gemini API responses.
 * 
 * @param {Object} response - The raw response from Gemini generateContent / generateContentStream
 * @returns {{usedWebSearch: boolean, searchQueries: string[], sources: Array<{title: string, url: string}>}}
 */
export function extractGeminiGroundingSources(response) {
  const result = {
    usedWebSearch: false,
    searchQueries: [],
    sources: [],
  };

  try {
    const candidate = response?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    if (!groundingMetadata) {
      return result;
    }

    // 1. Extract search queries executed by Google Search
    if (Array.isArray(groundingMetadata.webSearchQueries)) {
      result.searchQueries = groundingMetadata.webSearchQueries.filter(Boolean);
    }

    // 2. Extract grounding chunks (web links and titles)
    if (Array.isArray(groundingMetadata.groundingChunks)) {
      const seenUrls = new Set();
      for (const chunk of groundingMetadata.groundingChunks) {
        const web = chunk.web;
        if (web && web.uri && !seenUrls.has(web.uri)) {
          seenUrls.add(web.uri);
          result.sources.push({
            title: web.title || 'Web Source',
            url: web.uri,
          });
        }
      }
    }

    // Mark as used if search queries or grounding sources exist
    if (result.searchQueries.length > 0 || result.sources.length > 0) {
      result.usedWebSearch = true;
    }
  } catch (err) {
    console.warn('[Gemini Grounding] Failed to parse grounding metadata:', err.message);
  }

  return result;
}

/**
 * Extract search query from non-native tool models (Groq fallback).
 * Supports [SEARCH: query], ```web_search\nquery: "..."```, and web_search("...") patterns.
 */
export function extractSearchQueryFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. [SEARCH: ...] or [web_search: ...]
  const bracketMatch = text.match(/\[(?:SEARCH|web_search):\s*(.+?)\]/i);
  if (bracketMatch && bracketMatch[1]?.trim()) {
    return bracketMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // 2. ```web_search ... query: "..." ... ```
  const codeBlockMatch = text.match(/```(?:web_search|search)[\s\S]*?query:\s*["']?([^"'\r\n]+)["']?[\s\S]*?```/i);
  if (codeBlockMatch && codeBlockMatch[1]?.trim()) {
    return codeBlockMatch[1].trim();
  }

  // 3. web_search("...") or web_search(query="...")
  const fnCallMatch = text.match(/web_search\s*\(\s*(?:query\s*=\s*)?["']([^"'\r\n]+)["']\s*\)/i);
  if (fnCallMatch && fnCallMatch[1]?.trim()) {
    return fnCallMatch[1].trim();
  }

  return null;
}
