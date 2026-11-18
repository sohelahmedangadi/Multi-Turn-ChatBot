/**
 * server/config/envConfig.js
 * 
 * Centralized Single Source of Truth for CosmoAI Environment Variables.
 * Defines all configuration flags, types, default values, requirements,
 * and descriptions to ensure documentation and runtime code never drift.
 */

export const ENV_SPECS = [
  // --- Core Server & Network Gateway ---
  {
    name: 'PORT',
    required: 'No',
    defaultValue: '5000',
    type: 'number',
    category: 'Core Server & Gateway',
    purpose: 'HTTP port on which the Express server listens.',
  },
  {
    name: 'NODE_ENV',
    required: 'Yes',
    defaultValue: 'development',
    type: 'string',
    category: 'Core Server & Gateway',
    purpose: 'Runtime environment mode (\'development\', \'production\', or \'test\').',
  },
  {
    name: 'CORS_ALLOWED_ORIGINS',
    required: 'No',
    defaultValue: '*',
    type: 'string',
    category: 'Core Server & Gateway',
    purpose: 'Comma-separated list of allowed HTTP origins or \'*\' for public API access.',
  },
  {
    name: 'TRUST_PROXY',
    required: 'No',
    defaultValue: '1',
    type: 'string',
    category: 'Core Server & Gateway',
    purpose: 'Number of upstream reverse proxy hops to trust for accurate client IP derivation.',
  },

  // --- Datastores & Persistence ---
  {
    name: 'DATA_DIR',
    required: 'No',
    defaultValue: './data',
    type: 'string',
    category: 'Datastores & Persistence',
    purpose: 'Filesystem directory where local_store.json and automated backups are persisted.',
  },
  {
    name: 'CHROMA_URL',
    required: 'No',
    defaultValue: 'http://127.0.0.1:8000',
    type: 'string',
    category: 'Datastores & Persistence',
    purpose: 'Target endpoint of official Chroma Vector DB daemon (must resolve to loopback 127.0.0.1/localhost).',
  },
  {
    name: 'CHROMA_COLLECTION_PREFIX',
    required: 'No',
    defaultValue: 'cosmo_',
    type: 'string',
    category: 'Datastores & Persistence',
    purpose: 'Prefix for Chroma vector collections to ensure isolated test and tenant namespaces.',
  },
  {
    name: 'MONGO_URI',
    required: 'No',
    defaultValue: '""',
    type: 'string',
    category: 'Datastores & Persistence',
    purpose: 'Optional MongoDB Atlas URI. If omitted or unreachable, seamlessly falls back to local datastore.',
  },

  // --- Authentication & Rate Limiting ---
  {
    name: 'JWT_SECRET',
    required: 'Yes',
    defaultValue: '""',
    type: 'string',
    category: 'Authentication & Security',
    purpose: 'Cryptographic secret for signing and verifying stateless JWT access tokens (minimum 32 characters).',
  },
  {
    name: 'AUTH_RATE_LIMIT_WINDOW_MS',
    required: 'No',
    defaultValue: '900000',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Sliding window in milliseconds (15 minutes) for login/register brute-force and DoS protection.',
  },
  {
    name: 'AUTH_MAX_ATTEMPTS',
    required: 'No',
    defaultValue: '5',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Base failed authentication attempts allowed per (email + IP) before progressive delays trigger.',
  },
  {
    name: 'AUTH_IP_MAX_CEILING',
    required: 'No',
    defaultValue: '30',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Global authentication ceiling across all accounts per IP within the 15-minute window.',
  },
  {
    name: 'AUTH_MAX_DELAY_SEC',
    required: 'No',
    defaultValue: '60',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Maximum progressive delay cap in seconds applied to rate-limited authentication attempts.',
  },
  {
    name: 'CHAT_RATE_LIMIT_WINDOW_MS',
    required: 'No',
    defaultValue: '60000',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Sliding window in milliseconds (1 minute) for /api/chat endpoint rate limiting.',
  },
  {
    name: 'CHAT_RATE_LIMIT_MAX',
    required: 'No',
    defaultValue: '30',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Maximum chat requests allowed per window per client IP.',
  },
  {
    name: 'UPLOAD_RATE_LIMIT_WINDOW_MS',
    required: 'No',
    defaultValue: '300000',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Sliding window in milliseconds (5 minutes) for /api/files/upload endpoint rate limiting.',
  },
  {
    name: 'UPLOAD_RATE_LIMIT_MAX',
    required: 'No',
    defaultValue: '10',
    type: 'number',
    category: 'Authentication & Security',
    purpose: 'Maximum file uploads allowed per window per client IP.',
  },

  // --- LLM Inference & Search Resiliency ---
  {
    name: 'GEMINI_API_KEY',
    required: 'Conditional',
    defaultValue: '""',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Primary provider key for Google Gemini 2.5 Flash, Vision, OCR, and native Search grounding.',
  },
  {
    name: 'GROQ_API_KEY',
    required: 'Conditional',
    defaultValue: '""',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Secondary failover key for Groq Cloud SDK models during quota exhaustion or timeouts.',
  },
  {
    name: 'TAVILY_API_KEY',
    required: 'No',
    defaultValue: '""',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Real-time search API key for Groq search fallback grounding.',
  },
  {
    name: 'DEFAULT_ALLOW_WEB_SEARCH',
    required: 'No',
    defaultValue: 'true',
    type: 'boolean',
    category: 'LLM & Search Resiliency',
    purpose: 'Default web search grounding state when allowWebSearch is omitted from client chat requests.',
  },
  {
    name: 'GEMINI_PRIMARY_MODEL',
    required: 'No',
    defaultValue: 'gemini-2.5-flash',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Configurable primary Gemini chat and reasoning model.',
  },
  {
    name: 'GEMINI_FALLBACK_MODELS',
    required: 'No',
    defaultValue: 'gemini-flash-latest,gemini-3.7-flash,gemini-2.5-flash-lite,gemini-3.1-pro-preview',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Comma-separated ordered fallback chain for Google Gemini models.',
  },
  {
    name: 'GROQ_PRIMARY_MODEL',
    required: 'No',
    defaultValue: 'qwen/qwen3.8-27b',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Configurable primary Groq chat and fact-extraction model.',
  },
  {
    name: 'GROQ_FALLBACK_MODELS',
    required: 'No',
    defaultValue: 'openai/gpt-oss-120b,openai/gpt-oss-20b,allam-2-7b',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Comma-separated ordered fallback chain for Groq Cloud models.',
  },
  {
    name: 'EMBEDDING_MODEL',
    required: 'No',
    defaultValue: 'gemini-embedding-001',
    type: 'string',
    category: 'LLM & Search Resiliency',
    purpose: 'Configurable dense vector embedding model for Chroma vectors.',
  },
  {
    name: 'USE_REAL_EMBEDDINGS',
    required: 'No',
    defaultValue: 'false',
    type: 'boolean',
    category: 'LLM & Search Resiliency',
    purpose: 'Toggle genuine Google GenAI semantic embeddings vs fast offline lexical hashed vectors.',
  },
  {
    name: 'FAIL_ON_INVALID_MODEL',
    required: 'No',
    defaultValue: 'false',
    type: 'boolean',
    category: 'LLM & Search Resiliency',
    purpose: 'Halts server boot if any configured model ID is deprecated, sunset, or invalid.',
  },
  {
    name: 'MODEL_AUDIT_STRICT',
    required: 'No',
    defaultValue: 'false',
    type: 'boolean',
    category: 'LLM & Search Resiliency',
    purpose: 'Runs live provider catalog check on boot; halts if any active or fallback model is missing.',
  },

  // --- SSE Streaming Watchdogs ---
  {
    name: 'STREAM_FIRST_CHUNK_TIMEOUT_MS',
    required: 'No',
    defaultValue: '9000 (text) / 60000 (media)',
    type: 'number',
    category: 'Streaming Watchdogs',
    purpose: 'Watchdog timeout before falling back to secondary provider if no initial token arrives.',
  },
  {
    name: 'STREAM_IDLE_TIMEOUT_MS',
    required: 'No',
    defaultValue: '10000',
    type: 'number',
    category: 'Streaming Watchdogs',
    purpose: 'Watchdog timeout terminating a stream if the connection stalls between consecutive chunks.',
  },

  // --- Document Ingestion, Quotas & Worker Limits ---
  {
    name: 'UPLOAD_DIR',
    required: 'No',
    defaultValue: './uploads_storage',
    type: 'string',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Storage directory outside web root where raw document and media binaries are stored.',
  },
  {
    name: 'MAX_FILE_SIZE_BYTES',
    required: 'No',
    defaultValue: '20971520',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum size allowed per uploaded document in bytes (default: 20MB).',
  },
  {
    name: 'SESSION_FILE_CAP',
    required: 'No',
    defaultValue: '10',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum number of concurrent file attachments permitted per dialogue session.',
  },
  {
    name: 'MAX_DAILY_UPLOADS_PER_USER',
    required: 'No',
    defaultValue: '50',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Daily file upload count quota per authenticated user identity.',
  },
  {
    name: 'MAX_DAILY_BYTES_PER_USER',
    required: 'No',
    defaultValue: '104857600',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Cumulative daily upload bandwidth ceiling per user in bytes (default: 100MB).',
  },
  {
    name: 'MAX_CSV_LINES',
    required: 'No',
    defaultValue: '1000',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum row cutoff limit when extracting structured CSV spreadsheets.',
  },
  {
    name: 'MAX_CSV_COLS',
    required: 'No',
    defaultValue: '50',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum column cutoff limit when extracting structured CSV spreadsheets.',
  },
  {
    name: 'WORKER_CONCURRENCY',
    required: 'No',
    defaultValue: '4',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum concurrent Node.js worker threads in document parsing pool (aliases MAX_CONCURRENT_WORKERS).',
  },
  {
    name: 'EXTRACTION_TIMEOUT_MS',
    required: 'No',
    defaultValue: '15000',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Watchdog timeout in milliseconds (15s) before terminating hung worker extraction tasks.',
  },
  {
    name: 'WORKER_MAX_OLD_GEN_MB',
    required: 'No',
    defaultValue: '512',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'V8 max old generation heap ceiling in MB per worker thread to prevent memory exhaustion.',
  },
  {
    name: 'WORKER_MAX_YOUNG_GEN_MB',
    required: 'No',
    defaultValue: '128',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'V8 max young generation heap ceiling in MB per worker thread.',
  },
  {
    name: 'MAX_CONCURRENT_PYTHON_JOBS',
    required: 'No',
    defaultValue: '2',
    type: 'number',
    category: 'File Ingestion & Worker Limits',
    purpose: 'Maximum concurrent Python child processes allowed for OCR, computer vision, and speech transcription.',
  },

  // --- Context Memory Token Budgets ---
  {
    name: 'CONTEXT_MAX_TOKENS',
    required: 'No',
    defaultValue: '3200',
    type: 'number',
    category: 'Context Memory Budgets',
    purpose: 'Maximum total token budget for context assembly across all memory tiers and RAG chunks.',
  },
  {
    name: 'MEMORY_MAX_TOKENS',
    required: 'No',
    defaultValue: '400',
    type: 'number',
    category: 'Context Memory Budgets',
    purpose: 'Token allocation cap for Tier 2 durable extracted user entity memories.',
  },
  {
    name: 'KNOWLEDGE_MAX_TOKENS',
    required: 'No',
    defaultValue: '400',
    type: 'number',
    category: 'Context Memory Budgets',
    purpose: 'Token allocation cap for Tier 3 domain knowledge excerpts.',
  },

  // --- Independent LLM-as-a-Judge Rubric Evaluation ---
  {
    name: 'GENERATOR_PROVIDER',
    required: 'No',
    defaultValue: 'groq',
    type: 'string',
    category: 'LLM Evaluation & Rubric',
    purpose: 'Provider family generating benchmark candidate responses (\'gemini\' or \'groq\').',
  },
  {
    name: 'GENERATOR_MODEL',
    required: 'No',
    defaultValue: 'openai/gpt-oss-20b',
    type: 'string',
    category: 'LLM Evaluation & Rubric',
    purpose: 'Model ID generating candidate responses for rubric evaluation.',
  },
  {
    name: 'JUDGE_PROVIDER',
    required: 'No',
    defaultValue: 'groq',
    type: 'string',
    category: 'LLM Evaluation & Rubric',
    purpose: 'Independent judge provider family decoupled from generator model family.',
  },
  {
    name: 'JUDGE_MODEL',
    required: 'No',
    defaultValue: 'qwen/qwen3.8-27b',
    type: 'string',
    category: 'LLM Evaluation & Rubric',
    purpose: 'Independent judge model ID for 1-5 rubric scoring.',
  },
  {
    name: 'JUDGE_PROMPT_VERSION',
    required: 'No',
    defaultValue: 'v2.0-rubric-strict',
    type: 'string',
    category: 'LLM Evaluation & Rubric',
    purpose: 'Version identifier for the structured rubric scoring prompt.',
  },
];

/**
 * Generates a clean GitHub Flavored Markdown table of all environment variables.
 */
export function generateEnvMarkdownTable() {
  const header = [
    '| Variable Name | Required | Default Value | Purpose |',
    '| :--- | :--- | :--- | :--- |',
  ];

  const rows = ENV_SPECS.map((spec) => {
    return `| \`${spec.name}\` | ${spec.required} | \`${spec.defaultValue}\` | ${spec.purpose} |`;
  });

  return [...header, ...rows].join('\n');
}

/**
 * Validates process.env against specification and returns any configuration warnings.
 */
export function validateEnvironment() {
  const warnings = [];
  const errors = [];

  for (const spec of ENV_SPECS) {
    const val = process.env[spec.name];
    if (spec.required === 'Yes' && (!val || val.trim().length === 0)) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(`Missing required environment variable: ${spec.name}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
