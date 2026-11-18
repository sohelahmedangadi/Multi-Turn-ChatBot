/**
 * server/config/models.js
 * 
 * Centralized LLM and Embedding Model Configuration.
 * Replaces hardcoded model IDs across providers with environment-driven
 * configuration, fallback chains, and startup validation.
 */

// Known deprecated, nonexistent, or sunset model IDs flagged by provider audits
export const KNOWN_UNAVAILABLE_MODELS = new Set([
  'compound',
  'groq/compound',
  'groq/compound-mini',
  'qwen/qwen3.6-27b',
  'text-embedding-004', // superseded by gemini-embedding-001 in @google/genai
]);

function parseModelList(envValue, defaultList) {
  if (!envValue || typeof envValue !== 'string' || envValue.trim().length === 0) {
    return [...defaultList];
  }
  const trimmed = envValue.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m) => String(m).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma-separated split
    }
  }
  return trimmed
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

// Default Model Configurations
const DEFAULT_GEMINI_PRIMARY = 'gemini-2.5-flash';
const DEFAULT_GEMINI_FALLBACKS = [
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-pro-preview',
];

const DEFAULT_GROQ_PRIMARY = 'qwen/qwen3.8-27b';
const DEFAULT_GROQ_FALLBACKS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
];

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

// Active State (allows dynamic switching if primary fails or is deprecated)
let activeGeminiPrimary = (process.env.GEMINI_PRIMARY_MODEL || DEFAULT_GEMINI_PRIMARY).trim();
let activeGeminiFallbacks = parseModelList(process.env.GEMINI_FALLBACK_MODELS, DEFAULT_GEMINI_FALLBACKS);

let activeGroqPrimary = (process.env.GROQ_PRIMARY_MODEL || DEFAULT_GROQ_PRIMARY).trim();
let activeGroqFallbacks = parseModelList(process.env.GROQ_FALLBACK_MODELS, DEFAULT_GROQ_FALLBACKS);

let activeEmbeddingModel = (process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL).trim();

/**
 * Get active Gemini primary model
 */
export function getGeminiPrimaryModel() {
  return activeGeminiPrimary;
}

/**
 * Get full list of Gemini models in preference order (primary + fallbacks)
 */
export function getGeminiModels() {
  const list = [activeGeminiPrimary, ...activeGeminiFallbacks];
  // Deduplicate preserving order
  return Array.from(new Set(list));
}

/**
 * Switch Gemini primary to a configured alternative
 */
export function setGeminiPrimaryModel(newModel) {
  if (newModel && typeof newModel === 'string') {
    activeGeminiPrimary = newModel.trim();
  }
}

/**
 * Get active Groq primary model
 */
export function getGroqPrimaryModel() {
  return activeGroqPrimary;
}

/**
 * Get full list of Groq models in fallback order
 */
export function getGroqModels() {
  const list = [activeGroqPrimary, ...activeGroqFallbacks];
  return Array.from(new Set(list));
}

/**
 * Switch Groq primary to a configured alternative
 */
export function setGroqPrimaryModel(newModel) {
  if (newModel && typeof newModel === 'string') {
    activeGroqPrimary = newModel.trim();
  }
}

/**
 * Get active embedding model
 */
export function getEmbeddingModel() {
  return activeEmbeddingModel;
}

/**
 * Set active embedding model
 */
export function setEmbeddingModel(newModel) {
  if (newModel && typeof newModel === 'string') {
    activeEmbeddingModel = newModel.trim();
  }
}

/**
 * Returns a serializable snapshot of model configuration
 */
export function getModelConfigSummary() {
  return {
    gemini: {
      primary: activeGeminiPrimary,
      fallbacks: [...activeGeminiFallbacks],
      all: getGeminiModels(),
    },
    groq: {
      primary: activeGroqPrimary,
      fallbacks: [...activeGroqFallbacks],
      all: getGroqModels(),
    },
    embedding: {
      model: activeEmbeddingModel,
    },
  };
}

/**
 * Validates configured models against known deprecated list or invalid configurations.
 * If the primary model is unavailable/deprecated:
 *   - If failOnInvalid is true or FAIL_ON_INVALID_MODEL === 'true', throws Error loudly.
 *   - Otherwise switches automatically to the first valid configured alternative.
 */
export function validateAndLogModelConfig({ failOnInvalid = false, quiet = false } = {}) {
  const mustFail = failOnInvalid || process.env.FAIL_ON_INVALID_MODEL === 'true';
  const warnings = [];

  // Check Gemini Primary
  if (KNOWN_UNAVAILABLE_MODELS.has(activeGeminiPrimary.toLowerCase()) || !activeGeminiPrimary) {
    const fallback = activeGeminiFallbacks.find((m) => !KNOWN_UNAVAILABLE_MODELS.has(m.toLowerCase()));
    if (mustFail || !fallback) {
      throw new Error(`[Model Config] Fatal: Primary Gemini model "${activeGeminiPrimary}" is deprecated or invalid, and no valid fallback exists.`);
    }
    const msg = `[Model Config] ⚠️ WARNING: Primary Gemini model "${activeGeminiPrimary}" is marked deprecated/invalid. Switching automatically to alternative: "${fallback}"`;
    warnings.push(msg);
    if (!quiet) console.warn(msg);
    activeGeminiPrimary = fallback;
  }

  // Check Groq Primary
  if (KNOWN_UNAVAILABLE_MODELS.has(activeGroqPrimary.toLowerCase()) || !activeGroqPrimary) {
    const fallback = activeGroqFallbacks.find((m) => !KNOWN_UNAVAILABLE_MODELS.has(m.toLowerCase()));
    if (mustFail || !fallback) {
      throw new Error(`[Model Config] Fatal: Primary Groq model "${activeGroqPrimary}" is deprecated or invalid, and no valid fallback exists.`);
    }
    const msg = `[Model Config] ⚠️ WARNING: Primary Groq model "${activeGroqPrimary}" is marked deprecated/invalid (e.g. 'compound'). Switching automatically to alternative: "${fallback}"`;
    warnings.push(msg);
    if (!quiet) console.warn(msg);
    activeGroqPrimary = fallback;
  }

  // Check Embedding Model
  if (KNOWN_UNAVAILABLE_MODELS.has(activeEmbeddingModel.toLowerCase())) {
    const alternative = 'gemini-embedding-001';
    const msg = `[Model Config] ⚠️ WARNING: Configured embedding model "${activeEmbeddingModel}" is legacy/unavailable. Switching automatically to "${alternative}"`;
    warnings.push(msg);
    if (!quiet) console.warn(msg);
    activeEmbeddingModel = alternative;
  }

  if (!quiet) {
    console.log('[Model Config] 🤖 LLM & Embedding Model Configuration Active:');
    console.log(`  ├─ Gemini Primary:    ${activeGeminiPrimary}`);
    console.log(`  ├─ Gemini Fallbacks:  ${activeGeminiFallbacks.join(', ')}`);
    console.log(`  ├─ Groq Primary:      ${activeGroqPrimary}`);
    console.log(`  ├─ Groq Fallbacks:    ${activeGroqFallbacks.join(', ')}`);
    console.log(`  └─ Embedding Model:   ${activeEmbeddingModel}`);
  }

  return {
    valid: true,
    warnings,
    summary: getModelConfigSummary(),
  };
}
