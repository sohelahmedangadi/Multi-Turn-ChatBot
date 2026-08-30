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
  'why',
  'how come',
  'explain it',
];

const VAGUE_STARTERS = [
  'what about',
  'how about',
  'tell me more',
  'why is it',
  'can you explain it',
  'what did you mean',
  'elaborate',
  'continue',
  'more details',
  'show me',
];

export function detectAmbiguity(query, recentTurns = []) {
  const trimmed = (query || '').trim().toLowerCase();

  // 1. If query is empty or just punctuation
  if (!trimmed || /^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return {
      isAmbiguous: true,
      reason: 'Empty or non-textual input provided.',
      suggestedClarification: 'Could you please type a question or topic you would like assistance with?',
    };
  }

  // 2. Very short query (< 4 words)
  const words = trimmed.split(/\s+/);
  const isShort = words.length <= 4;

  // Check if query starts with vague starter or consists mostly of a vague pronoun
  const hasVagueStarter = VAGUE_STARTERS.some((s) => trimmed.startsWith(s));
  const isPronounOnly = VAGUE_PRONOUNS.includes(trimmed);

  // If there is recent context, short pronouns can often be resolved by conversational history
  const hasSubstantialContext =
    recentTurns.length > 0 &&
    recentTurns.some(
      (t) => (t.content || '').length > 30 && !t.content.includes('Could you clarify')
    );

  // If vague and NO prior context exists to resolve it:
  if ((isPronounOnly || (isShort && hasVagueStarter)) && !hasSubstantialContext) {
    let suggested = 'Could you please specify which topic, object, or concept you are referring to?';
    if (trimmed.includes('that') || trimmed.includes('this') || trimmed.includes('it')) {
      suggested = 'Could you clarify what "it/that" refers to so I can provide an accurate answer?';
    } else if (trimmed === 'why' || trimmed === 'how come') {
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
