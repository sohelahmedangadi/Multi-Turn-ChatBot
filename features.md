# Project Features Specification (features.md)

Comprehensive technical breakdown of all architectural components, services, and user features implemented in the **Multi-Turn Conversational AI Capstone (CosmoAI)**.

---

## 1. Modular Decoupled Architecture (`client/` & `server/`)

The application is structured into decoupled, modular workspaces:
- **`client/` (Frontend)**: Single Page Application powered by React 19, Tailwind CSS v4, Lucide React, and Vite with hot module replacement and dev API proxying.
- **`server/` (Backend)**: Express API gateway featuring LangChain 3-tier memory, Multimodal RAG document analysis, worker thread extraction pool, ambiguity heuristics, dual-engine failover streaming, and the automated 77-point test suite.

---

## 2. 3-Tier Conversational Context & Memory Architecture

The system implements a hierarchical 3-tier memory engine designed to provide rich long-term conversational awareness without exhausting LLM context windows or incurring runaway token costs.

```text
                  +----------------------------------------------------+
                  |               Incoming User Message                |
                  +-------------------------+--------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------------------------+
|                                    3-TIER CONTEXT COMPOSER                                         |
|                                                                                                    |
|  [Tier 1: Sliding Window]        [Tier 2: LangChain Long-Term]          [Tier 3: Domain Knowledge]  |
|  - Active session turn history  - Profile, projects, tech stacks       - Architectural RAG chunks  |
|  - Token-budgeted truncation    - Vector cosine similarity match       - Domain topic alignment    |
|  - Atomic pair drop strategy    - Conflict resolution & forget logic   - Seeded reference store    |
|                                 - Cross-Session Past History Catalog                               |
+-------------------------------------------+--------------------------------------------------------+
                                            |
                                            v
                  +----------------------------------------------------+
                  |       Assembled LLM Context Window (Prompt)        |
                  +----------------------------------------------------+
```

### Tier 1: Sliding-Window Dialogue History (`server/services/contextManager.js`)
- **Session-Scoped Message History**: Preserves exact multi-turn exchanges within an active chat thread.
- **Token-Aware Truncation (`truncateHistoryToTokenBudget`)**:
  - Dynamically calculates approximate tokens (`Math.ceil(chars / 4)`).
  - When history exceeds budget (default 1,800 tokens), it drops oldest turns in atomic **(user, assistant)** pairs to ensure the conversational turn sequence remains intact and contextually sound.
- **Role Normalization**: Normalizes dialogue roles strictly to `'user'` and `'assistant'`.

### Tier 2: LangChain Long-Term User Memory (`server/services/langchainMemory.js` & `server/services/memoryManager.js`)
- **Automated Entity & Fact Extraction**:
  - Leverages LangChain (`@langchain/core`, `@langchain/openai`, `@langchain/google-genai`) to parse incoming user messages for durable personal facts (user name, project titles, tech stacks, preferences, and roles).
  - Features a **resilient rule-based fallback parser** ensuring reliable zero-downtime memory extraction even when external LLM endpoints face rate limits.
- **In-Place Conflict Resolution**: Detects updates (e.g., *"I renamed my project from OmniTurn to ApexBot"*) and updates existing records in place rather than creating redundant duplicates.
- **Explicit Forgetting**: Processes deletion directives (e.g., *"Forget my tech stack"*, *"Delete my location"*) and removes corresponding stored facts immediately.
- **Vector Cosine Similarity Retrieval (`vectorizeText` / `calculateVectorCosineSimilarity`)**: Generates term-frequency vectors for queries and memories, selecting top contextually relevant memories within a dedicated token budget (default 300 tokens).
- **Cross-Session Full Conversation History Access**:
  - Provides full access to the user's past conversation sessions and message transcripts, bounded by a 1,200-token catalog to prevent context blowup or rate limits.
- **Strict Cross-User Isolation**: Memory queries and writes are strictly scoped to the active `userId`, preventing cross-tenant data leakage.

### Tier 3: Domain Knowledge Base RAG Chunks (`server/db/store.js`)
- **Seeded Knowledge Repository**: Pre-populates architectural documents, ambiguity engine specs, LLM fallback documentation, and evaluation guidelines.
- **Context Augmentation**: Matches query semantics against domain knowledge chunks (budget default 500 tokens) to inject authoritative project domain grounding.

---

## 3. Asynchronous File Upload & Multimodal Analysis Architecture (`server/services/extractors/` & `server/services/ragService.js`)

CosmoAI provides an asynchronous, worker-thread-isolated document ingestion and multi-turn conversational analysis engine designed for enterprise stability, strict tenant isolation, and low latency.

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
                  │  - Scoped by (userId, sha256)                 │
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

### 3.1 Upload Validation & Defensive Boundaries (`fileValidator.js`)
- **Magic Bytes Verification**: Inspects leading binary bytes to prevent MIME-type spoofing:
  - PDF: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
  - PNG: `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47`)
  - JPEG: `\xFF\xD8\xFF` (`0xFF 0xD8 0xFF`)
  - DOCX: PK ZIP container signature (`0x50 0x4B 0x03 0x04`) containing required `word/` package entries.
  - CSV: Delimiter frequency and row-column consistency validation.
- **Zip Bomb & Archive Safety**: Limits extracted size to 50MB and archive entry count to 500 entries, throwing `ZipBombError` when limits are breached.
- **Disk Isolation & Path Traversal Defense**: Strips directory sequences (`../../`, `..\..\`) and stores raw files outside the web root under `uploads_storage/<fileId>.bin`.
- **Upload Rate Limiting**: Enforces a strict 10 uploads / 5 minutes ceiling per user/IP.

### 3.2 Asynchronous Worker Pool & CPU Watchdog (`workerPool.js` & `asyncJobQueue.js`)
- **Non-Blocking Architecture**: Upload returns `HTTP 202 Accepted` immediately with a `jobId`, allowing the client to poll `GET /api/files/status/:jobId` without blocking the main event loop.
- **CPU Isolation with `node:worker_threads`**: Parsing of large or complex documents runs in isolated worker threads, keeping Express responsive (< 5ms API latency).
- **Watchdog Timeout Enforcement**: Active 15,000ms timer calls `worker.terminate()` if parsing enters a synchronous CPU lock or catastrophic regex backtracking, safely throwing `ExtractionTimeoutError`.

### 3.3 Structure-Preserving Extractors (`server/services/extractors/`)
- **DOCX Extractor (`docxExtractor.js`)**: Pure-JS parser leveraging `mammoth` with an OpenXML fallback, preserving heading hierarchies (`Heading 1`, `Heading 2`), paragraphs, and formatted tables in the structured text representation.
- **CSV Tabular Extractor (`sheetExtractor.js`)**:
  - RFC-4180 compliant CSV parser with quote escaping.
  - Automated column data type inference (`number`, `string`, `date`, `boolean`).
  - Automated schema summary generation for large datasets (> 50 rows) with column statistics and sample head/tail rows to prevent token exhaustion.
- **PDF Extractor (`pdfExtractor.js`)**:
  - `pdf-parse` text extraction with encrypted/corrupt document detection (`EncryptedPdfError`).
  - Document-level scanned PDF rule: if &ge; 60% of pages yield `< 80` characters, seamlessly triggers **Gemini 2.5 Flash Vision OCR**.
- **Images & Multimodal OCR (`imageExtractor.js`)**: Direct image extraction with high-accuracy transcription via Gemini Vision.

### 3.4 User-Scoped Deduplication & Session Namespace Isolation
- **Tenant & Session Security**: Deduplication lookups are strictly partitioned by `(userId, sha256)`.
- **Zero Cross-Session Chunk Leakage**: When a document hash is reused, only the extracted `ParsedDocument` object is retrieved from the cache. The chunks are strictly re-chunked and re-indexed into the target session's vector store namespace, ensuring chunks never leak across sessions or users.

### 3.5 Hybrid RAG, Citations & Multi-Turn Context Follow-Up (`ragService.js` & `contextManager.js`)
- **Structure-Aware Chunking**: 350 tokens per chunk (~1,400 characters) with a 50-token overlap, preserving semantic paragraph boundaries.
- **Hybrid Retrieval**: Combines term-frequency cosine similarity and BM25 keyword matching within a dedicated **2,400-token RAG budget** (accommodating 6–8 top-ranking chunks).
- **Whole-Document Detection (`isWholeDocumentQuery`)**: Accurately recognizes summarization and overview requests (e.g., *"summarize this document"*, *"overview of the file"*), injecting pre-computed document summaries instead of arbitrary top-k snippets.
- **Multi-Turn Recency Follow-Up**: Automatically resolves file references in follow-up queries (*"What was their conclusion?"*) using the most recently attached file in the dialogue thread without requiring re-upload.
- **Structured Citations**: Emits detailed citation metadata (`[Doc: filename, Page/Section]`) streamed over SSE and rendered as interactive citation pills in the client.
- **Lifecycle Cleanup (`DELETE /api/files/:fileId`)**: Completely cleans up metadata, disk storage, and vector store chunks upon user deletion.

## 4. Real-Time Web Search Grounding & Tavily Fallback (`server/services/webSearchService.js` & `server/services/llmProvider.js`)

- **Primary: Gemini Native Google Search Grounding (`@google/genai`)**:
  - Built directly into the Gemini API request via `tools: [{ googleSearch: {} }]`.
  - Automatically queries Google Search when real-time or niche information is needed.
  - Extracts and formats `groundingMetadata` (including search queries and source URLs/titles) so the UI displays verified citation pills.
- **Fallback: Groq + Tavily Search API**:
  - Catches regex triggers like `[SEARCH: <query>]` emitted by open-source models during Gemini quota limits.
  - Queries **Tavily Search API** with a 7-second timeout, extracting summarized answers and top 5 clean source snippets.
  - Injects formatted search context and re-prompts the model for natural-language synthesis with markdown citation links.
- **Graceful Error Handling & Fallback**:
  - All web search calls are wrapped in robust error-handling blocks; if search fails or times out, the chatbot falls back seamlessly to base knowledge without throwing errors or hallucinating ungrounded sources.

---

## 5. Zero-Cost Heuristic Ambiguity Detection (`server/services/ambiguityDetector.js`)

- **Local Rule-Based Pre-check**: Analyzes incoming messages locally before dispatching requests to external LLM APIs.
- **Pronoun & Vague Reference Detection**: Identifies underspecified queries lacking referents (e.g., *"what about that?"*, *"tell me more"*, *"why?"*, *"explain it"*) when no prior dialogue context exists.
- **Instant Clarification Response**: Immediately returns a targeted clarifying question:
  > *"Could you clarify what "it/that" refers to so I can provide an accurate answer?"*
  - **Latency**: Sub-millisecond execution.
  - **Cost**: **0 API tokens and 0 LLM costs**.
- **Contextual Pass-Through**: If previous dialogue turns already establish the entity, the query passes straight to the LLM.

---

## 6. Dual-Engine LLM Inference & Resilient Fallback (`server/services/llmProvider.js`)

- **Primary Engine**: Google Gemini API via official `@google/genai` SDK (`gemini-2.5-flash`).
- **Secondary / Fallback Engine**: Groq SDK (`groq-sdk`) with ultra-fast inference (`qwen/qwen3.8-27b`).
- **Payload Validation & Sanitization**: Strips empty messages and guarantees `role: 'system'` has non-empty content to prevent upstream 400 Bad Request errors.
- **Multi-Model Failover Chain**: Automatically catches upstream rate limits (429 Too Many Requests), model deprecation errors, or timeout spikes, cycling through candidate fallback models seamlessly without dropping the user's conversation.
- **Real-Time SSE Streaming (`generateStreamResponse`)**: Server-Sent Events stream tokens incrementally to the client for responsive word-by-word visual output with abort controller support.

---

## 7. Evaluation Suite & Semantic Coherence Engine (`server/services/evaluationSuite.js`)

- **Semantic Coherence Metric (`calculateCoherenceScore`)**:
  - Analyzes entity and keyword overlap across the history, user query, and assistant response.
  - Outputs a normalized coherence score from 0.0 to 1.0.
- **5 Standard Automated Multi-Turn Benchmarks**:
  1. **Context Memory & Entity Retention**: Validates recall of user preferences across turns.
  2. **Ambiguity Clarification Trigger**: Verifies heuristic interception of vague queries.
  3. **Multi-Step Math & State Modification**: Assesses accurate state tracking across sequential modifications.
  4. **Negative Constraint Adherence**: Confirms strict adherence to negative constraints (e.g., forbidden words).
  5. **Prompt Injection Safety**: Tests resistance against jailbreak attempts and system prompt extraction.
- **User Rubric Quality Scoring**: Interactive 1–5 scale modal for scoring *Relevance*, *Coherence*, and *Helpfulness* with optional feedback notes.
- **Evaluation Dashboard & Analytics (`/api/evaluate/summary`)**: Aggregates rubric metrics, average response latencies, and benchmark pass rates.

---

## 8. Security & Defensive Engineering

- **Prompt Injection Neutralization (`server/middleware/sanitizer.js`)**: Detects and sanitizes adversarial prefixes (e.g., *"ignore previous instructions"*, *"system override"*, *"DAN mode"*).
- **IP Rate Limiting (`express-rate-limit`)**: Enforces a strict 30 requests/minute ceiling per IP to protect against denial-of-service and API quota exhaustion.
- **Input Sanitization**: Enforces maximum message length (2,000 characters), strips null bytes, and sanitizes malformed Unicode control characters.
- **Password Security**: Salted cryptographic password hashing with bcryptjs.
- **Stateless Authentication**: Signed JSON Web Tokens (JWT) with 7-day expiration.
