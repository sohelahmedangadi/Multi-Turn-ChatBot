/**
 * Zero-Cost Heuristic Ambiguity Pre-Check Engine
 * Detects vague, under-specified queries lacking context before calling the LLM API.
 */

const VAGUE_PRONOUNS = [
  'that',
  'this',
  'it',
  'them',
  'those',
  'these',
  'he',
  'she',
  'him',
  'her',
  'there',
  'the other one',
  'what about that',
  'what about this',
  'what about it',
  'why',
  'how come',
  'explain it',
  'explain this',
  'fix it',
  'fix this',
  'summarize this',
  'summarize it',
  'analyze this',
];

// Regex matching vague action-verb + pronoun standalone requests lacking context
const VAGUE_ACTION_PRONOUN_REGEX =
  /^(?:fix|summarize|explain|analyze|review|check|test|rewrite)\s+(?:it|this|that|them|these|those)\??$/i;

// Regex matching vague starter phrases that are only ambiguous if isolated or followed ONLY by pronouns
// (tightened to prevent false positives on specific queries like "What about Python?" or "Show me quicksort")
const VAGUE_STARTER_REGEX =
  /^(?:what about|how about|tell me more|why is it|can you explain it|what did you mean|elaborate|continue|more details|show me)(?:\s+(?:about\s+)?(?:that|this|it|them|those|these))?$/i;

/**
 * Detects if a query contains inline code, markup tags, code fences, or explicit inline payload
 */
function hasInlineCodeOrExplicitPayload(text) {
  if (!text) return false;
  // Code block fences (``` or `)
  if (text.includes('```') || text.includes('`')) return true;
  // HTML/XML tags (e.g. <code>, <pre>, <div>, etc.)
  if (/<\/?(?:code|pre|div|span|script|template|b|i|p)[^>]*>/i.test(text)) return true;
  // Programming constructs / code statements (semicolon at end, braces, arrows, keywords)
  if (
    /[{};]\s*$/.test(text) ||
    /=>/.test(text) ||
    /\b(?:const|let|var|function|def|class|return|import|console\.log)\b/.test(text)
  ) {
    return true;
  }
  // Explicit delimiter with payload after it (e.g. "Explain this: <code>" or "Explain this: foo()")
  const colonIdx = text.indexOf(':');
  if (colonIdx !== -1 && text.slice(colonIdx + 1).trim().length > 0) {
    return true;
  }
  return false;
}

export function detectAmbiguity(query, recentTurns = [], options = {}) {
  // Normalize options
  const opts = typeof options === 'boolean' ? { hasActiveFile: options } : options || {};
  const hasActiveFile = Boolean(opts.hasActiveFile || opts.activeFile || opts.fileId);
  const hasActiveMedia = Boolean(
    opts.hasMedia || opts.hasActiveMedia || opts.mediaPayload || opts.activeFile?.isVisionRequired
  );

  // 1. If a file or media is attached or active in the session, never intercept as ambiguous
  if (hasActiveFile || hasActiveMedia) {
    return {
      isAmbiguous: false,
      reason: 'Active session document or attached media provides context.',
    };
  }

  const trimmed = (query || '').trim();
  const lower = trimmed.toLowerCase();

  // 2. Empty or just non-alphanumeric punctuation
  if (!trimmed || /^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return {
      isAmbiguous: true,
      reason: 'Empty or non-textual input provided.',
      suggestedClarification: 'Could you please type a question or topic you would like assistance with?',
    };
  }

  // 3. Inline code, explicit code fences, or payload after delimiter are never ambiguous
  if (hasInlineCodeOrExplicitPayload(trimmed)) {
    return {
      isAmbiguous: false,
      reason: 'Query contains inline code, syntax, or explicit payload definition.',
    };
  }

  // 4. Natural direct questions with ambient/expletive subjects (e.g. "Is it raining?", "What time is it?")
  if (
    /^is it (?:raining|snowing|cold|hot|sunny|cloudy|windy|warm)\b/i.test(lower) ||
    /^what time is it\b/i.test(lower)
  ) {
    return {
      isAmbiguous: false,
      reason: 'Natural direct question with ambient or non-referential subject.',
    };
  }

  // 5. If there is recent substantial context, short pronouns can often be resolved by conversational history
  const hasSubstantialContext =
    recentTurns.length > 0 &&
    recentTurns.some(
      (t) => (t.content || '').length > 25 && !t.content.includes('Could you clarify')
    );

  if (hasSubstantialContext) {
    return {
      isAmbiguous: false,
      reason: 'Query context is resolved by recent conversational history.',
    };
  }

  // 6. Action-verb + pronoun standalone requests lacking file/history (e.g. "Fix it", "Summarize this")
  if (VAGUE_ACTION_PRONOUN_REGEX.test(lower)) {
    return {
      isAmbiguous: true,
      reason: 'Query contains vague action verb referencing an unspecified referent without attached file or context.',
      suggestedClarification: 'Could you clarify what "it/that" refers to so I can provide an accurate answer?',
    };
  }

  // 7. Isolated vague pronouns or tightened vague starters without specific referents
  const cleanPunctuation = lower.replace(/[?!.,]+$/, '').trim();
  const isPronounOnly = VAGUE_PRONOUNS.includes(cleanPunctuation);
  const isVagueStarter = VAGUE_STARTER_REGEX.test(cleanPunctuation);

  if (isPronounOnly || isVagueStarter) {
    let suggested = 'Could you please specify which topic, object, or concept you are referring to?';
    if (
      cleanPunctuation.includes('that') ||
      cleanPunctuation.includes('this') ||
      cleanPunctuation.includes('it')
    ) {
      suggested = 'Could you clarify what "it/that" refers to so I can provide an accurate answer?';
    } else if (cleanPunctuation === 'why' || cleanPunctuation === 'how come') {
      suggested = 'Could you please specify what event, reason, or concept you would like me to explain?';
    }

    return {
      isAmbiguous: true,
      reason: 'Query contains vague pronouns or referents without existing dialogue context.',
      suggestedClarification: suggested,
    };
  }

  return {
    isAmbiguous: false,
    reason: 'Query contains sufficient entity detail or reference context.',
  };
}
