/**
 * Input sanitization and safety middleware
 */

// Patterns indicating potential prompt injections
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /DAN\s+mode/i,
  /bypass\s+safety\s+filters/i,
  /jailbreak/i,
  /system\s+override/i,
  /reveal\s+your\s+system\s+prompt/i,
];

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Trim leading/trailing whitespace
  let sanitized = input.trim();
  // Strip control characters while preserving newlines & tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return sanitized;
}

export function detectPromptInjection(text) {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

export function inputSanitizationMiddleware(req, res, next) {
  if (req.body && typeof req.body.message === 'string') {
    req.body.message = sanitizeInput(req.body.message);

    // Max length validation (2000 chars per turn)
    if (req.body.message.length > 2000) {
      return res.status(400).json({
        error: 'Message exceeds maximum allowable length of 2000 characters.',
      });
    }

    // Flag injection
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
