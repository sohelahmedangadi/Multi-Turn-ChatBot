# Multi-Turn Conversational AI Capstone (CosmoAI)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LangChain.js](https://img.shields.io/badge/LangChain.js-Core-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-Fast_Inference-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![Tests](https://img.shields.io/badge/Tests-558%2F558_Passing-brightgreen)](server/test-suite.js)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade, modular full-stack multi-turn conversational AI system featuring **3-Tier Conversational Memory**, **Multimodal Document & Media RAG (PDF, DOCX, CSV, Images, Video)**, **Real-Time Web Search Grounding**, **Dual-Engine LLM Resilience (Gemini 2.5 Flash + Groq)** with Server-Sent Events (SSE) streaming, and an integrated **automated evaluation suite**.

For detailed architectural specifications and benchmark methodologies, see:
- 📘 [ARCHITECTURE.md](ARCHITECTURE.md) &mdash; Deep technical architecture & component interactions.
- 📊 [CAPSTONE_REPORT_README.md](CAPSTONE_REPORT_README.md) &mdash; Full capstone evaluation report, rubric calibration, and benchmarks.
- 🧪 [QA_TEST_RESULTS.md](QA_TEST_RESULTS.md) &mdash; Comprehensive 558-assertion test verification matrix.

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
|  - Rate Limiter (Email + IP)         - Prompt Injection Sanitizer & Delimiters     |
|  - JWT Authentication & CSRF Guard   - Session Lock Mutex (Per-Session FIFO Queue) |
+------------------------------------------+-----------------------------------------+
                                           |
                                           v
+-----------------------------+                     +--------------------------------+
|  Zero-Cost Ambiguity Engine |                     |  3-Tier Memory Context Manager |
|  - Rule-based regex parser  |                     |                                |
|  - Resolves active media    |                     |  * Tier 1: Sliding Window      |
|  - 0 token, 0ms LLM bypass  |                     |  * Tier 2: LangChain Facts     |
+-----------------------------+                     |  * Tier 2.5: Cross-Session Log |
                                                    |  * Tier 3: Vector Knowledge    |
+-----------------------------+                     |  * RAG Document Chunks         |
| Multimodal Extraction Pool  |-------------------->|  * Grounding Directives        |
| - Worker threads + watchdog |                     +----------------+---------------+
| - PDF, DOCX, CSV, Images    |                                      |
| - Video (OpenCV + Whisper)  |                                      v
+-----------------------------+                     +--------------------------------+
                                                    | Dual-Engine LLM Failover Pool  |
                                                    | - Primary: Gemini 2.5 Flash    |
                                                    | - Fallback: Groq (Qwen / GPT)  |
                                                    | - Real-time SSE Token Stream   |
                                                    +--------------------------------+
```

---

## Core Capabilities

### 1. 3-Tier Conversational Memory Engine
- **Tier 1 (Working Context Window)**: Sliding dialogue buffer enforcing token budgets (3,200 total context cap). Drops oldest turns in aligned `(user, assistant)` atomic pairs with Indic/CJK script-aware token estimation.
- **Tier 2 (LangChain Semantic Fact Store)**: Extracts durable profile facts (user identity, project names, tech stack) using LangChain extractors. Features in-place conflict resolution, explicit forget directives (`"forget my project"`), and user-isolated vector retrieval.
- **Tier 2.5 (Cross-Session History Catalog)**: Allows the model to recall prior conversations across different chat sessions, bounded within a 1,200-token catalog budget.
- **Tier 3 (Persistent Vector Knowledge)**: Domain concepts and document embeddings stored in Chroma DB (or built-in local vector fallback) with user and session namespacing.

### 2. Multimodal RAG & Media Extraction
- **Asynchronous Worker Pool**: CPU-intensive file extraction runs in isolated Node.js worker threads with hard watchdog timers (15s for documents, 60s for images, 120s for video).
- **Supported File Types**:
  - **PDF (`.pdf`)**: Native text extraction with scanned page detection and Gemini Vision OCR fallback.
  - **DOCX (`.docx`)**: Heading retention and structured paragraph extraction via `mammoth`.
  - **CSV / Sheets (`.csv`, `.xlsx`)**: Automatic column type inference, schema summaries, and truncation protection for large datasets.
  - **Images (`.png`, `.jpg`, `.webp`)**: OCR text extraction (Tesseract / EasyOCR) and multimodal cloud vision analysis.
  - **Video (`.mp4`, `.mov`, `.webm`)**: Frame sampling via OpenCV, direct PyAV audio extraction, Faster-Whisper timestamped speech recognition, and Gemini multimodal scene breakdown.
- **Upload Hardening**: Magic-byte signature verification, decompression bomb caps (ZIP/Image/Video), safe filename sanitization, and SHA-256 deduplication.

### 3. Real-Time Web Search Grounding
- **Primary**: Google Gemini native `googleSearch` grounding tool with automatic source citations.
- **Fallback**: Groq failover engine with Tavily Search API, query entity extraction, and PII/API-key redaction before search queries leave the server.
- **User Control**: Global and per-session search toggle persisted across sessions.

### 4. Zero-Cost Ambiguity Detection
- Intercepts vague questions (e.g. *"What about that?"*, *"Explain this"*) in 0ms with **0 tokens consumed**.
- Resolves active session documents and attached media *before* triggering heuristics to avoid false positives on valid follow-up questions.

### 5. Dual-Engine LLM Resilience
- **Primary**: Google Gemini (`gemini-2.5-flash`) via the official `@google/genai` SDK.
- **Secondary**: Groq Cloud SDK (`qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, `allam-2-7b`).
- **Circuit Breaker**: Tracks consecutive 429/5xx errors, automatically tripping failover to Groq with exponential backoff and half-open probe recovery.

### 6. Security & Defensive Engineering
- **Prompt Injection Defense**: Normalizes input (Unicode NFKC, zero-width stripping) and wraps user content in structural XML delimiters (`<untrusted_user_message>`).
- **Markdown & XSS Sanitization**: Frontend sanitization via `rehype-sanitize` strips raw HTML, dangerous URL schemes (`javascript:`, `data:`), and event handlers.
- **Progressive Auth Rate Limiting**: Dual-keyed on `(email, IP)` with progressive backoff delays (1s, 2s, 4s...) to prevent denial-of-service lockouts against legitimate users.

---

## Project Structure

```text
multi-turn-conversational-ai-capstone/
├── client/                                # 🌐 FRONTEND (React 19 + Tailwind v4 + Vite)
│   ├── src/
│   │   ├── components/                   # UI components (ChatWindow, MessageItem, Modals)
│   │   ├── utils/                        # Frontend markdown sanitizers
│   │   ├── App.jsx                       # Main shell & state coordinator
│   │   └── main.jsx                      # React 19 entrypoint
│   └── vite.config.js                    # Vite bundler & backend proxy config
│
├── server/                                # ⚙️ BACKEND (Express + LangChain + RAG)
│   ├── config/                           # Centralized models.js & envConfig.js
│   ├── db/store.js                       # Atomic datastore with crash recovery & backups
│   ├── middleware/                       # JWT auth, progressive rate limiter, sanitizers
│   ├── services/
│   │   ├── extractors/                   # Worker pool, fileValidator, PDF/image/video extractors
│   │   ├── ambiguityDetector.js          # Zero-cost regex clarification heuristic
│   │   ├── contextManager.js             # 3-tier context assembly & token budgeter
│   │   ├── langchainMemory.js            # LangChain structured fact extractor
│   │   ├── llmProvider.js                # Gemini + Groq dual engine & circuit breaker
│   │   ├── ragService.js                 # Text chunking, hybrid retrieval & indexing
│   │   └── sessionLock.js                # Per-session FIFO async mutex
│   ├── index.js                          # Express REST API & SSE streaming gateway
│   └── test-suite.js                     # Complete automated test suite (558 assertions)
│
├── benchmarks/                            # Benchmark datasets, targets.json, and raw test logs
├── scripts/                              # Model audit, benchmark runners, and report sync scripts
├── tests/injection/                       # 53-regression & 68-heldout prompt injection suites
├── .env.example                          # Example environment configuration
├── ARCHITECTURE.md                       # Deep architectural specifications
└── CAPSTONE_REPORT_README.md             # Formal capstone report & academic citations
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10+ (optional, required for local Faster-Whisper video transcription and EasyOCR)
- **API Keys**: At least one LLM key ([Google AI Studio](https://aistudio.google.com/) or [Groq Console](https://console.groq.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/sohelahmedangadi/Multi-Turn-ChatBot.git
cd Multi-Turn-ChatBot

# Install root dependencies
npm install

# Install client dependencies
npm --prefix client install
```

### Environment Configuration

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Minimal required `.env` configuration:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_here_min_32_chars

# LLM Providers (At least one required)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Optional: Web search fallback API key (Tavily)
TAVILY_API_KEY=your_tavily_api_key_here

# Optional: Vector Database (Defaults to local persistent store if Chroma is not running)
CHROMA_URL=http://127.0.0.1:8000
```

> [!NOTE]
> For the complete table of all 42 configurable environment variables (rate limits, quotas, model chains, worker limits), see [CAPSTONE_REPORT_README.md](CAPSTONE_REPORT_README.md#1-environment-secrets-reference-env).

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

### Running the Application

```bash
# Start both backend and frontend concurrently
npm run dev:all

# OR start backend and frontend in separate terminals:
npm run dev          # Express backend on http://localhost:5000
npm run dev:client   # Vite frontend on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

### Running Chroma DB (Optional)

CosmoAI automatically uses its internal vector engine if Chroma DB is not running. To start Chroma DB with strict loopback isolation:

```bash
# Option A: Official Chroma CLI
npm run chroma

# Option B: Docker
docker run -d -p 127.0.0.1:8000:8000 --name chromadb chromadb/chroma
```

---

## Automated Verification & Testing

CosmoAI includes a comprehensive automated test suite with **558 passing assertions** across 15 testing domains:

```bash
# Run the complete test suite (558 passed, 0 failed)
npm test

# Run with c8 code coverage report
npm run test:coverage

# Run live model catalog audit (Gemini & Groq active chains)
npm run check:models

# Run 30-iteration latency & performance benchmark suite
npm run benchmark

# Synchronize test report matrices across documentation
npm run test:report
```

---

## REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health, circuit breaker state, Chroma status, and model config |
| `POST` | `/api/auth/register` | Register new user account (bcrypt hashed, 72-byte ceiling) |
| `POST` | `/api/auth/login` | Log in and receive JWT token with progressive delay protection |
| `POST` | `/api/auth/logout` | Revoke session tokens via `tokenVersion` increment |
| `GET` | `/api/sessions` | List all conversation sessions for authenticated user |
| `POST` | `/api/session` | Create a new conversation session |
| `DELETE` | `/api/session/:sessionId` | Delete conversation session and cascade delete messages |
| `GET` | `/api/history/:sessionId` | Retrieve message history for a session |
| `POST` | `/api/chat` | Send message (supports SSE streaming with `stream: true` & document `fileId`) |
| `POST` | `/api/files/upload` | Upload & index file asynchronously (PDF, DOCX, CSV, Image, Video) &mdash; returns `202 Accepted` |
| `GET` | `/api/files/status/:jobId` | Poll background extraction & indexing job status |
| `GET` | `/api/files/session/:sessionId` | Retrieve all active files associated with a chat session |
| `DELETE` | `/api/files/:fileId` | Remove indexed document, raw binary, and vector store chunks |
| `GET` | `/api/memories` | Retrieve Tier 2 structured profile facts |
| `DELETE` | `/api/memories/:id` | Delete a specific long-term memory record |
| `POST` | `/api/evaluate/rubric` | Submit or request independent LLM-as-judge rubric evaluation |

---

## License & Credits

Released under the **MIT License**. Built for the **Multi-Turn Conversational AI Capstone Project**.
