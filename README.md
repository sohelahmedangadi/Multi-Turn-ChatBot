# Multi-Turn Conversational AI Capstone (CosmoAI)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LangChain.js](https://img.shields.io/badge/LangChain.js-Core_%26_OpenAI-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-Fast_Inference-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![Tests](https://img.shields.io/badge/Tests-47%2F47_Passing-brightgreen)](file:///d:/multi-turn-conversational-ai-capstone/server/test-suite.js)
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
|  - Secondary: Groq Qwen / Compound / GPT-OSS (`groq-sdk`)                          |
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
  - Pre-seeded architectural and domain concepts retrieved via semantic vector search to augment model prompts.

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

### 3. LangChain RAG & Multimodal Document Analysis Engine
- **Universal Multi-Format Ingestion (`server/services/fileParser.js`)**:
  - Ingests **PDFs**, **Images** (`.png`, `.jpg`, `.jpeg`, `.webp`), **Plaintext/Markdown** (`.txt`, `.md`), **Structured Data** (`.csv`, `.json`), and **Source Code** (`.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.rs`, `.go`, `.html`, `.css`, `.sql`).
- **Gemini Multimodal OCR Fallback**:
  - Automatically invokes **Gemini 2.5 Flash Vision** to transcribe rasterized PowerPoint slides, scanned PDFs, diagrams, and visual charts.
- **LangChain Recursive Text Chunking (`server/services/ragService.js`)**:
  - Leverages `@langchain/textsplitters` (`RecursiveCharacterTextSplitter`) with 800-character chunk sizing and 150-character overlap.
- **Strict Anti-Hallucination Guardrail (`server/services/contextManager.js`)**:
  - If a file has empty or unreadable content, the system strictly forbids the LLM from guessing based on the filename alone.
  - Enforces strict factual grounding on actual extracted excerpts.

---

### 3. Zero-Cost Ambiguity Detection (`server/services/ambiguityDetector.js`)
- Intercepts vague, pronoun-heavy queries (e.g., *"What about that?"*, *"Explain it"*) when conversational context is empty.
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
- **Prompt Injection Defense (`server/middleware/sanitizer.js`)**: Neutralizes adversarial instruction overrides.
- **Rate Limiting (`express-rate-limit`)**: 30 requests/minute ceiling per IP.
- **Authentication**: Salted Bcrypt password hashing + signed JSON Web Tokens (JWT).

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

# Optional: MongoDB Atlas (falls back to in-memory store if omitted)
MONGO_URI=
```

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

Execute the complete **44-point test suite**:

```bash
npm test
```

### Test Output (44/44 Tests Passing):

```text
======================================================
🧪 RUNNING LANGCHAIN & 3-TIER MEMORY CAPSTONE TEST SUITE
======================================================

📦 Testing Ambiguity Detector:
  ✅ PASS: Detects empty string as ambiguous
  ✅ PASS: Flags "What about that?" as ambiguous when context is empty
  ✅ PASS: Returns targeted clarifying question
  ✅ PASS: Passes vague question to LLM if prior context has sufficient detail
  ✅ PASS: Recognizes specific non-ambiguous queries without needing clarification

🦜 Testing LangChain Fact Extractor:
  ✅ PASS: LangChain Extractor: Identifies user name "Sohail"
  ✅ PASS: LangChain Extractor: Identifies project name "CosmoAI"
  ✅ PASS: LangChain Extractor: Identifies tech stack "React 19"
  ✅ PASS: User A has exactly 3 structured long-term memories persisted
  ✅ PASS: Conflict Resolution: Updates project_name in place without duplicate memory
  ✅ PASS: Project memory value updated to "ApexBot"
  ✅ PASS: Explicit Forget: Successfully deleted tech_stack memory upon user request
  ✅ PASS: Cross-User Isolation: User B cannot access User A memories
  ✅ PASS: Semantic Search: Retrieves relevant memory for User A
  ✅ PASS: Retrieved memory contains correct project "ApexBot"
  ✅ PASS: Context Assembler embeds retrieved Tier 2 memories into context
  ✅ PASS: Context section contains both user name and project name for LLM grounding
  ✅ PASS: Full Past History Access: Retrieves complete past conversation sessions with messages
  ✅ PASS: Context Assembler embeds full past conversation history catalog into LLM context prompt
  ✅ PASS: Tier 3 Knowledge Base: Retrieves domain architecture chunk
  ✅ PASS: Tier 3 chunk matches Ambiguity Heuristic domain topic

📦 Testing Context Truncation & Token Budgeting:
  ✅ PASS: Estimates tokens correctly (text.length / 4)
  ✅ PASS: Truncation strictly enforces token budget limit
  ✅ PASS: Drops older turns in paired fashion to stay within budget

📦 Testing Auth & Security:
  ✅ PASS: Hashes password securely with bcrypt salt
  ✅ PASS: Verifies valid password against bcrypt hash
  ✅ PASS: Rejects invalid password attempt
  ✅ PASS: Generates valid 3-part signed JWT token

📦 Testing Evaluation Suite & Coherence Engine:
  ✅ PASS: Contains 5 comprehensive standard benchmark scenarios
  ✅ PASS: Computes high coherence score (0.93) for context-aligned responses

📦 Testing File Parser & LangChain RAG Document Pipeline:
  ✅ PASS: File Parser: Detects text file type accurately
  ✅ PASS: File Parser: Computes word count correctly
  ✅ PASS: File Parser: Extracts document body text cleanly
  ✅ PASS: LangChain RAG: Chunks document using RecursiveCharacterTextSplitter
  ✅ PASS: LangChain RAG: Retrieves relevant chunk matching query keywords
  ✅ PASS: LangChain RAG: Top retrieved chunk contains relevant ambiguity filter details
  ✅ PASS: Context Assembler: Successfully retrieves RAG document chunks for attached file
  ✅ PASS: Context Assembler: Embeds [UPLOADED DOCUMENT CONTEXT (RAG)] section into LLM context prompt
  ✅ PASS: Anti-Hallucination Guardrail: Injects strict extraction failure directive when document text is empty

🌐 Testing Web Search Grounding & Tavily Fallback:
  ✅ PASS: Gemini Grounding: Extracts webSearchQueries and citation sources from groundingMetadata
  ✅ PASS: Gemini Grounding: Correctly flags ungrounded responses as usedWebSearch = false
  ✅ PASS: Tavily Search: Gracefully handles missing API key without throwing exceptions
  ✅ PASS: Tavily Search: formatTavilyResultsForContext formats direct answers, summaries, and URLs for context injection
  ✅ PASS: Groq Regex Extractor: Accurately parses search queries from bracket tags, markdown blocks, and function calls
  ✅ PASS: Identity Query Pre-Classifier: Accurately flags biographical/contestant/real-name queries for mandatory search while passing math queries
  ✅ PASS: Thin Results Formatter: Injects strict anti-hallucination directive when search yields sparse data
  ✅ PASS: Unverified Claim Guard: Flags ungrounded real-name assertions made without search citations

======================================================
📊 TEST RESULTS: 47 Passed, 0 Failed
======================================================
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
| `POST` | `/api/files/upload` | Upload & index PDF, Image, CSV, JSON, Markdown, or Code file |
| `GET` | `/api/files/:fileId` | Retrieve indexed document metadata |
| `DELETE` | `/api/files/:fileId` | Remove indexed document from memory |
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
