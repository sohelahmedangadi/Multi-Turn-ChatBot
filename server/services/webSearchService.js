/**
 * Web Search Service — Google Search Grounding & Tavily API Integration
 * 
 * Provides:
 * 1. Gemini Path: Native Google Search Grounding metadata extraction (queries, citations, sources).
 * 2. Groq Path: Tavily Search API with summarized answer extraction, timeout protection, and clean prompt formatting.
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
 * Format Tavily search results into a clean, context-injected block for the Groq fallback path.
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

  formatted += 'INSTRUCTIONS FOR ANSWER SYNTHESIS:\n';
  formatted += '- Ground your response in the verified search data above.\n';
  formatted += '- Provide a comprehensive, direct natural-language response.\n';
  formatted += '- Cite the source URLs clearly (e.g. "[Source Name](url)" or markdown footnotes).\n';

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
