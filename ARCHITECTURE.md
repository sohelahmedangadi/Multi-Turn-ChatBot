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
| LangChain RAG & Multimodal  |                             |  * RAG Document Chunks (PDF/Img)  |
| - RecursiveCharacterSplitter+---------------------------->|  * Strict Anti-Hallucination Directives
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
- **Engine**: `groq-sdk` with `qwen/qwen3.8-27b`, `groq/compound`, or `openai/gpt-oss-120b`.
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

## 4. Multimodal RAG Document Pipeline (`fileParser.js` & `ragService.js`)

- **Formats**: PDFs, Images (`.png`, `.jpg`, `.jpeg`, `.webp`), CSV, JSON, Markdown, and 10+ programming languages.
- **Multimodal OCR**: Automatically invokes **Gemini 2.5 Flash Vision** to transcribe rasterized PowerPoint PDFs and diagrams when text extraction yields `< 80` characters.
- **Chunking**: LangChain `RecursiveCharacterTextSplitter` (800-character chunks, 150-character overlap).
- **Anti-Hallucination Guardrail**: Intercepts unreadable or empty files and forbids the LLM from guessing content based on the filename alone.

---

## 5. Security & Circuit Breaker Architecture

- **Circuit Breaker**: On encountering HTTP 429 quota exhaustion on Gemini, a **60-second cooldown** trips immediately, routing subsequent turns directly to Groq with zero delay.
- **Prompt Injection Defense**: Sanitizes adversarial override patterns (`"ignore previous instructions"`, `"DAN mode"`).
- **Rate Limiting**: 30 requests/minute per IP address.
- **Authentication**: Salted Bcrypt password hashing + signed JSON Web Tokens (JWT).
