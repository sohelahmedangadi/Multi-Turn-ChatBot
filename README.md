# Multi-Turn Conversational AI Capstone (CosmoAI)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LangChain.js](https://img.shields.io/badge/LangChain.js-Core_%26_OpenAI-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-Fast_Inference-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![Tests](https://img.shields.io/badge/Tests-30%2F30_Passing-brightgreen)](file:///d:/multi-turn-conversational-ai-capstone/test-suite.js)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade, full-stack multi-turn conversational AI system featuring **LangChain & LLM-Powered 3-Tier Conversational Memory**, **Cross-Session Full Conversation History Access**, **zero-cost heuristic ambiguity detection**, **dual-engine LLM resilience (Google Gemini + Groq)** with real-time Server-Sent Events (SSE) streaming, and an integrated **evaluation & benchmark analytics suite**.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Core Capabilities](#core-capabilities)
  - [1. 3-Tier Memory Context Engine](#1-3-tier-memory-context-engine)
  - [2. Zero-Cost Ambiguity Detection](#2-zero-cost-ambiguity-detection)
  - [3. Dual-Engine LLM Resilience](#3-dual-engine-llm-resilience)
  - [4. Evaluation Suite & Benchmark Analytics](#4-evaluation-suite--benchmark-analytics)
  - [5. Security & Defensive Engineering](#5-security--defensive-engineering)
- [Technology Stack](#technology-stack)
- [Quick Start Guide](#quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Environment Configuration](#environment-configuration)
  - [Running the App](#running-the-app)
- [Automated Verification & Testing](#automated-verification--testing)
- [REST API Reference](#rest-api-reference)
- [Project File Structure](#project-file-structure)
- [License & Credits](#license--credits)

---

## System Architecture

```text
                               +-----------------------------+
                               |     User Interface (SPA)    |
                               | React 19 + Tailwind v4 + SSE|
                               +--------------+--------------+
                                              |
                                              | HTTP / SSE Stream
                                              v
+------------------------------------------------------------------------------+
|                   Express API Gateway & Security Layer                       |
|  - Rate Limiter (30 req/min/IP)  - Prompt Injection Defense & Sanitizer     |
|  - JWT Authentication Middleware - MongoDB Atlas / In-Memory Session Store   |
+--------------------------------------+---------------------------------------+
                                       |
                                       v
+-----------------------------+                 +--------------------------------+
|  Zero-Cost Ambiguity Engine |                 |  3-Tier Memory Context Manager |
|  - Rule-based regex parser  |                 |                                |
|  - Vague pronoun detector   |                 |  * Tier 1: Sliding Turns (1.8k)|
|  - 0 token, 0ms LLM bypass  |                 |  * Tier 2: LangChain Long-Term |
+-----------------------------+                 |    Memory (Vector Search)      |
                                                |  * Tier 2.5: Cross-Session     |
                                                |    Past Conversation Catalog   |
                                                |  * Tier 3: RAG Knowledge Base  |
                                                +----------------+---------------+
                                                                 |
                                                                 v
+------------------------------------------------------------------------------+
|                    Resilient LLM Inference Engine & Failover                 |
|  - Primary: Google Gemini 2.5 Flash (`@google/genai`)                        |
|  - Secondary: Groq Qwen / Compound / GPT-OSS (`groq-sdk`)                    |
|  - Real-time Server-Sent Events (SSE) Streaming                              |
+---------------------------------------+--------------------------------------+
                                        |
                                        v
+------------------------------------------------------------------------------+
|                 Resilient Dual Datastore (MongoDB Atlas / In-Memory)         |
|  - Users  - Chat Sessions  - Message History  - Long-Term Memories  - Rubric |
+------------------------------------------------------------------------------+
```

---

## Core Capabilities

### 1. 3-Tier Memory Context Engine
The system implements a hierarchical context composer to avoid sending raw chat histories that exhaust token budgets:

- **Tier 1: Sliding-Window History (`server/services/contextManager.js`)**
  - Maintains dialogue context across active turns.
  - Implements **token-aware truncation**: if token budget exceeds capacity (default 1,800 tokens), oldest turns are dropped cleanly in atomic `(user, assistant)` pairs to preserve coherence.
- **Tier 2: LangChain Long-Term User Memory Store (`server/services/langchainMemory.js`)**
  - Automatically extracts structured facts (name, project details, tech stacks, preferences, and roles) using LangChain prompt templates and LLM extractors.
  - **In-Place Conflict Resolution**: Updates existing keys (e.g. project renaming) without creating duplicates.
  - **Explicit Forget Handling**: Instantly deletes memory keys upon directives like `"Forget my tech stack"`.
  - **Vector Cosine Similarity Retrieval**: Matches queries against stored facts with term-frequency vector search.
  - **Strict Cross-User Isolation**: Scoped strictly by `userId` to ensure zero cross-tenant leakage.
- **Tier 2.5: Cross-Session Full Conversation History Access**
  - Provides full access to the user's past conversation sessions and message transcripts, bounded by a 1,200-token catalog to prevent context blowup or rate limits.
- **Tier 3: Domain Knowledge Base RAG Chunks (`server/db/store.js`)**
  - Pre-seeded architectural and domain concepts retrieved via semantic vector search to augment model prompts.

### 2. Zero-Cost Ambiguity Detection
- Runs a fast local rule-based heuristic layer (`server/services/ambiguityDetector.js`) before calling external LLM APIs.
- Queries that are short, pronoun-heavy, and lack entities (e.g., *"what about that?"*, *"tell me more"*) when no prior context exists immediately trigger a targeted clarifying question.
- **Zero API token cost and zero LLM latency overhead**.
- Seamlessly passes vague queries to the LLM when preceding turns provide sufficient contextual grounding.

### 3. Dual-Engine LLM Resilience
- **Primary Engine**: Google Gemini API via official `@google/genai` SDK (`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-3.7-flash`, `gemini-2.5-pro`).
- **Secondary / Fallback Engine**: Groq SDK (`groq-sdk`) with ultra-fast inference (`qwen/qwen3.8-27b`, `groq/compound`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `groq/compound-mini`).
- **Automatic Multi-Model Failover**: Automatically catches upstream rate limits (`429 Too Many Requests`), model deprecation errors, or timeout spikes, cycling through candidate fallback models seamlessly.
- **Real-Time SSE Streaming**: Server-Sent Events stream tokens incrementally to the client for responsive word-by-word visual output with abort controller support.

### 4. Evaluation Suite & Benchmark Analytics
- **Semantic Coherence Engine (`server/services/evaluationSuite.js`)**: Calculates entity and keyword overlap across history, query, and assistant response (score 0.0 to 1.0).
- **5 Automated Multi-Turn Benchmark Scenarios**:
  1. *Context Memory & Entity Retention*
  2. *Ambiguity Clarification Trigger*
  3. *Multi-Step Math & State Modification*
  4. *Negative Constraint Adherence*
  5. *Prompt Injection Safety*
- **User Rubric Scoring**: Interactive 1–5 scale modal for scoring *Relevance*, *Coherence*, and *Helpfulness* with optional feedback notes.
- **Evaluation Dashboard (`/api/evaluate/summary`)**: Aggregates rubric metrics, average response latencies, and benchmark pass rates.

### 5. Security & Defensive Engineering
- **Prompt Injection Defense (`server/middleware/sanitizer.js`)**: Strips adversarial prefixes and jailbreak patterns.
- **IP Rate Limiting**: 30 requests/minute per IP via `express-rate-limit`.
- **System Prompt Isolation**: Custom instructions and persona guidelines are delivered strictly through the model's dedicated `systemInstruction` or `system` channel.
- **Cryptographic Security**: Salted bcrypt password hashing and signed JWT tokens with 7-day expiration.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19 (JSX), Vite 6, Tailwind CSS v4, Lucide React, Motion, React Markdown + Remark GFM |
| **Backend** | Node.js (ES Modules), Express.js 4, Server-Sent Events (SSE) |
| **Memory & Orchestration** | LangChain.js (`@langchain/core`, `@langchain/openai`, `@langchain/google-genai`), Custom Term-Frequency Vector Cosine Search |
| **AI / LLM Engines** | Google Gemini API (`@google/genai`), Groq SDK (`groq-sdk`) |
| **Database** | MongoDB Atlas (via Mongoose 9) with In-Memory fallback store |
| **Authentication & Security** | JWT (`jsonwebtoken`), bcryptjs, express-rate-limit, input sanitization |

---

## Quick Start Guide

### Prerequisites
- Node.js v18 or higher
- npm, pnpm, or yarn

### Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/multi-turn-conversational-ai-capstone.git
cd multi-turn-conversational-ai-capstone

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Windows PowerShell:
Copy-Item .env.example .env
# Linux / macOS:
cp .env.example .env
```

### Environment Configuration

Configure your `.env` file (refer to `.env.example`):

```env
# Google Gemini API Key (Required for primary engine)
GEMINI_API_KEY="your_gemini_api_key_here"

# Groq API Key (Required for high-speed fallback engine)
GROQ_API_KEY="your_groq_api_key_here"

# MongoDB Connection String (Optional: falls back to resilient in-memory store if omitted)
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/chatbot?retryWrites=true&w=majority"

# JWT Secret for authentication tokens
JWT_SECRET="your_jwt_secret_key_here_min_32_chars"

# Server Port
PORT=3000
APP_URL="http://localhost:3000"
```

### Running the App

```bash
# Development Mode (Vite Frontend + Express Backend on Port 3000)
npm run dev

# Production Build & Run
npm run build
npm start
```
Open `http://localhost:3000` in your browser.

---

## Automated Verification & Testing

Run the automated test suite covering all 3-tier memory lifecycles, LangChain fact extraction, ambiguity detection, auth, and coherence scoring:

```bash
npm test
```

### Test Suite Execution Output (30/30 Tests Passing)

```text
======================================================
RUNNING LANGCHAIN & 3-TIER MEMORY CAPSTONE TEST SUITE
======================================================

Testing Ambiguity Detector:
  PASS: Detects empty string as ambiguous
  PASS: Flags "What about that?" as ambiguous when context is empty
  PASS: Returns targeted clarifying question
  PASS: Passes vague question to LLM if prior context has sufficient detail
  PASS: Recognizes specific non-ambiguous queries without needing clarification

Testing LangChain Fact Extractor:
  PASS: LangChain Extractor: Identifies user name "Sohail"
  PASS: LangChain Extractor: Identifies project name "CosmoAI"
  PASS: LangChain Extractor: Identifies tech stack "React 19"
  PASS: User A has exactly 3 structured long-term memories persisted
  PASS: Conflict Resolution: Updates project_name in place without duplicate memory
  PASS: Project memory value updated to "ApexBot"
  PASS: Explicit Forget: Successfully deleted tech_stack memory upon user request
  PASS: Cross-User Isolation: User B cannot access User A memories
  PASS: Semantic Search: Retrieves relevant memory for User A
  PASS: Retrieved memory contains correct project "ApexBot"
  PASS: Context Assembler embeds retrieved Tier 2 memories into context
  PASS: Context section contains both user name and project name for LLM grounding
  PASS: Full Past History Access: Retrieves complete past conversation sessions with messages
  PASS: Context Assembler embeds full past conversation history catalog into LLM context prompt
  PASS: Tier 3 Knowledge Base: Retrieves domain architecture chunk
  PASS: Tier 3 chunk matches Ambiguity Heuristic domain topic

Testing Context Truncation & Token Budgeting:
  PASS: Estimates tokens correctly (text.length / 4)
  PASS: Truncation strictly enforces token budget limit
  PASS: Drops older turns in paired fashion to stay within budget

Testing Auth & Security:
  PASS: Hashes password securely with bcrypt salt
  PASS: Verifies valid password against bcrypt hash
  PASS: Rejects invalid password attempt
  PASS: Generates valid 3-part signed JWT token

Testing Evaluation Suite & Coherence Engine:
  PASS: Contains 5 comprehensive standard benchmark scenarios
  PASS: Computes high coherence score (0.93) for context-aligned responses

======================================================
TEST RESULTS: 30 Passed, 0 Failed
======================================================
```

---

## REST API Reference

All endpoints are mounted at both `/api/...` and root `/...` aliases for convenience.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | System health, active LLM provider, and DB connection state |
| `POST` | `/api/auth/register` | Register a new user account with hashed password |
| `POST` | `/api/auth/login` | Log in and receive signed JWT token |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile |
| `POST` | `/api/session` | Create a new chat session |
| `GET` | `/api/sessions` | List all sessions for the active user |
| `DELETE` | `/api/session/:sessionId` | Delete a specific chat session |
| `GET` | `/api/history/:sessionId` | Retrieve full message turn history for a session |
| `POST` | `/api/chat` | Send a multi-turn message (supports Server-Sent Events with `stream: true`) |
| `GET` | `/api/memories` | Retrieve Tier 2 structured memories for current user |
| `POST` | `/api/memories` | Manually insert a structured memory record |
| `PUT` | `/api/memories/:id` | Update an existing user memory record |
| `DELETE` | `/api/memories/:id` | Delete a user memory record |
| `GET` | `/api/knowledge` | Fetch seeded Tier 3 domain knowledge base chunks |
| `GET` | `/api/evaluate/benchmarks` | List the 5 standard benchmark scenarios |
| `POST` | `/api/evaluate/run-benchmark`| Execute a single automated benchmark test |
| `POST` | `/api/evaluate/rubric` | Submit a 1–5 quality rubric rating |
| `GET` | `/api/evaluate/summary` | Retrieve aggregated evaluation statistics and rubric averages |

---

## Project File Structure

```text
multi-turn-conversational-ai-capstone/
├── server.js                          # Express server, middleware, routes & SSE streaming
├── test-suite.js                      # Automated 30-test unit & integration validation suite
├── package.json                       # Project scripts and dependencies
├── vite.config.js                     # Vite configuration & proxy setup
├── .env.example                       # Environment variables template
├── README.md                          # Main project documentation
├── features.md                        # Comprehensive architectural specifications
├── QA_TEST_RESULTS.md                 # 48-test QA regression and sign-off report
├── server/
│   ├── db/
│   │   └── store.js                   # Mongoose schemas & in-memory dual database layer
│   ├── middleware/
│   │   ├── auth.js                    # JWT verification & Bcrypt password hashing
│   │   └── sanitizer.js               # Prompt injection defense & input sanitization
│   └── services/
│       ├── ambiguityDetector.js       # Zero-cost rule-based heuristic ambiguity engine
│       ├── contextManager.js          # 3-tier context composer & token-budgeted truncation
│       ├── evaluationSuite.js         # Semantic coherence metric & 5 benchmark scenarios
│       ├── langchainMemory.js         # LangChain & LLM structured fact extraction
│       ├── llmProvider.js             # Gemini + Groq dual-engine streaming & failover
│       └── memoryManager.js           # Tier 2 vector search, conflict resolution & forget logic
└── src/
    ├── App.jsx                        # React root component & state management
    ├── main.jsx                       # React DOM application entrypoint
    ├── index.css                      # Tailwind CSS v4 styling & animations
    └── components/
        ├── AuthModal.jsx              # Sign-up and login modal
        ├── BenchmarkModal.jsx         # Automated benchmark execution dashboard
        ├── ChatWindow.jsx             # Main conversation view with streaming & badges
        ├── MemoryModal.jsx            # 3-tier memory viewer with inline fact editing
        ├── MessageItem.jsx            # Chat bubble component with markdown rendering
        ├── RubricFeedbackModal.jsx    # 1-5 scale quality evaluation modal
        ├── Sidebar.jsx                # Session history navigation & provider controls
        └── SystemPromptModal.jsx      # Persona and system instruction editor
```

---

## License & Credits

Released under the **MIT License**. Built for the **Multi-Turn Conversational AI Capstone Project**.
