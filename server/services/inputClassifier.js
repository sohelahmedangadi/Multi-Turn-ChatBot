/**
 * Input Classifier Service (server/services/inputClassifier.js)
 * 
 * Performs ultra-fast, zero-cost rule-based pre-classification on user messages
 * before dispatching to LLM providers.
 * 
 * Determines:
 * 1. needsWebSearch: boolean (whether search grounding should be forced/enabled)
 * 2. reason: string (diagnostic category identifier)
 * 3. suggestedProvider: 'gemini' | 'groq' | 'either' (advisory routing hint)
 * 4. confidence: 'high' | 'low' (if 'low', defaults needsWebSearch = true for safety)
 */

import { isIdentityOrFactualQuery } from './webSearchService.js';

/**
 * Classifies an incoming message to determine search necessity and advisory routing.
 * 
 * @param {string} userMessage - Raw user prompt
 * @param {Array} conversationContext - Prior dialogue turns (optional)
 * @returns {{
 *   needsWebSearch: boolean,
 *   reason: string,
 *   suggestedProvider: 'gemini' | 'groq' | 'either',
 *   confidence: 'high' | 'low'
 * }}
 */
export function classifyInput(userMessage, conversationContext = []) {
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return {
      needsWebSearch: false,
      reason: 'empty_query',
      suggestedProvider: 'either',
      confidence: 'high',
    };
  }

  const raw = userMessage.trim();
  const text = raw.toLowerCase();

  // 1. Explicit identity, biographical, reality show & factual queries (Highest Priority Check)
  if (isIdentityOrFactualQuery(raw)) {
    return {
      needsWebSearch: true,
      reason: 'identity_biographical_lookup',
      suggestedProvider: 'gemini',
      confidence: 'high',
    };
  }

  // 2. Time-sensitive keywords & current events
  const currentEventsPatterns = [
    /\b(latest|current|recent|newest|today|yesterday|tonight|this\s+week|this\s+month|this\s+year)\b/i,
    /\b(2025|2026|2027)\b/, // Recent or future calendar years
    /\b(stock\s+price|market\s+cap|crypto\s+price|bitcoin\s+price|ethereum\s+price)\b/i,
    /\b(weather\s+in|forecast\s+for|temperature\s+in)\b/i,
    /\b(live\s+score|match\s+score|ipl\s+score|world\s+cup|champions\s+league|election\s+results)\b/i,
    /\b(breaking\s+news|headline|announcement|press\s+release)\b/i,
    /\b(changelog|release\s+notes|version\s+update)\b/i,
  ];
  if (currentEventsPatterns.some((p) => p.test(text))) {
    return {
      needsWebSearch: true,
      reason: 'current_events_time_sensitive',
      suggestedProvider: 'gemini',
      confidence: 'high',
    };
  }

  // 3. Casual greetings & self-identity ("hi", "hello", "how are you", "who are you", "what can you do")
  const casualGreetingPatterns = [
    /\b(hi|hello|hey|greetings|howdy|sup|yo|good\s+(morning|afternoon|evening|day))\b/i,
    /^how\s+are\s+you([\s?.]*)$/i,
    /^who\s+(are\s+you|made\s+you)([\s?.]*)$/i,
    /^(what\s+is\s+your\s+name|what\s+can\s+you\s+do)([\s?.]*)$/i,
    /\b(thanks|thank\s+you|bye|goodbye|see\s+ya)\b/i,
  ];
  if (casualGreetingPatterns.some((p) => p.test(text))) {
    return {
      needsWebSearch: false,
      reason: 'casual_greeting',
      suggestedProvider: 'groq',
      confidence: 'high',
    };
  }

  // 4. Coding, Syntax, Debugging & Programming help
  const codePatterns = [
    /\b(write|create|debug|fix|refactor|optimize|explain)\s+(a|an|the|this)?\s*(function|code|script|class|component|hook|algorithm|regex|sql|query|loop|api|bug|error)\b/i,
    /\b(python|javascript|typescript|react|vue|angular|node|java|c\+\+|rust|golang|html|css|tailwind|sql|git|npm)\b/i,
    /\b(syntax\s+error|typeerror|referenceerror|stack\s*trace|nullpointerexception|undefined|useeffect|usestate|infinite\s+loop|bug)\b/i,
    /\b(how\s+to\s+(implement|sort|filter|map|reduce|reverse|parse|stringify|traverse|render|fix))\b/i,
    /```[\s\S]*```/, // Embedded code blocks in message
  ];
  if (codePatterns.some((p) => p.test(raw))) {
    return {
      needsWebSearch: false,
      reason: 'code_help',
      suggestedProvider: 'groq',
      confidence: 'high',
    };
  }

  // 5. Mathematical calculations & formal logic
  const mathLogicPatterns = [
    /\b(calculate|compute|solve|evaluate|multiply|divide|add|subtract)\b/i,
    /^\s*[\d\s\+\-\*\/\^\(\)\.\=\%]+\s*$/, // Pure arithmetic like "15 * 37"
    /\bwhat\s+is\s+\d+\s*[\+\-\*\/x]\s*\d+/i,
    /\b\d+\s+(multiplied\s+by|divided\s+by|plus|minus)\s+\d+/i,
    /\b(derivative|integral|square\s+root|logarithm|factorial|fibonacci)\b/i,
    /\b(logic\s+puzzle|truth\s+table|boolean\s+algebra)\b/i,
  ];
  if (mathLogicPatterns.some((p) => p.test(text))) {
    return {
      needsWebSearch: false,
      reason: 'math_logic',
      suggestedProvider: 'groq',
      confidence: 'high',
    };
  }

  // 6. Creative writing, roleplay, storytelling & translations
  const creativePatterns = [
    /\b(write|generate|compose|draft)\s+(a|an)?\s*(poem|story|song|essay|haiku|joke|riddle|email|letter|script)\b/i,
    /\b(translate|paraphrase|rewrite|summarize\s+this\s+text)\b/i,
    /\b(pretend\s+you\s+are|roleplay\s+as|act\s+like)\b/i,
  ];
  if (creativePatterns.some((p) => p.test(text))) {
    return {
      needsWebSearch: false,
      reason: 'creative_writing',
      suggestedProvider: 'either',
      confidence: 'high',
    };
  }

  // 7. General evergreen knowledge & foundational concepts
  const generalKnowledgePatterns = [
    /\b(explain|what\s+is|how\s+does)\s+(recursion|photosynthesis|gravity|mitosis|relativity|osmosis|dna|blockchain|quantum\s+mechanics|evolution|thermodynamics)\b/i,
    /\b(difference\s+between\s+(a\s+stack\s+and\s+a\s+queue|tcp\s+and\s+udp|synchronous\s+and\s+asynchronous))\b/i,
    /\b(what\s+is\s+the\s+speed\s+of\s+light|how\s+many\s+planets|why\s+is\s+the\s+sky\s+blue)\b/i,
  ];
  if (generalKnowledgePatterns.some((p) => p.test(text))) {
    return {
      needsWebSearch: false,
      reason: 'general_knowledge',
      suggestedProvider: 'either',
      confidence: 'high',
    };
  }

  // 8. Named entity lookups (specific product, company, pop culture, show, or person references)
  const entityLookupPatterns = [
    /\b(who|what|where|when|which)\s+(is|are|was|were|did)\s+[A-Z][a-z]+/i, // Capitalized entity
    /\b(net\s+worth|biography|imdb|rotten\s+tomatoes|box\s+office|rating)\s+of\b/i,
    /\b(ceo|founder|director|author|creator|inventor)\s+of\b/i,
    /\b(specs|price|release\s+date|features)\s+of\s+(the\s+)?[A-Z]/i,
  ];
  if (entityLookupPatterns.some((p) => p.test(raw))) {
    return {
      needsWebSearch: true,
      reason: 'named_entity_lookup',
      suggestedProvider: 'gemini',
      confidence: 'high',
    };
  }

  // 9. Ambiguous fallback: Default to needsWebSearch = true with confidence = 'low'
  // Safer to search unnecessarily than risk fabricating facts on unclassified queries.
  return {
    needsWebSearch: true,
    reason: 'ambiguous_query_safe_fallback',
    suggestedProvider: 'either',
    confidence: 'low',
  };
}
