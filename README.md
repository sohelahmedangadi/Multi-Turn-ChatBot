# Multi-Turn Conversational AI Capstone (CosmoAI)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LangChain.js](https://img.shields.io/badge/LangChain.js-Core_%26_OpenAI-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-Fast_Inference-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![Tests](https://img.shields.io/badge/Tests-304%2F304_Passing-brightgreen)](file:///d:/multi-turn-conversational-ai-capstone/server/test-suite.js)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade, modular full-stack multi-turn conversational AI system featuring **Native Google Search Grounding & Tavily API Fallback**, **LangChain & LLM-Powered 3-Tier Conversational Memory**, **Multimodal & LangChain RAG Document Analysis (PDF, Images, CSV, Code, Text)**, **Strict Prompt-Level Anti-Hallucination Guardrails**, **Cross-Session Full Conversation History Access**, **zero-cost heuristic ambiguity detection**, **dual-engine LLM resilience (Google Gemini + Groq)** with real-time Server-Sent Events (SSE) streaming, and an integrated **evaluation & benchmark analytics suite**. Detailed design is documented in [ARCHITECTURE.md](file:///d:/multi-turn-conversational-ai-capstone/ARCHITECTURE.md).

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Project Structure (Frontend & Backend Separation)](#project-structure)
- [Core Capabilities](#core-capabilities)
  - [1. 3-Tier Memory Context Engine](#1-3-tier-memory-context-engine)
  - [2. Real-Time Web Search Grounding (Gemini Native + Tavily Groq Fallback)](#2-real-time-web-search-grounding)
  - [3. LangChain RAG & Multimodal Document Analysis Engine](#3-langchain-rag--multimodal-document-analysis-engine)
  - [4. Zero-Cost Ambiguity Detection](#4-zero-cost-ambiguity-detection)
  - [5. Dual-Engine LLM Resilience](#5-dual-engine-llm-resilience)
  - [6. Evaluation Suite & Benchmark Analytics](#6-evaluation-suite--benchmark-analytics)
  - [7. Security & Defensive Engineering](#7-security--defensive-engineering)
- [Quick Start Guide](#quick-start-guide)
  - [Installation & Setup](#installation--setup)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Automated Verification & Testing](#automated-verification--testing)
- [REST API Reference](#rest-api-reference)
- [License & Credits](#license--credits)

---

## System Architecture

```text
                               +-------------------------------------+
                               |         Frontend Client (SPA)       |
                               |  React 19 + Tailwind v4 + Lucide    |
                               +------------------+------------------+
                                                  |
                                                  | HTTP / SSE Stream
                                                  v
+------------------------------------------------------------------------------------+
|                         Express Backend API Gateway (server/)                      |
|  - Rate Limiter (30 req/min/IP)      - Prompt Injection Defense & Sanitizer        |
|  - JWT Authentication Middleware     - MongoDB Atlas / In-Memory Session Store      |
+------------------------------------------+-----------------------------------------+
                                           |
                                           v
+-----------------------------+                     +--------------------------------+
|  Zero-Cost Ambiguity Engine |                     |  3-Tier Memory Context Manager |
|  - Rule-based regex parser  |                     |                                |
|  - Vague pronoun detector   |                     |  * Tier 1: Sliding Turns (1.8k)|
|  - 0 token, 0ms LLM bypass  |                     |  * Tier 2: LangChain Long-Term |
+-----------------------------+                     |    Memory (Vector Search)      |
                                                    |  * Tier 2.5: Cross-Session     |
+-----------------------------+                     |    Past Conversation Catalog   |
| LangChain RAG & Multimodal  |                     |  * Tier 3: RAG Knowledge Base  |
| - RecursiveTextSplitter     +-------------------->|  * RAG Document Excerpts       |
| - Gemini 2.5 Multimodal OCR |                     |  * Anti-Hallucination Directives
+-----------------------------+                     +----------------+---------------+
                                                                     |
                                                                     v
+------------------------------------------------------------------------------------+
|                        Resilient LLM Inference Engine & Failover                   |
|  - Primary: Google Gemini 2.5 Flash (`@google/genai`)                              |
|  - Secondary: Groq Qwen / GPT-OSS / Allam 7B (`groq-sdk`)                          |
|  - Real-time Server-Sent Events (SSE) Streaming                                    |
+------------------------------------------+-----------------------------------------+
                                           |
                                           v
+------------------------------------------------------------------------------------+
|                     Resilient Dual Datastore (MongoDB Atlas / In-Memory)           |
|  - Users  - Chat Sessions  - Message History  - Long-Term Memories  - Rubric Logs  |
+------------------------------------------------------------------------------------+
```

---

## Project Structure

The project is decoupled into independent **`client/` (Frontend)** and **`server/` (Backend)** directory trees:

```text
multi-turn-conversational-ai-capstone/
├── client/                                # 🌐 DEDICATED FRONTEND (React 19 + Tailwind v4 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx             # User authentication modal
│   │   │   ├── ChatWindow.jsx            # Main dialogue canvas & drag-and-drop attachment dock
│   │   │   ├── CopyButton.jsx            # Clipboard copy button with fallback
│   │   │   ├── EvaluationModal.jsx       # 5 benchmark automated evaluation modal
│   │   │   ├── FileAttachmentBadge.jsx   # Document & image attachment badge
│   │   │   ├── MemoryModal.jsx           # 3-tier memory inspector & editor
│   │   │   ├── MessageItem.jsx           # Message bubbles with markdown & attachment tags
│   │   │   ├── RubricFeedbackModal.jsx   # 1-5 scale quality evaluation modal
│   │   │   ├── Sidebar.jsx               # Dialogue history & session manager
│   │   │   └── SystemPromptModal.jsx     # Persona and system instruction editor
│   │   ├── App.jsx                       # Main application shell
│   │   ├── main.jsx                      # React 19 entrypoint
│   │   └── index.css                     # Retro classic Tailwind CSS styles
│   ├── index.html                        # HTML template
│   ├── vite.config.js                    # Vite bundler & API proxy configuration
│   └── package.json                      # Frontend dependencies
│
├── server/                                # ⚙️ DEDICATED BACKEND (Express + LangChain + Memory + RAG)
│   ├── db/
│   │   └── store.js                      # MongoDB Atlas & In-Memory persistence
│   ├── middleware/
│   │   ├── auth.js                       # JWT authentication & bcrypt hashing
│   │   └── sanitizer.js                  # Prompt injection defense & input sanitization
│   ├── services/
│   │   ├── ambiguityDetector.js          # Zero-latency clarification heuristic
│   │   ├── contextManager.js             # 3-tier context & anti-hallucination assembler
│   │   ├── evaluationSuite.js            # Coherence scoring & 5 benchmark suites
│   │   ├── fileParser.js                 # Multi-format parser & Gemini Vision OCR
│   │   ├── langchainMemory.js            # LangChain durable fact extractor
│   │   ├── llmProvider.js                # Gemini 2.5 Flash + Groq failover engine
│   │   ├── memoryManager.js              # Vector search, forget & conflict resolution
│   │   └── ragService.js                 # LangChain RecursiveTextSplitter chunking & RAG
│   ├── index.js                          # Express REST API & SSE streaming server
│   ├── test-suite.js                     # 39/39 Automated Unit & Integration Tests
│   └── package.json                      # Backend dependencies & test runner
│
├── .env / .env.example                    # Environment secrets
├── package.json                           # Root workspace runner
├── README.md                              # Main project documentation
├── QA_TEST_RESULTS.md                     # 39-test QA verification matrix
└── features.md                            # Comprehensive architectural specifications
```

---

## Core Capabilities

### 1. 3-Tier Memory Context Engine
- **Tier 1: Sliding-Window History (`server/services/contextManager.js`)**
  - Maintains dialogue context across active turns.
  - Implements **token-aware truncation**: if token budget exceeds capacity (default 1,800 tokens), oldest turns are dropped cleanly in atomic `(user, assistant)` pairs.
- **Tier 2: LangChain Long-Term User Memory Store (`server/services/langchainMemory.js`)**
  - Automatically extracts structured facts (name, project details, tech stacks, preferences, and roles) using LangChain prompt templates and LLM extractors.
  - **In-Place Conflict Resolution**: Updates existing keys (e.g. project renaming) without creating duplicates.
  - **Explicit Forget Handling**: Instantly deletes memory keys upon directives like `"Forget my tech stack"`.
  - **Vector Cosine Similarity Retrieval**: Matches queries against stored facts with term-frequency vector search.
  - **Strict Cross-User Isolation**: Scoped strictly by `userId` to ensure zero cross-tenant leakage.
- **Tier 2.5: Cross-Session Full Conversation History Access**
  - Provides full access to the user's past conversation sessions and message transcripts, bounded by a 1,200-token catalog.
- **Tier 3: Domain Knowledge Base RAG Chunks (`server/db/store.js`)**
  - Pre-seeded architectural and domain concepts retrieved via vector similarity search (Unicode-aware deterministic hashed feature vectors by default, or dense semantic embeddings when `USE_REAL_EMBEDDINGS=true` is enabled) to augment model prompts.

---

### 2. Real-Time Web Search Grounding (Gemini Native + Tavily Groq Fallback)
- **Primary: Gemini Native Google Search Grounding (`@google/genai`)**:
  - Leverages Google's native `googleSearch` grounding tool configured server-side.
  - Automatically decides when real-time data is needed, queries Google Search, and extracts source citations from `groundingMetadata`.
- **Fallback: Groq + Tavily Search API (`server/services/webSearchService.js`)**:
  - Catches regex triggers like `[SEARCH: <query>]` from open-source models during Gemini quota limits.
  - Queries **Tavily Search API** with a 7-second timeout, extracting summarized answers and top verified sources.
  - Injects clean context and re-prompts the model for natural-language synthesis with citation links.

---

### 3. File Upload & Document Analysis Architecture (`server/services/extractors/`)

CosmoAI provides an asynchronous, non-blocking file upload and analysis pipeline engineered for multi-turn conversational grounding:

- **Supported Formats & Validation**:
  - **PDF (`.pdf`)**: Native text extraction with `pdf-parse`; document-level scanned detection (≥60% low-text pages triggers Gemini Vision OCR fallback); explicit encrypted/password-protected PDF rejection.
  - **DOCX (`.docx`)**: Heading retention (`Heading 1`, `Heading 2`), paragraph grouping, and structured table extraction via `mammoth` with zero-dependency OpenXML fallback.
  - **CSV / Sheets (`.csv`, `.xlsx`)**: Per-sheet RFC-4180 parsing, automated data type inference (`number`, `string`, `date`, `boolean`), and automatic schema summary + sample rows for large datasets (>50 rows) to protect context windows.
  - **Plaintext & Markdown (`.txt`, `.md`, `.json`)**: Markdown heading-aware chunking and formatted JSON schema extraction.
  - **Visual Media (`.png`, `.jpg`, `.jpeg`)**: Direct vision routing to vision-capable engines with explicit offline alerts.
  - **Magic-Byte Signature Verification**: Rejects spoofed extensions and corrupted binaries before parsing.
- **System Limits & Safety Safeguards**:
  - **Max File Size**: 20MB (`MAX_FILE_SIZE_BYTES`, configurable via `.env`).
  - **Session File Cap**: Maximum 10 files per conversation session (`SESSION_FILE_CAP`, configurable via `.env`).
  - **Per-User Daily Upload Quotas**: Enforces 50 files/day (`MAX_DAILY_UPLOADS_PER_USER`) and 100MB/day (`MAX_DAILY_BYTES_PER_USER`) per user. Exhaustion triggers `429 Too Many Requests` (`USER_QUOTA_EXCEEDED`).
  - **Zip-Bomb Decompression Caps**: Streaming header inspection checks single entry limit (30MB), max uncompressed total (50MB), max 500 entries, max 100:1 compression ratio, and rejects nested archives (`.zip`, `.tar`, `.gz`, `.7z`). Never fully inflates before inspection.
  - **Image Decompression Bomb Defense**: Validates PNG `IHDR`, JPEG SOF, and GIF headers in Node.js before memory allocation. Enforces max 8192x8192 resolution and 25,000,000 pixels (`MAX_IMAGE_PIXELS`). Python Pillow treats `DecompressionBombWarning` as a fatal error.
  - **Video Pre-Transcription Metadata Caps**: Directly parses MP4/MOV `mvhd` atom in Node.js to reject videos > 1800s (30m) before transcription. PyAV/OpenCV checks metadata and enforces 1800s duration, 3840x2160 (4K) resolution, and 100,000 frame caps before Whisper transcription starts.
  - **Python Child Process Governance**: Managed by `pythonProcessQueue` (capped at 2 concurrent jobs). Spawns in isolated process groups (`detached: true` on POSIX, `taskkill /T /F` on Windows) and kills entire tree on timeout (`SIGKILL`). Capped with `MALLOC_ARENA_MAX=2` and `OMP_NUM_THREADS=2`. Strictly uses array-based `spawn` (`shell: false`).
  - **Text-Like Validation & CSV Neutralization**: Rejects binary NUL bytes (`0x00`), validates strict UTF-8 with fatal decoding, caps lines at 50,000, and neutralizes spreadsheet formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) with prepended single quotes.
  - **Polyglot & Signature Agreement**: Rejects executable headers (`MZ`, `ELF`, Mach-O), detects dual-signature polyglot PDF/ZIP files, and verifies strict agreement between file extension, declared MIME type, and detected magic bytes.
  - **Disk Isolation & Filename Sanitization**: Files saved on disk as `<fileId>.bin` outside the web root (`uploads_storage/`). Display names are sanitized against path traversal (`../../etc/passwd` -> `passwd`), control characters, and Unicode Bidi RTL override characters (`\u202E`, etc.).
  - **Upload Rate Limiting**: 10 uploads per 5 minutes per IP/session (`uploadRateLimiter`).
- **Worker Thread Watchdog Architecture**:
  - All CPU-bound extraction runs inside isolated `node:worker_threads` (`extractorWorker.js`).
  - Hard watchdog timer calls `worker.terminate()` after 15,000ms (`EXTRACTION_TIMEOUT_MS`), safely aborting synchronous CPU locks without crashing or blocking the Express event loop.
- **User-Scoped SHA-256 Deduplication**:
  - Dedup lookup is scoped by `(userId, sha256)`.
  - Reuses only the parsed `ParsedDocument` extraction object, never sharing chunk rows across sessions. Chunks are **always** re-indexed into the current `sessionId` namespace.
- **Structure-Aware Hybrid RAG & Grounded Citations**:
  - Target 350-token chunks (~1,400 chars, 50-token overlap) with 2,400-token RAG context budget.
  - Hybrid dense vector cosine similarity + BM25 keyword matching with proximity boosting.
  - Whole-document queries ("summarize this") inject cached summaries instead of arbitrary top-k chunks.
  - Returns structured citations with every turn: `filename + (Page X / Sheet Y / Section Z)`.
- **Multi-Turn Follow-Up Resolution**:
  - Follow-up turns without an explicit `fileId` (e.g., *"What about the second table?"*) automatically resolve against the active file from previous turns. In multi-file sessions, the most-recently-uploaded file wins unless another file is explicitly named.
- **REST Endpoints**:
  - `POST /api/files/upload`: Enqueues extraction job, returns `202 Accepted` with `jobId`.
  - `GET /api/files/status/:jobId`: Polls job progress and completion state (`pending` | `processing` | `completed` | `failed` | `expired`).
  - `GET /api/files/session/:sessionId`: Lists active files attached to the session.
  - `GET /api/files/:fileId`: Retrieves document metadata and cached summary.
  - `DELETE /api/files/:fileId`: Deletes raw file from disk, purges RAG chunks, and cleans DB records.

---

### 3. Zero-Cost Ambiguity Detection (`server/services/ambiguityDetector.js`)
- **Active Context Precedence**: Resolves active session documents and attached multimodal media *before* running ambiguity heuristics. Queries like *"Summarize this"* or *"Fix it"* with an attached file or active session document are never intercepted as ambiguous.
- **Zero-Token Guardrail**: Defers Tier 2 fact extraction (LangChain) until ambiguity evaluation completes. For intercepted ambiguous turns, background fact extraction is skipped entirely, strictly guaranteeing **0 tokens consumed** and 0 remote LLM invocations.
- **Tightened Heuristics & False-Positive Elimination**:
  - Direct expletive questions (e.g. *"Is it raining?"*) and inline code snippets (e.g. *"Explain this: <code>"*, explicit functions, code blocks) are recognized as concrete and bypass ambiguity interception.
  - Vague starters (e.g. *"Show me"*, *"What about"*, *"How about"*) are scoped to trailing pronouns (`that`, `this`, `it`) rather than arbitrary nouns, avoiding false positives on legitimate questions like *"Show me quicksort"* or *"What about Python?"*.
- Returns an immediate clarifying question in 0ms with **0 tokens consumed** from LLM APIs.

---

### 4. Dual-Engine LLM Resilience (`server/services/llmProvider.js`)
- **Primary Engine**: Google Gemini API via official `@google/genai` SDK (`gemini-2.5-flash`).
- **Secondary / Fallback Engine**: Groq SDK (`groq-sdk`) with fast inference (`qwen/qwen3.8-27b`).
- **Real-Time SSE Streaming**: Incremental Server-Sent Events (SSE) token delivery with client abort support.

---

### 5. Evaluation Suite & Benchmark Analytics (`server/services/evaluationSuite.js`)
- **Semantic Coherence Metric (`calculateCoherenceScore`)**: Measures keyword and entity overlap across dialogue turns.
- **5 Standard Benchmark Scenarios**: Context Memory, Ambiguity Interception, Multi-Step Math, Negative Constraint Adherence, and Prompt Injection Defense.

---

### 6. Security & Defensive Engineering
- **Prompt Injection Defense (`server/middleware/sanitizer.js`)**: Neutralizes direct and indirect adversarial prompt injection (Greshake et al., 2023; OWASP Top 10 for LLM Applications: LLM01/LLM02) with Unicode NFKC normalization, control character stripping, and structural XML isolation (`<untrusted_*>`).
- **Client-Side Markdown Sanitization (`client/src/components/SanitizedMarkdown.jsx`)**:
  - Model and streaming outputs are parsed through `react-markdown` + `rehype-sanitize` with a strict element schema.
  - Raw HTML tags (`<script>`, `<iframe>`, `<img>`, `<object>`) and event handlers (`onerror`, `onload`) are completely stripped.
  - Links are restricted to `http:`, `https:`, and `mailto:` protocols; dangerous protocols (`javascript:`, `data:`, `vbscript:`, `file:`) and obfuscated variations (whitespace, entity encoding, URI percent-encoding, null bytes) are blocked and rendered as inert `<span>` badges.
  - All valid links automatically enforce `rel="noopener noreferrer"` and `target="_blank"`.
  - Citation badges, headings, and filenames are sanitized against HTML metacharacters and control characters before rendering.
- **Content-Security-Policy (CSP) via Helmet (`server/index.js`)**: Configures strict headers enforcing `script-src 'self'` (strictly no inline scripts or unsafe evals) and `object-src 'none'`.
- **Rate Limiting, Password Ceiling & Auth Lockout (`server/middleware/auth.js`)**: Dual-key rate limiter (5 failed attempts per 15 minutes per IP and per email) with exponential lockout backoff (429 with `Retry-After`), and strict enforcement of the 72-byte password ceiling (Provos & Mazières, 1999) to prevent silent truncation.
- **Authentication & Token Storage Tradeoff**:
  - **Dual-Mode Auth**: Supports both standard `Authorization: Bearer <token>` and `httpOnly + Secure + SameSite=Strict` cookies (`cosmo_auth_token`).
  - **CSRF Defense**: Cookie-authenticated state-modifying requests (`POST`, `PUT`, `DELETE`) require a matching `X-CSRF-Token` header.
  - **Token Invalidation**: User `tokenVersion` increments on logout (`POST /api/auth/logout`), immediately revoking all existing tokens across devices.
  - **Storage Tradeoff**: `localStorage` offers zero-CSRF vulnerability and seamless decoupled API access across subdomains, but is susceptible to token theft if XSS is present. `httpOnly` cookies provide defense-in-depth against XSS token theft, but introduce CSRF attack surface that requires SameSite=Strict cookies and anti-CSRF headers. CosmoAI implements both layers: strict markdown sanitization + helmet CSP to eliminate XSS, alongside dual cookie and Bearer auth with CSRF verification.
- **Datastore Resilience, Single-Writer Mutex & Crash Recovery (`server/db/store.js`)**:
  - **Single-Writer FIFO Queue (Mutex)**: Concurrency-controlled write chain sequentializes all disk writes, preventing interleaved writes or race conditions during rapid parallel requests.
  - **Atomic Two-Phase Flush**: Writes snapshots to a unique temp file (`local_store.json.tmp.<pid>.<time>`), issues `fsyncSync` to flush kernel buffers to physical storage sectors, refreshes a rolling backup (`local_store.backup.json`), and executes an atomic `renameSync`.
  - **Self-Healing Corruption Recovery**: `loadLocalStore()` validates JSON integrity on boot. If primary data is corrupted or truncated (e.g. from an abrupt host power failure), it reports the corruption loudly, automatically recovers state from the rolling backup, and self-heals `local_store.json` on disk.
  - **\$O(1)\$ Compound Indexing**: Eliminates linear scans with in-memory compound `(userId, key)` maps and `memoryId` indices, preserving strict case-insensitive key matching.
  - **Schema Versioning**: Enforces `schemaVersion: 2` with backward-compatible migration for legacy datastore schemas.
- **Per-Session Async Mutex, Monotonic Sequences & Orphan Turn Repair (`server/services/sessionLock.js` & `server/services/contextManager.js`)**:
  - **Per-Session FIFO Lock Queue**: An async mutex keyed by `sessionId` serializes concurrent sends. When a second send arrives while one is streaming or generating, it queues cleanly in FIFO order rather than rejecting with 409 Conflict, preventing message interleaving and race conditions.
  - **Monotonically Increasing `seq`**: Every message receives a strictly monotonic integer `seq` per session (1, 2, 3...). All history reads, context assembly steps, and API responses are ordered strictly by `seq` ascending.
  - **Orphan Turn Detection & Repair (`detectAndRepairOrphans`)**: Scans history for orphaned user messages (e.g. from upstream network severance or server errors before assistant completion). Marks orphans with `isOrphan: true` and excludes them from Tier 1 context history, ensuring conversational prompts remain strictly in aligned `(user, assistant)` atomic pairs.
- **Web Search Privacy & Data Leakage Prevention (`server/services/webSearchService.js`)**:
  - **Minimal Search Query Builder (`buildMinimalSearchQuery`)**: Rule-based entity extraction strips conversational filler, greetings, and repetitive question preambles (`"can you please search google for..."` -> entity only) and enforces a strict 120-character / 15-word cap to prevent context leakage.
  - **PII & Financial Redaction (`redactSensitiveData`)**: Scrubs email addresses, phone numbers, Aadhaar/PAN/SSN numbers, credit/debit card numbers, API keys (`AIza...`, `sk-...`, `gsk-...`, `tvly-...`, `Bearer...`), and long digit sequences before search queries leave the server.
  - **Strict Context & Document Isolation**: Memory blocks (`<untrusted_memory>`, Tier 2) and document excerpts (`<untrusted_document>`, Tier 3) are completely stripped and never forwarded to search engines.
  - **User-Controlled "Allow Web Search" Setting**: Toggle in the client header and chat input bar persisted in `localStorage` and enforced end-to-end; when disabled, external search queries are suppressed and Gemini `googleSearch` tools are omitted.
  - **Transparent Logging & Citation Display**: Full user queries with personal data are never logged; safe redacted strings are logged to stdout, and the exact executed query is returned to the client and rendered in verified source badges.
- **Model Compatibility, Centralized Configuration & Health Observability (`server/config/models.js` & `scripts/check-models.js`)**:
  - **Live Provider Model Catalog Audit (`scripts/check-models.js`)**:
    - **Full Gemini Chain Verified Active**: `gemini-2.5-flash` (Primary), `gemini-flash-latest` (Fallback #1), `gemini-3.7-flash` (Fallback #2), `gemini-2.5-flash-lite` (Fallback #3), `gemini-3.1-pro-preview` (Fallback #4), and `gemini-embedding-001` (Embedding) verified active on Google GenAI API catalog (64 available models).
    - **Full Groq Fallback Chain Verified Active**: `qwen/qwen3.8-27b` (Primary), `openai/gpt-oss-120b` (Fallback #1), `openai/gpt-oss-20b` (Fallback #2), and `allam-2-7b` (Fallback #3) verified active on Groq Cloud API catalog (11 available models).
    - **Deprecated Models Verified Absent**: `compound`, `groq/compound`, `groq/compound-mini`, `qwen/qwen3.6-27b`, and `text-embedding-004` confirmed absent on provider APIs; fail-fast and fallback guards prevent runtime failures.
    - **Live Audit Report Citation**: Full catalog verification output is automatically saved to [`docs/model-audit-2026-11-18.txt`](docs/model-audit-2026-11-18.txt) (and [`docs/model-audit-latest.txt`](docs/model-audit-latest.txt)).
    - **Startup Strict Mode & Scheduled CI Automation**: The audit runs in strict mode at server startup (`MODEL_AUDIT_STRICT=true` / `--strict-models`) and weekly on a scheduled cron (`0 0 * * 1`) in GitHub Actions (`.github/workflows/ci.yml`) to catch retired model IDs automatically.
  - **Explicit Chroma DB 127.0.0.1 Loopback Isolation**:
    - `npm run chroma` executes with explicit `--host 127.0.0.1 --port 8000` binding (never relying on defaults or 0.0.0.0).
    - Startup security guard (`assertChromaLoopback()`) verifies target host is strictly loopback and halts startup with a fatal error if Chroma answers on or points to a non-loopback address.
  - **Centralized Environment-Driven Model Config (`server/config/models.js`)**:
    - Replaces all hardcoded model identifiers with environment overrides (`GEMINI_PRIMARY_MODEL`, `GEMINI_FALLBACK_MODELS`, `GROQ_PRIMARY_MODEL`, `GROQ_FALLBACK_MODELS`, `EMBEDDING_MODEL`).
    - Startup validation (`validateAndLogModelConfig()`) validates models on server boot, logs configuration loudly, and automatically switches deprecated or unavailable primary models to configured alternatives (or fails fast if `FAIL_ON_INVALID_MODEL=true`).
  - **Enriched Health & Observability Endpoint (`GET /api/health`)**:
    - Returns structured health status reporting:
      - `provider`: Active provider name (`gemini`), Gemini model chain, Groq model chain, and active embedding model.
      - `breaker`: Gemini circuit breaker status (`CLOSED`, `OPEN`, `HALF_OPEN`), cooldown timestamps, and consecutive failure counts.
      - `chroma`: Chroma vector store connectivity status (`connected` vs `fallback_local`), target URL (`http://127.0.0.1:8000`), and collections readiness.
      - `store`: Local persistent store type, schema version (`schemaVersion: 2`), status, and live entity counts (sessions, users, memories, files, chunks).
  - **Dependency Security Audits**:
    - `npm audit`: Resolved 1 Critical vulnerability (`proxy-addr` IP spoofing) and 5 High vulnerabilities (`body-parser`, `multer`, `vite`, `source-map-js`, `zod`). 0 Critical and 0 High vulnerabilities remaining.
    - `pip-audit`: Audited global Python packages, identified outdated distributions, and verified isolated process runners.

---

## Quick Start Guide

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/sohelahmedangadi/Multi-Turn-ChatBot.git
cd Multi-Turn-ChatBot

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development

# LLM Providers (At least one required)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Web Search (Tavily API fallback for Groq)
TAVILY_API_KEY=your_tavily_api_key_here

# JWT Security
JWT_SECRET=your_super_secret_jwt_key_here

# Vector Database (Chroma DB for Tier 2/3 vector memory search)
CHROMA_URL=http://localhost:8000

# Optional: MongoDB Atlas (falls back to local persistent store data/local_store.json if omitted or unreachable)
MONGO_URI=
```

#### Environment Variables Reference Table

<!-- ENV_TABLE_START -->

| Variable Name | Required | Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | HTTP port on which the Express server listens. |
| `NODE_ENV` | Yes | `development` | Runtime environment mode ('development', 'production', or 'test'). |
| `CORS_ALLOWED_ORIGINS` | No | `*` | Comma-separated list of allowed HTTP origins or '*' for public API access. |
| `TRUST_PROXY` | No | `1` | Number of upstream reverse proxy hops to trust for accurate client IP derivation. |
| `DATA_DIR` | No | `./data` | Filesystem directory where local_store.json and automated backups are persisted. |
| `CHROMA_URL` | No | `http://127.0.0.1:8000` | Target endpoint of official Chroma Vector DB daemon (must resolve to loopback 127.0.0.1/localhost). |
| `CHROMA_COLLECTION_PREFIX` | No | `cosmo_` | Prefix for Chroma vector collections to ensure isolated test and tenant namespaces. |
| `MONGO_URI` | No | `""` | Optional MongoDB Atlas URI. If omitted or unreachable, seamlessly falls back to local datastore. |
| `JWT_SECRET` | Yes | `""` | Cryptographic secret for signing and verifying stateless JWT access tokens (minimum 32 characters). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | `900000` | Sliding window in milliseconds (15 minutes) for login/register brute-force and DoS protection. |
| `AUTH_MAX_ATTEMPTS` | No | `5` | Base failed authentication attempts allowed per (email + IP) before progressive delays trigger. |
| `AUTH_IP_MAX_CEILING` | No | `30` | Global authentication ceiling across all accounts per IP within the 15-minute window. |
| `AUTH_MAX_DELAY_SEC` | No | `60` | Maximum progressive delay cap in seconds applied to rate-limited authentication attempts. |
| `CHAT_RATE_LIMIT_WINDOW_MS` | No | `60000` | Sliding window in milliseconds (1 minute) for /api/chat endpoint rate limiting. |
| `CHAT_RATE_LIMIT_MAX` | No | `30` | Maximum chat requests allowed per window per client IP. |
| `UPLOAD_RATE_LIMIT_WINDOW_MS` | No | `300000` | Sliding window in milliseconds (5 minutes) for /api/files/upload endpoint rate limiting. |
| `UPLOAD_RATE_LIMIT_MAX` | No | `10` | Maximum file uploads allowed per window per client IP. |
| `GEMINI_API_KEY` | Conditional | `""` | Primary provider key for Google Gemini 2.5 Flash, Vision, OCR, and native Search grounding. |
| `GROQ_API_KEY` | Conditional | `""` | Secondary failover key for Groq Cloud SDK models during quota exhaustion or timeouts. |
| `TAVILY_API_KEY` | No | `""` | Real-time search API key for Groq search fallback grounding. |
| `DEFAULT_ALLOW_WEB_SEARCH` | No | `true` | Default web search grounding state when allowWebSearch is omitted from client chat requests. |
| `GEMINI_PRIMARY_MODEL` | No | `gemini-2.5-flash` | Configurable primary Gemini chat and reasoning model. |
| `GEMINI_FALLBACK_MODELS` | No | `gemini-flash-latest,gemini-3.7-flash,gemini-2.5-flash-lite,gemini-3.1-pro-preview` | Comma-separated ordered fallback chain for Google Gemini models. |
| `GROQ_PRIMARY_MODEL` | No | `qwen/qwen3.8-27b` | Configurable primary Groq chat and fact-extraction model. |
| `GROQ_FALLBACK_MODELS` | No | `openai/gpt-oss-120b,openai/gpt-oss-20b,allam-2-7b` | Comma-separated ordered fallback chain for Groq Cloud models. |
| `EMBEDDING_MODEL` | No | `gemini-embedding-001` | Configurable dense vector embedding model for Chroma vectors. |
| `USE_REAL_EMBEDDINGS` | No | `false` | Toggle genuine Google GenAI semantic embeddings vs fast offline lexical hashed vectors. |
| `FAIL_ON_INVALID_MODEL` | No | `false` | Halts server boot if any configured model ID is deprecated, sunset, or invalid. |
| `MODEL_AUDIT_STRICT` | No | `false` | Runs live provider catalog check on boot; halts if any active or fallback model is missing. |
| `STREAM_FIRST_CHUNK_TIMEOUT_MS` | No | `9000 (text) / 60000 (media)` | Watchdog timeout before falling back to secondary provider if no initial token arrives. |
| `STREAM_IDLE_TIMEOUT_MS` | No | `10000` | Watchdog timeout terminating a stream if the connection stalls between consecutive chunks. |
| `UPLOAD_DIR` | No | `./uploads_storage` | Storage directory outside web root where raw document and media binaries are stored. |
| `MAX_FILE_SIZE_BYTES` | No | `20971520` | Maximum size allowed per uploaded document in bytes (default: 20MB). |
| `SESSION_FILE_CAP` | No | `10` | Maximum number of concurrent file attachments permitted per dialogue session. |
| `MAX_DAILY_UPLOADS_PER_USER` | No | `50` | Daily file upload count quota per authenticated user identity. |
| `MAX_DAILY_BYTES_PER_USER` | No | `104857600` | Cumulative daily upload bandwidth ceiling per user in bytes (default: 100MB). |
| `MAX_CSV_LINES` | No | `1000` | Maximum row cutoff limit when extracting structured CSV spreadsheets. |
| `MAX_CSV_COLS` | No | `50` | Maximum column cutoff limit when extracting structured CSV spreadsheets. |
| `WORKER_CONCURRENCY` | No | `4` | Maximum concurrent Node.js worker threads in document parsing pool (aliases MAX_CONCURRENT_WORKERS). |
| `EXTRACTION_TIMEOUT_MS` | No | `15000` | Watchdog timeout in milliseconds (15s) before terminating hung worker extraction tasks. |
| `WORKER_MAX_OLD_GEN_MB` | No | `512` | V8 max old generation heap ceiling in MB per worker thread to prevent memory exhaustion. |
| `WORKER_MAX_YOUNG_GEN_MB` | No | `128` | V8 max young generation heap ceiling in MB per worker thread. |
| `MAX_CONCURRENT_PYTHON_JOBS` | No | `2` | Maximum concurrent Python child processes allowed for OCR, computer vision, and speech transcription. |
| `CONTEXT_MAX_TOKENS` | No | `3200` | Maximum total token budget for context assembly across all memory tiers and RAG chunks. |
| `MEMORY_MAX_TOKENS` | No | `400` | Token allocation cap for Tier 2 durable extracted user entity memories. |
| `KNOWLEDGE_MAX_TOKENS` | No | `400` | Token allocation cap for Tier 3 domain knowledge excerpts. |
| `GENERATOR_PROVIDER` | No | `groq` | Provider family generating benchmark candidate responses ('gemini' or 'groq'). |
| `GENERATOR_MODEL` | No | `openai/gpt-oss-20b` | Model ID generating candidate responses for rubric evaluation. |
| `JUDGE_PROVIDER` | No | `groq` | Independent judge provider family decoupled from generator model family. |
| `JUDGE_MODEL` | No | `qwen/qwen3.8-27b` | Independent judge model ID for 1-5 rubric scoring. |
| `JUDGE_PROMPT_VERSION` | No | `v2.0-rubric-strict` | Version identifier for the structured rubric scoring prompt. |

<!-- ENV_TABLE_END -->

### Running Chroma DB (Optional Vector Database)

CosmoAI seamlessly connects to Chroma DB for high-performance vector search:
```bash
# Option A: Run Chroma using Docker (Bound strictly to localhost 127.0.0.1 for security)
docker run -d -p 127.0.0.1:8000:8000 --name chromadb chromadb/chroma

# Option B: Run Chroma using Python CLI (Bound to 127.0.0.1)
pip install chromadb
chroma run --path ./chroma_data --host 127.0.0.1 --port 8000
```
> [!IMPORTANT]
> **Chroma DB Security & Localhost Binding**: Chroma DB on port `:8000` provides no native authentication layer. Therefore, in `docker-compose.yml` and container deployments, Chroma is bound strictly to `127.0.0.1:8000` (`127.0.0.1:8000:8000`) to prevent unauthenticated network access from outside the host.

*Note: If Chroma DB is not running, CosmoAI automatically and gracefully operates with its built-in local vector similarity engine with zero downtime.*

#### Dense Vectors vs. Real Semantic Embeddings
- **Deterministic Hashed Vectors (`hashed-v2-fnv1a`)**: Fast offline dense feature hashing (NFKC normalized, Unicode tokenized `[\p{L}\p{N}]+`, FNV-1a with signed hashing trick, English stopword pruning, light stemming). Provides cross-lingual lexical matching across Latin, Indic (Kannada, Hindi), and CJK scripts without model latency. Hashed vectors are lexical feature vectors and are not labeled "semantic".
- **Real Semantic Embeddings (`USE_REAL_EMBEDDINGS=true`)**: Enables Google Gemini's `gemini-embedding-001` API to produce genuine semantic vectors that match conceptual paraphrases and synonyms. Includes an offline fallback to deterministic hashed vectors if the remote API is unreachable, tracks `embeddingVersion` per record, and supports migration via `reembedExistingRecords()`.

### Comprehensive Route Authorization & Multi-Tenant Isolation
- **Resource Ownership Verification**: Every private resource (conversation sessions, messages, uploaded documents, background extraction jobs, and user long-term memories) verifies `resource.userId === req.user.id`.
- **404 Enumeration Defense**: If a user attempts to access, mutate, or delete a resource belonging to another user, CosmoAI returns `404 Not Found` (never `403 Forbidden`). This conceals the existence of resources and prevents ID enumeration attacks.
- **Strict User Lifecycle Verification**: `authenticateJWT` and `optionalJWT` verify that the user still exists in the database. Deleted user accounts and expired tokens immediately yield `401 Unauthorized`.
- **Multi-Tenant RAG & Deduplication Isolation**: Both Chroma DB vector collections (`cosmo_user_memories`, `cosmo_document_chunks`) and local-store fallback search enforce `{ userId }` filters. Parsed document deduplication cache is strictly keyed as `${userId}:${sha256}`, preventing cross-user document summary leakage.

### Running the Application

```bash
# Start backend Express server
npm run dev

# Start frontend Vite dev server (in another terminal)
npm run dev:client

# Build client for production
npm run build
```

---

## Automated Verification & Testing

CosmoAI maintains a comprehensive test suite of **507 automated assertions across 425 discrete test cases** covering unit, integration, property-based, end-to-end HTTP, security penetration, fault-injection, load resilience, and code coverage.

### Running the Test Suite

```bash
# Run complete test suite (507 assertions across 425 test cases — 100% pass rate)
npm test

# Generate dynamic test report & sync docs/test-log.md and README tables
npm run test:report

# Run with c8 code coverage report
npm run test:coverage

# Run CI threshold check (verifies >= 60% lines/statements, >= 55% branches, >= 60% functions)
npm run test:ci

# Run empirical performance benchmark suite (N=30 iterations, isolated datastore)
npm run benchmark

# Sync CAPSTONE_REPORT_README.md Section 8.3 from latest raw benchmark samples
npm run benchmark:report
```

### Comprehensive Testing Infrastructure:

1. **HTTP-Level End-to-End Tests (Supertest)**:
   - Full user authentication lifecycle: registration, password hashing with bcrypt, JWT token generation, `/api/auth/me` profile retrieval, `/api/auth/refresh` token refresh, and logout revocation via `tokenVersion`.
   - Multi-turn conversation sessions CRUD: create, list, history retrieval, and cascade deletion.
   - Real-time Server-Sent Events (SSE) streaming chat: anti-proxy buffering headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`), chunk delivery, terminal completion, and database turn persistence with monotonic `seq`.
   - Asynchronous document upload, status polling (`GET /api/files/status/:jobId`), document chunk retrieval (`GET /api/files/:fileId`), and file removal.
   - Long-term memory CRUD: creation, retrieval, updates, and deletion.

2. **Fault-Injecting Mock LLM**:
   - **429 Quota Exceeded**: Validates rate-limit tracking, circuit breaker trips, and graceful failover without unhandled process termination.
   - **500 Internal Server Error**: Validates server 5xx tracking, failure accounting, and clean error propagation.
   - **Slow First Token**: Injects intentional stream delay exceeding `STREAM_FIRST_CHUNK_TIMEOUT_MS`, validating that the stalled connection is aborted and fails over before emitting corrupted data.
   - **Mid-Stream Drop**: Emits initial chunks then abruptly severs the upstream socket; verifies the system detects `chunksSent > 0`, suppresses confusing secondary failover, emits terminal SSE `event: error`, and persists partial turn flagged with `incomplete: true`.
   - **Malformed Chunk**: Feeds null, empty, or non-conforming tokens into the stream; verifies robust parsing ignores malformed chunks and preserves valid tokens without crashing.
   - **Empty Response**: Verifies 0-token completions complete gracefully without hanging.

3. **Adversarial Payload Corpus via Live HTTP Route (`POST /api/chat`)**:
   - **Regression Suite** (`tests/injection/regression.json`): 53-payload benchmark including direct overrides, role-play/jailbreaks, spaced/Unicode obfuscations, multilingual overrides, base64 encodings, split-turn overrides, and memory injections.
   - **Held-Out Evaluation Suite** (`tests/injection/heldout.json`): 68 diverse payloads evaluated without defense tuning across 7 novel families (indirect injection in PDFs/CSV/OCR/search snippets, multi-turn staged injection, novel roleplay, translated Kannada/Hindi/Spanish, homoglyphs/ROT13, memory poisoning, and markdown exfiltration), alongside 20 benign look-alikes.
   - Evaluated end-to-end through `POST /api/chat`: verifies input normalization (NFKC, zero-width stripping), untrusted delimiter encapsulation (`<untrusted_user_message>`), post-generation system prompt leakage guard, and memory validation.
   - 100% of benign look-alikes ("ignore the previous error", "bypass a clogged filter", etc.) pass cleanly without false positive blockage (0.0% FPR).

4. **Load & Event Loop Lag Testing (Autocannon)**:
   - Dispatches **50 concurrent chat streams** while simultaneously processing **10 concurrent file uploads**.
   - Records p50, p95, and p99 streaming latencies.
   - Monitors Node.js event loop delay via `perf_hooks.monitorEventLoopDelay({ resolution: 20 })`, verifying that p95 event loop lag remains bounded under burst concurrent load.

5. **Property-Based Testing (fast-check)**:
   - Validates token estimation monotonicity: `estimateTokenCount(s + s) >= estimateTokenCount(s) >= 1` across 100 random generative strings.
   - Validates script-aware token budgeting: Indic and CJK character sequences receive accurate script-density token allocations.
   - Validates context window truncation invariants: `tokensUsed <= maxBudget` and atomic (user, assistant) dialogue turn pairing is strictly preserved across 100 random multi-turn conversations.

6. **Coverage Report (c8)**:
   - Minimum CI thresholds enforced via `.c8rc.json`:
     - Statements: **75.57%** (target: $\ge 60\%$)
     - Lines: **75.57%** (target: $\ge 60\%$)
     - Functions: **83.33%** (target: $\ge 60\%$)
     - Branches: **66.84%** (target: $\ge 55\%$)

```text
======================================================
📊 TEST RESULTS: 466 Passed, 0 Failed
📄 Results synced to error.md
======================================================
```
```

---

## REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | System health, active LLM provider, and DB state |
| `POST` | `/api/auth/register` | Register a new account |
| `POST` | `/api/auth/login` | Log in and receive JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated profile |
| `POST` | `/api/session` | Create a new chat session |
| `GET` | `/api/sessions` | List all sessions for user |
| `DELETE` | `/api/session/:sessionId` | Delete a specific chat session |
| `GET` | `/api/history/:sessionId` | Retrieve message history for a session |
| `POST` | `/api/chat` | Send message (supports SSE streaming with `stream: true` & document `fileId`) |
| `POST` | `/api/files/upload` | Upload & index file asynchronously (PDF, DOCX, CSV, Image, MD, Code) &mdash; returns `202 Accepted` with `jobId` |
| `GET` | `/api/files/status/:jobId` | Poll background extraction & indexing job status (`pending`, `processing`, `completed`, `failed`) |
| `GET` | `/api/files/session/:sessionId` | Retrieve all active files and metadata associated with a chat session |
| `GET` | `/api/files/:fileId` | Retrieve indexed document metadata |
| `DELETE` | `/api/files/:fileId` | Remove indexed document, raw binary, and vector store chunks |
| `GET` | `/api/memories` | Retrieve Tier 2 structured facts |
| `POST` | `/api/memories` | Manually insert a memory record |
| `PUT` | `/api/memories/:id` | Update an existing memory record |
| `DELETE` | `/api/memories/:id` | Delete a memory record |
| `GET` | `/api/knowledge` | Fetch seeded Tier 3 domain knowledge |
| `GET` | `/api/evaluate/benchmarks` | List the 5 standard benchmark scenarios |
| `POST` | `/api/evaluate/run-benchmark`| Execute an automated benchmark test |
| `POST` | `/api/evaluate/rubric` | Submit a 1–5 quality rubric rating |
| `GET` | `/api/evaluate/summary` | Retrieve aggregated evaluation statistics |

---

## License & Credits

Released under the **MIT License**. Built for the **Multi-Turn Conversational AI Capstone Project**.
