# CosmoAI System Architecture & Technical Specifications

This document outlines the complete architectural design of **CosmoAI**, a resilient, production-grade multi-turn conversational AI platform featuring **Native Google Search Grounding**, **Tavily Search API Fallback**, **LangChain 3-Tier Context Memory**, **Multimodal RAG Ingestion**, and **Dual-Engine LLM Failover**.

---

## 1. High-Level System Architecture

```text
                               +----------------------------------------+
                               |         Frontend Single-Page App       |
                               |    React 19 + Tailwind v4 + Vite       |
                               +-------------------+--------------------+
                                                   |
                                                   | HTTP REST / SSE Stream
                                                   v
+-----------------------------------------------------------------------------------------------+
|                             Express Backend API Gateway (server/)                             |
|  - Rate Limiter (30 req/min/IP)          - Input Sanitizer & Prompt Injection Neutralizer     |
|  - JWT Stateless Authentication Layer    - Dual Persistence (MongoDB Atlas / In-Memory Store)  |
+--------------------------------------------------+--------------------------------------------+
                                                   |
                                                   v
+-----------------------------+                             +-----------------------------------+
|  Zero-Cost Ambiguity Engine |                             |    3-Tier Memory Context Manager  |
|  - Regex Heuristic Parser   |                             |                                   |
|  - 0 tokens / 0ms bypass    |                             |  * Tier 1: Sliding Window History |
+-----------------------------+                             |  * Tier 2: LangChain Durable Memory|
                                                            |  * Tier 2.5: Cross-Session Catalog|
+-----------------------------+                             |  * Tier 3: Domain Knowledge Base  |
| Async File Analysis Pipeline|                             |  * Hybrid RAG Chunks (2.4k Budget)|
| - Worker Threads & Watchdog +---------------------------->|  * Multi-Turn Recency Follow-Up   |
| - Magic Bytes & Zip Defense |                             |  * Citations & Whole-Doc Summaries|
+-----------------------------+                             +-----------------+-----------------+
                                                                              |
                                                                              v
+-----------------------------------------------------------------------------------------------+
|                            Dual-Engine Resilient LLM Inference Engine                         |
|                                                                                               |
|  ┌───────────────────────────────────────────────┐  Circuit  ┌──────────────────────────────┐ |
|  │  PRIMARY: Google Gemini 2.5 Flash             │  Breaker  │ FALLBACK: Groq SDK Models    │ |
|  │  - Native Google Search Grounding Tool        │ ────────> │ - Qwen 3.8 / GPT-OSS 120B    │ |
|  │  - Autonomous server-side web grounding       │  (on 429) │ - Regex `[SEARCH: query]`    │ |
|  │  - Automatic Grounding Citations Extraction   │           │ - Tavily Search API Injection│ |
|  └───────────────────────────────────────────────┘           └──────────────────────────────┘ |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Web Search Architecture (Grounding & Fallback)

CosmoAI implements a dual-layer search grounding architecture designed for high factual accuracy without vendor lock-in or fragile scraping:

```text
                           Incoming User Question
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │   Is Gemini Provider Active?  │
                     └───────────────┬───────────────┘
                                     │
                    YES ─────────────┴───────────── NO (or Gemini Circuit Breaker Tripped)
                     │                                      │
                     ▼                                      ▼
     ┌────────────────────────────────┐     ┌────────────────────────────────┐
     │      Gemini 2.5 Flash Path     │     │        Groq Fallback Path      │
     │  `tools: [{ googleSearch: {} }]`│     │    Prompt: [SEARCH: <query>]   │
     └───────────────┬────────────────┘     └───────────────┬────────────────┘
                     │                                      │
                     ▼                                      ▼
     ┌────────────────────────────────┐     ┌────────────────────────────────┐
     │ Google Search Grounding Engine │     │ Tavily Search API Client       │
     │ - Real-time Google web index   │     │ - Direct summarized answers    │
     │ - Server-side query synthesis  │     │ - Top 3-5 clean snippets       │
     │ - Automatic fact verification  │     │ - 7-second abort timeout       │
     └───────────────┬────────────────┘     └───────────────┬────────────────┘
                     │                                      │
                     ▼                                      ▼
     ┌────────────────────────────────┐     ┌────────────────────────────────┐
     │ Grounding Metadata Extraction  │     │ Search Context Re-Prompting    │
     │ - Extract webSearchQueries     │     │ - Injects verified results     │
     │ - Extract sources (title, uri) │     │ - Re-prompts Groq to synthesize│
     └───────────────┬────────────────┘     └───────────────┬────────────────┘
                     │                                      │
                     └──────────────────────┬───────────────┘
                                            │
                                            ▼
                           Synthesized Response with Sources
                           + UI "Verified Web Sources" Pills
```

### 2.1 Gemini Path: Native Google Search Grounding (Primary)
- **Engine**: Official `@google/genai` SDK using `gemini-2.5-flash`.
- **Configuration**: `config: { tools: [{ googleSearch: {} }] }`.
- **Mechanics**: Gemini determines autonomously whether real-time data is required. When invoked, Google's search engine fetches live web context and returns `groundingMetadata`.
- **Source Surfacing**: CosmoAI extracts `groundingChunks` (web URLs and titles) and `webSearchQueries` from `response.candidates[0].groundingMetadata`, passing them to the UI as verified source pills.

### 2.2 Groq Path: Regex-Triggered Tavily API Search (Fallback)
- **Engine**: `groq-sdk` with `qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, or `openai/gpt-oss-20b` (centralized via `server/config/models.js`).
- **Trigger**: The model emits `[SEARCH: <query>]`, `[web_search: <query>]`, or ````web_search\nquery: "..."````.
- **Search Provider**: **Tavily Search API** (`https://api.tavily.com/search`) configured for summarized, answer-focused results (`include_answer: true`, `max_results: 5`).
- **Timeout & Resilience**: Strict **7-second timeout** via `AbortController`. If Tavily times out or errors, the chatbot falls back gracefully to a non-searched response.
- **Synthesis Loop**: Formats search results cleanly into `[VERIFIED WEB SEARCH RESULTS (via Tavily)]`, appends instructions to cite sources, and re-prompts Groq for final natural-language synthesis.

---

## 3. 3-Tier Conversational Memory Architecture

1. **Tier 1: Active Dialogue Sliding Window (`contextManager.js`)**
   - Retains current thread turns with dynamic token estimation (`Math.ceil(chars / 4)`).
   - Atomic turn-pair dropping ensures conversational coherence stays within the 1,800-token budget.
2. **Tier 2: LangChain Long-Term Structured Memory (`langchainMemory.js` / `memoryManager.js`)**
   - Automatically extracts durable user facts (name, project details, tech stacks, preferences).
   - In-place conflict resolution prevents duplicate keys.
   - Vector cosine similarity matches facts against queries (300-token budget).
   - Explicit forget directives instantly delete matching keys.
3. **Tier 2.5: Cross-Session Past Conversation History Catalog**
   - Exposes bounded summaries of past conversation sessions for cross-thread memory.
4. **Tier 3: Domain Knowledge Base RAG Chunks (`store.js`)**
   - Domain concepts retrieved via semantic vector search.

---

## 4. Asynchronous Multimodal RAG Document Pipeline (`server/services/extractors/` & `server/services/ragService.js`)

```text
                  Incoming Document Upload (POST /api/files/upload)
                                        │
                                        ▼
                  ┌───────────────────────────────────────────────┐
                  │          Magic Bytes & Security Guard         │
                  │  - %PDF-, PNG, JPEG, PK (DOCX), CSV delimiter │
                  │  - Path traversal & sanitization (<id>.bin)   │
                  │  - Zip-bomb defense (50MB / 500 entry limit)  │
                  └──────────────────────┬────────────────────────┘
                                         │
                                         ▼
                  ┌───────────────────────────────────────────────┐
                  │    User-Scoped SHA-256 Deduplication Cache    │
                  │  - Partitioned by (userId, sha256)            │
                  └──────────┬────────────────────────┬───────────┘
                             │ CACHE HIT              │ CACHE MISS
                             ▼                        ▼
               ┌───────────────────────────┐  ┌───────────────────────────────┐
               │ Reuse Extracted Document  │  │   Async Queue & Worker Pool   │
               │ (ParsedDocument schema)   │  │   - node:worker_threads       │
               └─────────────┬─────────────┘  │   - 15s Watchdog Termination  │
                             │                └───────────────┬───────────────┘
                             │                                │
                             ▼                                ▼
               ┌──────────────────────────────────────────────────────────────┐
               │           Re-Chunk & Session-Scoped Indexing                 │
               │  - 350-token structure-aware chunks (50-token overlap)       │
               │  - Strict namespace isolation: chunks never leak sessions    │
               │  - Pre-computed document summary caching                     │
               └──────────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
               ┌──────────────────────────────────────────────────────────────┐
               │            Multi-Turn Dialogue RAG & Citations               │
               │  - Automatic recency-based follow-up resolution              │
               │  - Whole-document query detection (summary vs chunk search)  │
               │  - Hybrid cosine vector + BM25 keyword retrieval             │
               │  - 2,400-token context budget & citation UI metadata pills   │
               └──────────────────────────────────────────────────────────────┘
```

- **Validation & Defensive Boundaries**: Magic byte inspection verifies genuine headers (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`, PK ZIP container with `word/` package). Enforces 50MB / 500-entry zip bomb ceilings and sanitizes filenames against directory traversal (`uploads_storage/<fileId>.bin`).
- **Worker Thread Execution & Watchdog (`workerPool.js`)**: Extraction runs in dedicated `node:worker_threads`. A 15-second watchdog timer triggers `worker.terminate()` if parsing CPU locks, preventing event-loop degradation.
- **Tenant-Scoped SHA-256 Deduplication**: Caches the extracted `ParsedDocument` keyed strictly by `(userId, sha256)`. Cache hits bypass re-extraction while strictly re-chunking and re-indexing into the requesting session's vector store namespace, eliminating cross-session chunk leakage.
- **Specialized Structure-Preserving Extractors**:
  - **DOCX**: Preserves hierarchical headings (`Heading 1`, `Heading 2`), paragraph structures, and Markdown-formatted tables.
  - **CSV**: RFC-4180 parsing, automated column data type inference (`number`, `string`, `date`, `boolean`), and automatic schema summary generation for large files (> 50 rows).
  - **PDF & Multimodal OCR**: Pure-JS `pdf-parse` with encrypted/corrupted file detection; falls back to **Gemini 2.5 Flash Vision** when &ge; 60% of pages have sparse text.
- **Hybrid RAG & Follow-Up Reasoning**:
  - Structure-aware chunking (350 tokens per chunk, 50-token overlap).
  - Hybrid retrieval combining vector cosine similarity with BM25 keyword matching within a 2,400-token budget.
  - Automatic multi-turn follow-up resolution: seamlessly infers document context from conversation history without requiring re-upload.
  - Whole-document query classification: routes summarization requests directly to the pre-computed document summary.
  - Grounded citations: injects document and page/section markers into the streaming response.

---

## 5. Security & Circuit Breaker Architecture

- **Circuit Breaker**: On encountering HTTP 429 quota exhaustion on Gemini, a **60-second cooldown** trips immediately, routing subsequent turns directly to Groq with zero delay.
- **Prompt Injection Defense**: Sanitizes adversarial override patterns (`"ignore previous instructions"`, `"DAN mode"`).
- **Rate Limiting**: 30 requests/minute per IP address.
- **Authentication**: Salted Bcrypt password hashing + signed JSON Web Tokens (JWT).

---

## 6. Route Authorization, Multi-Tenant Isolation & Chroma Security

### 6.1 Multi-Tenant Route Ownership Model
- **Ownership Verification**: All stateful resources (sessions, messages, uploaded documents, background extraction jobs, and user long-term memories) are gated by `checkResourceOwnership(resource, userId)` and `assertResourceOwnership(res, resource, userId, resourceName)`.
- **404 Enumeration Protection**: When a user attempts to access, mutate, or delete an ID belonging to a different user, the API responds with `404 Not Found` (never `403 Forbidden`). This prevents attackers from enumerating valid resource IDs.
- **Strict Account Lifecycle Checks**: Tokens are checked against the persistent user store in `authenticateJWT` and `optionalJWT`. Deleted accounts and expired tokens immediately return `401 Unauthorized`.
- **Deduplication Cache Isolation**: Dedup cache keys are partitioned as `${userId}:${sha256}`, preventing one user's document summary or parsed AST from being exposed to another user.

### 6.2 Chroma DB Vector Security & Localhost Binding
- **Vector Collections**:
  - `cosmo_user_memories`: Scoped by `{ userId }` filter on every query.
  - `cosmo_document_chunks`: Scoped by `{ sessionId, userId, fileId }` on queries.
  - `cosmo_knowledge_base`: Shared public architecture domain knowledge.
- **Port Security**: Chroma DB on port `:8000` has no native authentication mechanism. In `docker-compose.yml`, Chroma is bound strictly to `127.0.0.1:8000:8000` rather than `0.0.0.0:8000` to prevent unauthenticated network access from outside the host machine.

---

## 7. React Client Security, Markdown Sanitization & Auth Storage Tradeoffs

### 7.1 Client-Side Markdown Sanitization & XSS Defense
- **Strict rehype-sanitize Pipeline**: Model output is rendered using `react-markdown` backed by `rehype-sanitize` using a restrictive schema. Raw HTML rendering is disabled (`rehype-raw` is omitted). Dangerous elements (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<img>` with `onerror`) are completely stripped from the rendered AST.
- **Link Protocol Guard & URL Normalization**: Custom link rendering enforces protocol whitelisting allowing only `http:`, `https:`, and `mailto:`. Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) and all obfuscated permutations (internal whitespace, entity decoding `&#106;avascript`, percent-encoded `%6a%61%76%61...`, and control characters) are intercepted and rendered as safe, non-interactive `<span>` badges. All valid links are forced with `target="_blank"` and `rel="noopener noreferrer"`.
- **Badge & Filename Metacharacter Sanitization**: Document filenames, sheet names, and citation section headers are sanitized via `sanitizeFilename` and `sanitizeText` to strip brackets, control characters, and quotes before rendering in badges and preview cards.
- **Content-Security-Policy (CSP) via Helmet**: The backend configures a strict Content-Security-Policy header enforcing `script-src 'self'` without `'unsafe-inline'` or `'unsafe-eval'`, and `object-src 'none'`, ensuring the browser refuses to execute any injected inline scripts.

### 7.2 Auth Token Storage Tradeoff: `localStorage` vs. `httpOnly Cookie + CSRF`
CosmoAI provides dual-mode authentication support: standard `Authorization: Bearer <token>` headers and `httpOnly + Secure + SameSite=Strict` cookies with double-submit CSRF protection (`X-CSRF-Token`).

| Security & Architectural Aspect | `localStorage` Pattern | `httpOnly + Secure + SameSite=Strict` Cookie Pattern | CosmoAI Implementation & Mitigation |
| :--- | :--- | :--- | :--- |
| **XSS Token Exfiltration** | **Vulnerable**: Any JavaScript executed on origin can read `localStorage.getItem('auth_token')`. | **Immune**: `document.cookie` cannot access `httpOnly` cookies; scripts cannot read or steal tokens. | Combined `rehype-sanitize` + Helmet strict CSP (`script-src 'self'`) prevents XSS in the first place, while `httpOnly` cookies provide defense-in-depth against token exfiltration. |
| **CSRF (Cross-Site Request Forgery)** | **Immune**: Browsers never automatically attach `localStorage` items to cross-site requests. | **Vulnerable without mitigations**: Browsers attach cookies automatically on cross-site requests. | CosmoAI enforces `SameSite=Strict` and requires a matching `X-CSRF-Token` header for all state-mutating requests (`POST`, `PUT`, `DELETE`) authenticated via cookie. |
| **Decoupled API / Cross-Domain Usage** | **Seamless**: Mobile apps, CLI tools, external microservices, and separate CDN domains easily send `Bearer <token>`. | **Complex**: Requires shared apex domain cookies or reverse proxy setups across separate subdomains. | The backend supports dual-mode: clients can authenticate via either `Bearer` header or `httpOnly` cookie. |
| **Server-Sent Events (SSE) Streaming** | Works smoothly with streaming `fetch` passing `Authorization` headers. | Supported automatically via cookie credentials without client header configuration. | Supported in both modes with client disconnect handling via `AbortController`. |

---

## 8. Web Search Privacy, Query Minimization & Data Leakage Prevention

```text
       User Message (e.g. "Can you please search Google for OpenAI CEO? My email is user@test.com")
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │   Allow Web Search Setting Check  │
                   │   - If disabled: bypass search    │
                   │   - Strip tools from Gemini config│
                   └─────────────────┬─────────────────┘
                                     │ ENABLED
                                     ▼
                   ┌───────────────────────────────────┐
                   │    PII & Financial Redaction      │
                   │  - Emails, phone numbers, cards   │
                   │  - Aadhaar / PAN / SSN IDs        │
                   │  - API keys (AIza, sk-, gsk-, ...)│
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │      Context Isolation Guard      │
                   │  - Strip <untrusted_memory>       │
                   │  - Strip <untrusted_document>     │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    Minimal Query Rule Extraction  │
                   │  - Strip greetings & filler       │
                   │  - Isolate question core entity   │
                   │  - Max 120 chars / 15 words       │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                     Outbound Query: "OpenAI CEO"
               (Logged with redaction; exact query returned to client)
```

### 8.1 Minimal Entity Query Rewriting (`buildMinimalSearchQuery`)
Instead of forwarding the entire multi-thousand-character prompt or multi-turn chat history to third-party web search APIs (Tavily), CosmoAI isolates only the target entity:
- **Noise Elimination**: Iteratively strips conversational preambles (`"can you please search google for..."`, `"find information on..."`, `"look up..."`).
- **Punctuation & Length Bounding**: Cleans trailing punctuation and enforces a strict 120-character / 15-word cap, preventing oversized context from leaking upstream.
- **Quoted Entity Extraction**: When quotes are supplied (e.g. `who is "Sam Altman"?`), the quoted literal is extracted directly.

### 8.2 Sensitive Data Redaction (`redactSensitiveData`)
Before any query leaves the server boundary:
- **Identity & Financial Data**: Full regular-expression scrubs detect and remove emails, international and domestic phone numbers, 13-19 digit card numbers (Visa, MC, Amex, Discover), Aadhaar numbers (12-digit Indian national UID), PAN numbers (10-character Indian alphanumeric tax identifier), and US SSNs.
- **API Keys & Secrets**: Detects and purges Google API keys (`AIza...`), OpenAI keys (`sk-...`), Groq keys (`gsk-...`), Tavily keys (`tvly-...`), and `Bearer` authorization tokens.

### 8.3 Strict Memory & Document Isolation
- Long-term profile facts (`<untrusted_memory>`, Tier 2) and RAG document chunks (`<untrusted_document>`, Tier 3) are strictly prohibited from entering search queries. Any residual untrusted delimiters are completely stripped.

### 8.4 User Control & Grounding Transparency
- **User Toggle (`allowWebSearch`)**: Users can disable web search entirely via the chat header button or input bar quick-toggle. The backend bypasses Tavily and omits Gemini's `googleSearch` tool declaration so search engines never receive any request.
- **Safe Logging**: Full queries with personal data are never written to logs; queries are sanitized through `redactSensitiveData` before printing to standard output.
- **Client Grounding Metadata**: The exact minimal search query executed is surfaced to the client (`metadata.searchQuery`), which displays the exact query alongside verified citation badges.

---

## 9. Datastore Resilience, Single-Writer Mutex & Crash Recovery (`server/db/store.js`)

```text
       Concurrent saveUserMemory() calls (e.g. 100 parallel turns)
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │        In-Memory Compound Index         │
                │  - O(1) compound key (userId, cleanKey) │
                │  - O(1) memoryIdIndex (id -> memory)    │
                │  - Strict case-insensitive normalization│
                └────────────────────┬────────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │          Write Debounce Window          │
                │  - Batches rapid updates (25ms window)  │
                └────────────────────┬────────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │     Single-Writer FIFO Mutex Queue      │
                │  - Sequential promise chain lock        │
                │  - Strictly prevents interleaved I/O    │
                └────────────────────┬────────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │         Atomic Two-Phase Flush          │
                │  1. Write to local_store.json.tmp.<pid> │
                │  2. fsync to force physical disk sync   │
                │  3. Refresh local_store.backup.json     │
                │  4. Atomic renameSync() to primary file │
                └────────────────────┬────────────────────┘
                                     │
                          Crash / Host Failure?
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │        Automated Recovery on Boot       │
                │  - Validate primary JSON parse integrity│
                │  - If corrupt: loud alert + restore from│
                │    rolling backup local_store.backup    │
                │  - Auto-heal primary file on disk       │
                └─────────────────────────────────────────┘
```

### 9.1 Single-Writer Mutex & Write Debounce
- **Single-Writer Queue**: Disk write requests are channeled through a sequential promise mutex chain (`writeMutexChain`). Even if dozens of API requests mutate state simultaneously, only one write operation accesses the filesystem at a time.
- **Debounced Batching**: Rapid writes within a 25ms window are coalesced into a single consolidated disk write without dropping updates or losing promises.

### 9.2 Atomic Temp File, `fsync`, and Rolling Backup
- **Durability (`fsyncSync`)**: The serialized datastore is written to a process-unique temporary file (`local_store.json.tmp.${process.pid}.${Date.now()}`), followed by an explicit `fsyncSync` system call to guarantee all dirty pages are flushed to physical storage before renaming.
- **Rolling Backup**: Prior to replacing the primary file, the current valid `local_store.json` is safely copied to `local_store.backup.json`.
- **Atomic Renaming**: The temp file is renamed over `local_store.json` using `fs.renameSync`. This atomic filesystem operation guarantees the primary file is either fully updated or completely untouched; a crash mid-write leaves the primary file uncorrupted.

### 9.3 Self-Healing Corrupt-File Recovery
- When `loadLocalStore()` executes, it parses `local_store.json`.
- If a syntax error, zero-byte file, or corruption is detected, CosmoAI logs a critical alert to `console.error`, automatically restores state from `local_store.backup.json`, and repairs `local_store.json` on disk immediately.

### 9.4 \$O(1)\$ Compound Indexing
- Memory retrieval and upserts bypass linear scans entirely by utilizing two in-memory hash indexes:
  - `compoundMemoryIndex`: Maps `${userId}:::${cleanKey}` directly to memory objects.
  - `memoryIdIndex`: Maps `memoryId` directly to memory objects.
- Case-insensitivity is strictly enforced: `normalizeMemoryKey` trims, lowercases, and replaces whitespace with underscores, ensuring `"Preferred Tech Stack"` and `"preferred_tech_stack"` resolve to the identical record.

---

## 10. Per-Session Async Mutex, Monotonic Sequencing & Orphan Repair

```text
Concurrent Sends in Same Session (e.g. Rapid User Clicks or Parallel API Calls)
                         │
                         ▼
        ┌───────────────────────────────────┐
        │   Per-Session FIFO Mutex Queue    │
        │   (keyed strictly by sessionId)   │
        └─────────────────┬─────────────────┘
                          │ Exclusive Turn Lock
                          ▼
        ┌───────────────────────────────────┐
        │ Monotonic Seq & History Fetch     │
        │ - Reads history sorted by seq     │
        │ - Stamped User Msg (seq = N)      │
        └─────────────────┬─────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ Orphan Turn Detection & Repair    │
        │ - Detects incomplete past turns   │
        │ - Marks orphans (isOrphan: true)  │
        │ - Excludes orphans from Tier 1    │
        └─────────────────┬─────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ LLM Inference / SSE Streaming     │
        │ (Holds session lock until done)   │
        └─────────────────┬─────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ Stamped Assistant Msg (seq = N+1) │
        │ Release Mutex -> Next Turn Starts │
        └───────────────────────────────────┘
```

### 10.1 Design Choice: Mutex Queuing vs 409 Conflict
When a user or client sends a message while a previous turn is streaming in the same session:
- **Decision: Sequential Queueing**: CosmoAI chains concurrent requests onto an asynchronous per-session FIFO queue (`withSessionLock`).
- **Rationale**: Rejecting with `409 Conflict` frustrates users who type quickly or applications executing multi-turn workflows. By queuing in FIFO order, all messages are processed predictably in chronological order without dropped turns, interleaving, or race conditions.
- **Lock Lifecycle**: The lock is acquired at the start of `handleChat` and held across both synchronous generation and long-lived SSE streaming. Disconnects or upstream aborts release the lock in a `finally` block, ensuring subsequent queued turns are never starved or deadlocked.

### 10.2 Monotonically Increasing Sequence Numbers (`seq`)
Every message saved to `inMemoryMessages` is assigned a strictly increasing integer sequence number `seq` per session:
- `db.saveMessage` calculates `seq = Math.max(...existing.seq) + 1`.
- When loading from legacy datastores, sequence numbers are backfilled based on message order.
- All database queries (`db.getMessagesBySession`), Tier 1 history assembly, and API endpoints (`GET /api/history/:sessionId`) sort messages by `seq` ascending, eliminating reliance on non-monotonic or collision-prone timestamps.

### 10.3 Orphan Turn Detection & Context Exclusion (`detectAndRepairOrphans`)
Network drops, server timeouts, or mid-stream client disconnects can leave a user message stored without a corresponding assistant response. Left unhandled, this orphan user message would break the `(user, assistant)` pair alignment of subsequent turns:
- **Orphan Detection**: Scans message history ordered by `seq`. If a user message is followed directly by another user message (or an assistant message appears without a preceding user), it is flagged with `isOrphan: true` and `orphanReason: 'missing_assistant_response'`.
- **Tier 1 History Exclusion**: `detectAndRepairOrphans` strips orphaned turns from `repairedHistory`. When `getSessionContext` constructs the dialogue context for the LLM, it passes only valid atomic pairs, guaranteeing that history truncation and prompt formatting never drop mismatched turns or misalign conversations.
