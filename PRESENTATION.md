# CosmoAI — Production-Grade Multi-Turn Conversational AI Platform
## Comprehensive Presentation, Technical Architecture & Feature Specification

---

# PART 1: Executive Overview & Slide Deck Ready Content

## 1. Project Identity & Mission

- **Project Name:** **CosmoAI** (Multi-Turn Conversational AI Capstone)
- **Tagline:** A Resilient, Multi-Turn Dialogue Engine with 3-Tier Hierarchical Memory, Dual-Engine LLM Failover, Real-Time Web Grounding, and Multimodal RAG.
- **Core Mission:** Eliminate LLM context amnesia, hallucination, latency spikes, and vendor lock-in by uniting sliding-window dialogue, long-term vector-ranked semantic memory, zero-cost ambiguity interception, and dual-layer search grounding into an enterprise-ready full-stack platform.

```
+-----------------------------------------------------------------------------------------------+
|                                    CosmoAI System At A Glance                                 |
+-----------------------------+-----------------------------+-----------------------------------+
|     3-Tier Memory Engine    |   Dual-Engine Resilience    |   Multimodal RAG & Web Grounding  |
|  Sliding Window + Vector TF |  Gemini 2.5 Flash Primary   |   PDF + Vision OCR + CSV + Code   |
|  LangChain Fact Extraction  |  Groq Qwen/Compound Breaker |   Google Grounding + Tavily API   |
+-----------------------------+-----------------------------+-----------------------------------+
| Zero-Cost Ambiguity Filter  | Real-Time SSE Token Stream  | Full Evaluation & QA Test Suite   |
| 0 tokens / 0 latency check  | Dynamic Word-by-Word UX     | 77/77 Tests Passed (100% Rate)    |
+-----------------------------+-----------------------------+-----------------------------------+
```

---

## 2. Core Problems Addressed vs. CosmoAI Solutions

| Industry Challenge | Traditional AI Chatbots | CosmoAI Solution |
| :--- | :--- | :--- |
| **Context Amnesia** | Loses user identity, projects, and facts across long threads. | **3-Tier Context Memory** with LangChain entity extraction and vector cosine retrieval. |
| **LLM Outages / Quotas** | Single API dependency (HTTP 429 quota exhaustion drops users). | **Dual-Engine Circuit Breaker** (Gemini 2.5 &harr; Groq fast failover). |
| **Ambiguity & Token Waste** | Vague queries (*"What about that?"*) burn expensive LLM calls. | **Zero-Cost Heuristic Parser** intercepts vague queries locally at 0 tokens. |
| **Hallucination on News** | Relies on stale parametric memory for current events/facts. | **Dual-Layer Web Grounding** (Native Google Grounding + Tavily API fallback). |
| **Static Document Chat** | Limited to plain text files; fails on slides and scans. | **Multimodal Vision RAG** (PDF parsing + Gemini 2.5 Vision OCR for images/slides). |
| **Security & Injection** | Vulnerable to prompt overrides and malicious inputs. | **Sanitization Layer** stripping prompt injection prefixes + IP rate limiting. |

---

# PART 2: Complete Technology Stack

```
==================================================================================================
                                    FULL TECHNOLOGY MATRIX
==================================================================================================
  LAYER                  TECHNOLOGY / LIBRARY               ROLE & PURPOSE
--------------------------------------------------------------------------------------------------
  Frontend Framework     React 19 (v19.0.1)                 High-performance modern UI rendering
  Build Tool & Server    Vite 6 (v6.2.3)                    Instant HMR, asset bundling & proxying
  Styling & Design       Tailwind CSS v4 + Lucide React     Modern dark mode, responsive glassmorphism
  Motion & Transitions   Motion (Framer Motion v12.23)      Fluid animations, modals, sliding drawers
  Markdown Rendering     react-markdown & remark-gfm        Formatted output, code blocks, tables
--------------------------------------------------------------------------------------------------
  Backend Runtime        Node.js (ES Modules)               High-throughput asynchronous event loop
  API Gateway            Express.js (v4.21.2)               REST API & SSE streaming endpoints
  Rate Limiting          express-rate-limit (v8.7.0)        30 requests/min/IP defense ceiling
  Authentication         Bcrypt.js (v3.0.3) + JWT (v9.0.3)  Salted hash passwords & 7-day stateless JWT
  File Ingestion         Multer (v2.3.0)                    Multi-part file & document upload parsing
  Database Layer         MongoDB Atlas + In-Memory Fallback Dual persistence with auto-failover
--------------------------------------------------------------------------------------------------
  Primary AI Engine      Google Gemini 2.5 Flash (@google/genai) High-speed multimodal LLM + Search
  Fallback AI Engine     Groq Cloud SDK (groq-sdk)          Sub-second open-source model inference
  RAG Chunking           LangChain Text Splitters           RecursiveCharacterTextSplitter (800/150)
  Memory Framework       LangChain Core (@langchain/core)   Entity extraction, durable memory facts
  Document Parsing       pdf-parse + Gemini Vision OCR      Text extraction from PDFs, images & slides
  Live Web Search        Google Search + Tavily Search API  Real-time web grounding and source citations
  Evaluation & Testing   Custom 52-Point Automated Suite    Coherence scoring, benchmarks & stress testing
==================================================================================================
```

---

# PART 3: Detailed Technical Architecture & Workflows

## 1. End-to-End System Architecture

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
+-----------------------------+                             |  * Tier 2: LangChain Durable Fact |
                                                            |  * Tier 2.5: Cross-Session Catalog|
+-----------------------------+                             |  * Tier 3: Domain Knowledge Base  |
| LangChain RAG & Multimodal  |                             |  * RAG Document Chunks (PDF/Img)  |
| - RecursiveCharacterSplitter+---------------------------->|  * Strict Anti-Hallucination Guard|
| - Gemini 2.5 Multimodal OCR |                             +-----------------+-----------------+
+-----------------------------+                                               |
                                                                              v
+-----------------------------------------------------------------------------------------------+
|                            Dual-Engine Resilient LLM Inference Engine                         |
|                                                                                               |
|  ┌───────────────────────────────────────────────┐  Circuit  ┌──────────────────────────────┐ |
|  │  PRIMARY: Google Gemini 2.5 Flash             │  Breaker  │ FALLBACK: Groq SDK Models    │ |
|  │  - Native Google Search Grounding Tool        │ ────────> │ - Qwen 3.8 / Compound-Mini   │ |
|  │  - Autonomous server-side web grounding       │  (on 429) │ - Regex `[SEARCH: query]`    │ |
|  │  - Automatic Grounding Citations Extraction   │           │ - Tavily Search API Injection│ |
|  └───────────────────────────────────────────────┘           └──────────────────────────────┘ |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. The 3-Tier Conversational Context Engine

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

### Deep Dive into Each Tier:
1. **Tier 1: Active Dialogue Sliding Window (`server/services/contextManager.js`)**
   - Retains conversation turns up to an **1,800 token budget**.
   - Truncates history by dropping oldest turns in **atomic (user, assistant) pairs**, preventing broken conversational states.
2. **Tier 2: LangChain Long-Term Memory (`server/services/langchainMemory.js`)**
   - Automatically extracts durable facts (Name, Projects, Tech Stacks, User Preferences) using LangChain with rule-based fallback.
   - **Vector Cosine Similarity Ranking:** Ranks stored facts against the current prompt to inject only the top relevant facts (300 token budget).
   - **Temporal Conflict Resolution:** If a user changes their role or project name (*"My project is now ApexBot"*), the existing record is updated in place.
   - **Explicit Forgetting:** Directives like *"Forget my tech stack"* permanently remove target keys.
   - **Cross-Session Catalog:** Injects summaries of past chat sessions up to a 1,200 token budget.
3. **Tier 3: Domain Knowledge Base (`server/db/store.js`)**
   - Seeded architectural documentation and guidelines injected via semantic relevance (500 token budget).

---

## 3. Dual-Layer Real-Time Web Search Architecture

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

- **Primary Path (Gemini):** Invokes native Google Search grounding tool. Extracts `webSearchQueries` and source URIs/titles from `groundingMetadata` and delivers verified source pills directly to the UI.
- **Fallback Path (Groq + Tavily):** Open-source models emit `[SEARCH: <query>]` tags. The backend intercepts this, queries the **Tavily Search API** with a 7-second abort controller, formats verified snippets, and re-prompts the model for grounded synthesis.

---

## 4. Multimodal RAG Document Analysis Pipeline

```
  [User Document Upload] (PDF, Image, CSV, JSON, Markdown, Source Code)
            │
            ▼
  [server/services/fileParser.js]
  ├─ Text / Code / CSV ─────────> Direct UTF-8 Parser
  ├─ PDF Document ──────────────> pdf-parse (filters metadata noise)
  └─ Images / Slide Scans ──────> Gemini 2.5 Flash Vision Multimodal OCR
            │
            ▼
  [LangChain RecursiveCharacterTextSplitter] (Chunk size: 800 | Overlap: 150)
            │
            ▼
  [Semantic Keyword & Proximity Scorer] (Selects top relevant excerpts)
            │
            ▼
  [Prompt Assembler] Injects into `[UPLOADED DOCUMENT CONTEXT (RAG)]`
            │
            ▼
  [Anti-Hallucination Guardrail]
  Strict directive: If document has 0 readable text, forbids guessing or fabricating based on filename.
```

---

## 5. Zero-Cost Ambiguity Detection Engine

- **Location:** `server/services/ambiguityDetector.js`
- **Mechanism:** Local regex and heuristic rule engine executed in `0ms` before calling any external LLM.
- **Trigger Conditions:** Queries containing ambiguous pronouns (*"What about that?"*, *"Explain it"*, *"Why?"*) when no referent exists in prior dialogue history.
- **Response:** Immediately returns a targeted clarifying prompt:
  > *"Could you clarify what "it/that" refers to so I can provide an accurate answer?"*
- **Benefit:** Saves **100% of LLM token costs** and eliminates unnecessary API latency for underspecified prompts.

---

# PART 4: Comprehensive Feature Matrix

| Feature Area | Specific Capabilities | Implementation Files |
| :--- | :--- | :--- |
| **Conversational Memory** | 3-tier memory, sliding token window, vector cosine TF similarity, in-place conflict resolution, explicit forgetting, cross-session past chat recall. | `contextManager.js`<br>`langchainMemory.js`<br>`memoryManager.js` |
| **LLM Resilience** | Primary Gemini 2.5 Flash, Groq open-source fallback, 60s circuit breaker on HTTP 429 quota exhaustion, SSE token streaming with AbortController. | `llmProvider.js` |
| **Web Search Grounding** | Native Gemini Google Search grounding, Groq regex `[SEARCH: query]` interception, Tavily Search API fallback, clickable UI source citation pills. | `webSearchService.js`<br>`llmProvider.js` |
| **Multimodal RAG** | Ingestion of PDF, images, CSV, JSON, Markdown, and 10+ code languages. Vision OCR for slide PDFs. LangChain 800-char chunking. Anti-hallucination guards. | `fileParser.js`<br>`ragService.js` |
| **Ambiguity Engine** | Zero-cost local regex heuristic classifier. Detects missing antecedents and returns targeted clarifying prompts at 0 token cost. | `ambiguityDetector.js` |
| **Security & Defense** | Prompt injection pattern sanitizer, IP rate limiter (30 req/min), salted Bcrypt password hashing, stateless 7-day JWT authentication. | `sanitizer.js`<br>`server/index.js` |
| **Evaluation & Rubric** | Semantic coherence scorer (0.0 to 1.0), 5 automated benchmark scenarios, 1-5 user rubric evaluation modal with persistent analytics. | `evaluationSuite.js`<br>`EvaluationModal.jsx` |
| **Modern Frontend UX** | React 19 SPA, Tailwind v4 dark theme, drag-and-drop file dock, memory inspector modal, system prompt editor, copy buttons, responsive sidebar. | `App.jsx`<br>`ChatWindow.jsx`<br>`MemoryModal.jsx` |

---

# PART 5: Quality Assurance & Validation Results

The system was subjected to an extensive **77-test automated regression suite** spanning unit, integration, stress, security, and multimodal pipeline validation:

```
==================================================================================================
                            COSMOAI QA AUTOMATION VALIDATION MATRIX
==================================================================================================
  TEST CATEGORY                             TOTAL TESTS     PASSED     FAILED     PASS RATE
--------------------------------------------------------------------------------------------------
  Ambiguity Detection & Zero-Cost Bypass        5              5          0        100.0%
  LangChain 3-Tier Memory Engine               16             16          0        100.0%
  Token-Aware Truncation & Atomic Turn Drop     3              3          0        100.0%
  Security, Bcrypt & JWT Validation             4              4          0        100.0%
  Evaluation Suite & Coherence Scorer           2              2          0        100.0%
  Magic Bytes & File Format Validation          5              5          0        100.0%
  Defensive Boundaries & Zip Bomb Defense       4              4          0        100.0%
  Document Extractors & Worker Thread Watchdog 10             10          0        100.0%
  User-Scoped Deduplication & Isolation         6              6          0        100.0%
  Multi-Turn RAG, Citations & Cleanup           9              9          0        100.0%
  Gemini Google Search Grounding Extraction     2              2          0        100.0%
  Tavily Fallback & Groq Regex Triggering       2              2          0        100.0%
  Upstream Classifier & Anti-Hallucination      9              9          0        100.0%
--------------------------------------------------------------------------------------------------
  TOTAL COMBINED TEST SUITE                    77             77          0        100.0%
==================================================================================================
```

### Highlights of Key Validated Stress & Security Scenarios:
1. **Worker Thread Watchdog Hard Termination:** Dispatched synchronous CPU locks to isolated worker threads; watchdog timer terminated the runaway worker at 15s without degrading Express main-loop latency.
2. **User-Scoped SHA-256 Deduplication:** Validated cached document reuse across sessions for the same user while strictly re-chunking and namespacing chunks, preventing cross-session and cross-user data leakage.
3. **Mid-Session Server Crash Recovery:** Server process was killed after establishing state. On reboot, session history recovered context with 100% entity recall.
4. **Temporal Conflict Resolution:** Changed user identity mid-thread; memory system updated record in-place without duplicate keys or split-personality hallucinations.
5. **Rate Limit Ceiling Defense:** 35 simultaneous requests triggered immediate HTTP 429 rate-limiting at request #31, safeguarding upstream API budgets.

---

# PART 6: Step-by-Step Presentation Slide Deck Outline

Use this ready-to-present outline for your slides:

### Slide 1: Title & Introduction
- **Title:** CosmoAI: Production-Grade Multi-Turn Conversational AI
- **Subtitle:** Context-Aware Dialogue, 3-Tier Hierarchical Memory, and Resilient Dual-Engine Architecture
- **Presenter:** [Your Name / Team Name]
- **Speaker Note:** *"Welcome everyone. Today I'm presenting CosmoAI, an enterprise-grade conversational AI platform engineered to solve the most critical challenges in production AI: context loss, API downtime, hallucinations, and high inference costs."*

### Slide 2: The Problem with Current Conversational AI
- Context window overflow & amnesia across long multi-turn chats.
- Fragile single-API dependencies (rate limits and outages take services offline).
- Hallucinations on real-time and domain-specific knowledge.
- Wasted tokens on ambiguous or vague user inputs.
- **Speaker Note:** *"Most chatbots fail either because they forget what you said 10 turns ago, hallucinate recent events, or completely break when an API hits a rate limit. CosmoAI solves all of these architecturally."*

### Slide 3: System Architecture Overview
- Showcase High-Level System Architecture Diagram.
- Highlight decoupled React 19 Frontend + Node.js Express Gateway.
- Showcase the flow from Ambiguity Filter &rarr; 3-Tier Memory &rarr; Multimodal RAG &rarr; Dual-Engine Inference.
- **Speaker Note:** *"Here is our high-level architecture. Every incoming message passes through security, ambiguity detection, and a 3-tier memory assembler before dispatching to our resilient dual-engine inference layer."*

### Slide 4: Innovation 1 — The 3-Tier Context Memory Engine
- **Tier 1:** Sliding window with atomic (user, assistant) turn-pair budget dropping.
- **Tier 2:** LangChain automated fact extraction with vector cosine similarity ranking.
- **Tier 2.5 & 3:** Cross-session past chat history catalog + domain knowledge base.
- Conflict resolution and explicit forget directives.
- **Speaker Note:** *"Our memory isn't just a raw history dump. We extract durable facts, rank them using vector similarity, resolve conflicting updates in place, and allow users to explicitly delete stored facts."*

### Slide 5: Innovation 2 — Dual-Engine Inference & Circuit Breaker
- **Primary:** Google Gemini 2.5 Flash via official `@google/genai` SDK.
- **Fallback:** Groq Cloud SDK (Qwen 3.8 / Compound models) with sub-second latency.
- Automatic 60-second cooldown circuit breaker on HTTP 429 quota exhaustion.
- Real-time Server-Sent Events (SSE) token streaming.
- **Speaker Note:** *"If Google Gemini faces a rate limit or network error, our circuit breaker trips in milliseconds, seamlessly routing conversations to Groq without the user ever noticing a disruption."*

### Slide 6: Innovation 3 — Real-Time Web Search Grounding
- Dual-layer search: Gemini Native Google Grounding + Groq/Tavily API fallback.
- Dynamic extraction of search queries and source citations.
- UI displays verified source badges with direct URL links.
- Anti-hallucination rules for thin or unverified search results.
- **Speaker Note:** *"When asked about breaking news or live events, CosmoAI grounds its answers in live web results from Google or Tavily, displaying clickable source pills for full transparency."*

### Slide 7: Innovation 4 — Asynchronous Multimodal RAG Document Pipeline
- Universal parser supporting PDFs, DOCX, Spreadsheets (CSV), Images/Slides (Vision OCR), Markdown, and 10+ code formats.
- Magic bytes validation, 50MB/500-entry zip bomb defense, and path traversal sanitization.
- Isolated `node:worker_threads` processing with a 15-second watchdog timer calling `worker.terminate()` on CPU lockup.
- Tenant-scoped SHA-256 deduplication cache `(userId, sha256)` with strict session namespace isolation.
- Structure-aware chunking (350 tokens, 50-token overlap) with hybrid cosine vector + BM25 keyword retrieval.
- Automated multi-turn follow-up resolution, whole-document summary detection, and grounded citation pills.
- **Speaker Note:** *"Users can drag and drop PDFs, DOCX files, spreadsheets, or scanned slides. Worker threads safely isolate extraction, while our hybrid RAG provides multi-turn recall with verified citation pills."*

### Slide 8: Innovation 5 — Zero-Cost Ambiguity Detection
- Local regex & heuristic pre-check (0ms latency, 0 API tokens).
- Detects vague queries (*"What about that?"*, *"Explain it"*) when no prior referent exists.
- Returns instant targeted clarifying questions.
- **Speaker Note:** *"Why spend 500 tokens calling an LLM just to ask 'What do you mean?' Our local heuristic intercepts vague queries at zero cost."*

### Slide 9: User Interface & Experience Showcase
- Modern dark mode aesthetic using Tailwind CSS v4 and Motion (Framer Motion).
- Live word-by-word SSE streaming response rendering.
- Interactive File Attachment Dock with upload previews and async polling.
- Live **Memory Modal Inspector** (view, edit, and delete stored long-term memories).
- **System Prompt Customization Modal** and **Rubric Evaluation Modal**.
- **Speaker Note:** *"Our UI is built with React 19, featuring smooth Framer Motion transitions, responsive SSE token streaming, and interactive tools to inspect memory and rate responses."*

### Slide 10: Security, Defensive Engineering & Robustness
- Prompt injection defense layer (neutralizes jailbreak attempts).
- IP rate limiter (30 requests/minute) to prevent quota depletion.
- Salted Bcrypt password hashing + stateless 7-day JWT authentication.
- Dual database persistence: MongoDB Atlas with resilient in-memory fallback.
- **Speaker Note:** *"Security is built-in: from prompt injection filters and IP rate limiting to Bcrypt password encryption and MongoDB Atlas persistence."*

### Slide 11: Testing, Benchmarks & Empirical Results
- **100% Pass Rate** across 77 automated unit, integration, security, and live regression tests.
- Evaluated on 5 standard conversational benchmarks: Memory Recall, Ambiguity Clarification, Multi-Step State Tracking, Negative Constraints, and Prompt Injection Safety.
- Verified recovery from sudden server crashes with zero state loss.
- **Speaker Note:** *"CosmoAI has been rigorously validated with a 77-test automated suite covering memory persistence, worker thread termination, isolated deduplication, crash recovery, and security benchmarks with a 100% pass rate."*

### Slide 12: Conclusion, Future Roadmap & Q&A
- **Summary:** CosmoAI delivers an enterprise-ready, cost-effective, and fail-safe conversational AI platform.
- **Future Roadmap:**
  - Voice-to-Voice WebSocket streaming.
  - Hybrid dense-sparse vector database integration (Pinecone/Milvus).
  - Multi-agent collaboration workflows.
- **Open for Questions (Q&A)**
- **Speaker Note:** *"Thank you for your time. I'd now like to open the floor to any questions or proceed with a live demonstration."*

---

# PART 7: Local Setup & Demo Execution Guide

### Prerequisites
- Node.js (v18+ or v20+)
- NPM
- API Keys: `GEMINI_API_KEY`, `GROQ_API_KEY` (optional), `TAVILY_API_KEY` (optional), `MONGODB_URI` (optional)

### Step 1: Install Dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### Step 2: Configure Environment Variables (`.env`)
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=cosmoai_super_secret_jwt_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
MONGODB_URI=your_mongodb_atlas_uri_optional
```

### Step 3: Run the Application
```bash
# Start Backend Server (Port 5000)
npm run dev

# In a separate terminal, start Frontend Client (Port 5173)
npm run dev:client
```

### Step 4: Run the Automated 77-Test QA Suite
```bash
npm test
```
