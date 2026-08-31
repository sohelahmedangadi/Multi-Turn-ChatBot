/**
 * Web Search Service — Serper.dev Integration
 * 
 * Provides a web_search(query) tool for real-time web search capabilities.
 * Returns top 5 results with title, snippet, and URL.
 * Handles API errors gracefully — returns an error description instead of throwing.
 */

const SERPER_API_URL = 'https://google.serper.dev/search';

/**
 * Execute a web search query using the Serper.dev API.
 * 
 * @param {string} query - The search query string
 * @param {number} numResults - Number of results to return (default: 5)
 * @returns {Promise<{results?: Array<{title: string, snippet: string, url: string}>, error?: string}>}
 */
export async function webSearch(query, numResults = 5) {
  const apiKey = (process.env.SERPER_API_KEY || '').trim();

  if (!apiKey) {
    console.warn('[WebSearch] SERPER_API_KEY is not configured. Web search is unavailable.');
    return {
      error: 'Web search is not configured. The SERPER_API_KEY environment variable is missing.',
      results: [],
    };
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      error: 'Empty or invalid search query provided.',
      results: [],
    };
  }

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query.trim(),
        num: numResults,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[WebSearch] Serper API returned HTTP ${response.status}: ${errorBody}`);
      return {
        error: `Web search failed with HTTP ${response.status}. The search service may be temporarily unavailable.`,
        results: [],
      };
    }

    const data = await response.json();

    // Extract organic search results
    const organicResults = data.organic || [];
    const formattedResults = organicResults.slice(0, numResults).map((result) => ({
      title: result.title || 'Untitled',
      snippet: result.snippet || '',
      url: result.link || '',
    }));

    // Also check for knowledge graph / answer box for quick factual answers
    let answerBox = null;
    if (data.answerBox) {
      answerBox = {
        title: data.answerBox.title || '',
        answer: data.answerBox.answer || data.answerBox.snippet || '',
        source: data.answerBox.link || '',
      };
    }

    if (formattedResults.length === 0 && !answerBox) {
      return {
        error: `No search results found for query: "${query}"`,
        results: [],
      };
    }

    console.log(`[WebSearch] Query: "${query}" → ${formattedResults.length} results returned.`);

    return {
      results: formattedResults,
      answerBox,
      error: null,
    };
  } catch (err) {
    console.error(`[WebSearch] Network or parsing error:`, err.message || err);
    return {
      error: `Web search failed due to a network error: ${err.message || 'Unknown error'}. Please try again.`,
      results: [],
    };
  }
}

/**
 * Format web search results into a readable text block for LLM context injection.
 * Used by the Groq fallback path where native function calling is not available.
 * 
 * @param {Object} searchResult - The result from webSearch()
 * @returns {string} Formatted text block
 */
export function formatSearchResultsForContext(searchResult) {
  if (searchResult.error && (!searchResult.results || searchResult.results.length === 0)) {
    return `[WEB SEARCH FAILED]: ${searchResult.error}`;
  }

  let formatted = '[WEB SEARCH RESULTS]:\n';

  if (searchResult.answerBox) {
    formatted += `\nDirect Answer: ${searchResult.answerBox.answer}`;
    if (searchResult.answerBox.source) {
      formatted += ` (Source: ${searchResult.answerBox.source})`;
    }
    formatted += '\n';
  }

  for (let i = 0; i < searchResult.results.length; i++) {
    const r = searchResult.results[i];
    formatted += `\n[${i + 1}] ${r.title}\n    ${r.snippet}\n    URL: ${r.url}\n`;
  }

  formatted += '\nINSTRUCTION: Synthesize a natural-language answer from these search results. Cite specific source URLs when referencing facts. Do NOT dump raw results.\n';
  formatted += 'CRITICAL RULE: If the search results do NOT explicitly contain the answer (e.g. real name is unlisted or N/A), DO NOT guess, fabricate, or invent a name. Explicitly state that the information has not been publicly disclosed or documented.\n';

  return formatted;
}

/**
 * Gemini Function Declaration schema for the web_search tool.
 * This is passed to the Gemini API's `tools` parameter.
 */
export const WEB_SEARCH_FUNCTION_DECLARATION = {
  name: 'web_search',
  description:
    'Search the web for current information. Use this when the user asks about current events, recent news, live data, recent software releases, people or entities you don\'t recognize, or anything time-sensitive that your training data may not cover.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'The search query to look up on the web. Be specific and concise.',
      },
    },
    required: ['query'],
  },
};
