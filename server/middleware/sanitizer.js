/**
 * Input sanitization and safety middleware
 */

// Normalized patterns indicating potential prompt injections
const PROMPT_INJECTION_PATTERNS = [
  /(?:ignore|disregard)\s*(all\s*)?(?:previous|prior|above|existing|system|safety|content)?\s*(?:instructions|prompts|directives|rules)(\s*(?:above|prior|previously|before))?/i,
  /(?:you\s*are\s*now\s*in\s*developer\s*mode|enable\s*developer\s*mode|now\s*in\s*dan\s*mode|do\s*anything\s*now\s*mode)/i,
  /bypass\s*(all\s*)?(?:safety|content|ai)\s*(?:filters|guardrails|guidelines|restrictions)/i,
  /(?:jailbreak\s*(the\s*)?(?:prompt|model|assistant|llm|system)|unrestricted\s*jailbreak\s*mode|\bjailbreak\s*mode\b)/i,
  /(?:system|admin)\s*override:\s*(?:ignore|disregard|you\s*are|disable|delete)/i,
  /\bexecute\s*system\s*override\b/i,
  /(?:reveal|repeat|output|print|show)\s*(your\s*|the\s*)?(initial\s*|original\s*|internal\s*)?(system\s*prompt|system\s*instruction|developer\s*instruction)/i,
  /(?:act\s*as|pretend\s*to\s*be)\s*an?\s*(unrestricted|jailbroken|unfiltered|evil)\s*(ai|assistant|model|bot)/i,
  /<\/?(?:system|instruction|untrusted_[a-z0-9_-]+)>/i,
  // Multilingual direct overrides
  /(?:पिछले|सभी)\s*(?:निर्देशों|आदेशों)\s*को\s*अनदेखा/i,
  /(?:अनदेखा|नज़रअंदाज़)\s*करें/i,
  /игнорируй(?:те)?\s*(?:все\s*)?(?:предыдущие|прошлые)\s*(?:инструкции|указания)/i,
  /(?:忽略|无视)[\s\S]{0,10}?(?:指令|提示词|要求)/i,
  /ignora\s*(?:todas\s*las\s*)?instrucciones\s*anteriores/i,
  /ignoriere\s*(?:alle\s*)?(?:vorherigen\s*)?anweisungen/i,
];

/**
 * Normalizes input text before safety checking:
 * 1. Decodes numeric HTML entities
 * 2. NFKC Unicode normalization (collapses fullwidth, compatibility forms)
 * 3. Strips zero-width and bidi control characters
 * 4. Collapses irregular whitespace
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function decodeBase64Candidates(text) {
  const matches = text.match(/\b[A-Za-z0-9+/]{16,}={0,2}\b/g);
  if (!matches) return [];
  const decodedParts = [];
  for (const m of matches) {
    try {
      const decoded = Buffer.from(m, 'base64').toString('utf8');
      if (/^[\x20-\x7E\s]+$/.test(decoded) && decoded.length > 5) {
        decodedParts.push(decoded);
      }
    } catch (_) {}
  }
  return decodedParts;
}

function normalizeLeetSpeak(text) {
  return text
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

export function normalizeForSafetyCheck(text) {
  if (typeof text !== 'string') return '';
  // 1. Decode numeric HTML entities
  let normalized = decodeHtmlEntities(text);

  // 2. Unicode NFKC normalization
  normalized = normalized.normalize('NFKC');

  // 3. Strip zero-width and bidi control characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  // 4. Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Strips delimiter characters used by attackers to space out payload letters
 * e.g. "i g n o r e" -> "ignore", "i.g.n.o.r.e" -> "ignore"
 */
function deSpaceCharacters(text) {
  return text
    .replace(/\b([a-zA-Z0-9])\s+(?=[a-zA-Z0-9]\b)/g, '$1')
    .replace(/([a-zA-Z0-9])[._\s-]+(?=[a-zA-Z0-9])/g, '$1');
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Trim leading/trailing whitespace
  let sanitized = input.trim();
  // Strip control characters while preserving newlines & tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return sanitized;
}

export function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return false;

  const normalized = normalizeForSafetyCheck(text);
  const deSpaced = deSpaceCharacters(normalized);
  const leet = normalizeLeetSpeak(normalized);
  const leetDeSpaced = deSpaceCharacters(leet);

  const candidates = [normalized, deSpaced, leet, leetDeSpaced];

  const b64Decoded = decodeBase64Candidates(text);
  for (const b of b64Decoded) {
    candidates.push(normalizeForSafetyCheck(b));
  }

  for (const candidate of candidates) {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(candidate)) {
        return true;
      }
    }
  }
  return false;
}

export function inputSanitizationMiddleware(req, res, next) {
  if (req.body && typeof req.body.message === 'string') {
    // Keep original text for storage while stripping dangerous non-printable control characters
    req.body.message = sanitizeInput(req.body.message);

    // Max length validation (2000 chars per turn)
    if (req.body.message.length > 2000) {
      return res.status(400).json({
        error: 'Message exceeds maximum allowable length of 2000 characters.',
      });
    }

    // Flag injection based on normalized evaluation
    req.isSuspectedInjection = detectPromptInjection(req.body.message);
  }

  if (req.body && typeof req.body.systemPrompt === 'string') {
    req.body.systemPrompt = sanitizeInput(req.body.systemPrompt);
    if (req.body.systemPrompt.length > 1000) {
      return res.status(400).json({
        error: 'System prompt exceeds maximum allowable length of 1000 characters.',
      });
    }
  }

  next();
}
