/**
 * Web Search Service — DuckDuckGo Search Integration (Python Library)
 * 
 * Provides a web_search(query) tool for real-time web search capabilities.
 * Powered by the DuckDuckGo Search Python library (100% free, no API key required).
 * Returns top 5 results with title, snippet, and URL.
 * Handles errors gracefully — returns an error description instead of throwing.
 */

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'ddgSearch.py');

/**
 * Execute a web search query using the DuckDuckGo Search Python library.
 * 
 * @param {string} query - The search query string
 * @param {number} numResults - Number of results to return (default: 5)
 * @returns {Promise<{results?: Array<{title: string, snippet: string, url: string}>, error?: string}>}
 */
export async function webSearch(query, numResults = 5) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      error: 'Empty or invalid search query provided.',
      results: [],
    };
  }

  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout, stderr } = await execFileAsync(
      pythonCmd,
      [SCRIPT_PATH, query.trim(), String(numResults)],
      {
        timeout: 15000, // 15s timeout
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        encoding: 'utf-8',
      }
    );

    if (stderr && stderr.trim()) {
      console.warn(`[WebSearch DuckDuckGo notice]:`, stderr.trim());
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      return {
        error: `No search results returned for query: "${query}"`,
        results: [],
      };
    }

    const parsed = JSON.parse(trimmed);
    const results = parsed.results || [];

    if (results.length === 0) {
      return {
        error: parsed.error || `No search results found for query: "${query}"`,
        results: [],
      };
    }

    console.log(`[WebSearch DuckDuckGo] Query: "${query}" → ${results.length} results returned.`);

    return {
      results: results.slice(0, numResults),
      error: null,
    };
  } catch (err) {
    console.error(`[WebSearch DuckDuckGo] Execution error:`, err.message || err);
    return {
      error: `Web search execution failed: ${err.message || 'Unknown error'}`,
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

  let formatted = '[WEB SEARCH RESULTS (DuckDuckGo)]:\n';

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
