# Project Features Specification (features.md)

Comprehensive technical breakdown of all architectural components, services, and user features implemented in the **Multi-Turn Conversational AI Capstone**.

---

## 1. 3-Tier Conversational Context & Memory Architecture

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

### Tier 1: Sliding-Window Dialogue History (server/services/contextManager.js)
- **Session-Scoped Message History**: Preserves exact multi-turn exchanges within an active chat thread.
- **Token-Aware Truncation (truncateHistoryToTokenBudget)**:
  - Dynamically calculates approximate tokens (Math.ceil(chars / 4)).
  - When history exceeds budget (default 1,800 tokens), it drops oldest turns in atomic **(user, assistant)** pairs to ensure the conversational turn sequence remains intact and contextually sound.
- **Role Normalization**: Normalizes dialogue roles strictly to 'user' and 'assistant'.

### Tier 2: LangChain Long-Term User Memory (server/services/langchainMemory.js & server/services/memoryManager.js)
- **Automated Entity & Fact Extraction**:
  - Leverages LangChain (@langchain/core, @langchain/openai, @langchain/google-genai) to parse incoming user messages for durable personal facts (user name, project titles, tech stacks, preferences, and roles).
  - Features a **resilient rule-based fallback parser** ensuring reliable zero-downtime memory extraction even when external LLM endpoints face rate limits.
- **In-Place Conflict Resolution**: Detects updates (e.g., *"I renamed my project from OmniTurn to ApexBot"*) and updates existing records in place rather than creating redundant duplicates.
- **Explicit Forgetting**: Processes deletion directives (e.g., *"Forget my tech stack"*, *"Delete my location"*) and removes corresponding stored facts immediately.
- **Vector Cosine Similarity Retrieval (vectorizeText / calculateVectorCosineSimilarity)**: Generates term-frequency vectors for queries and memories, selecting top contextually relevant memories within a dedicated token budget (default 300 tokens).
- **Cross-Session Full Conversation History Access**:
  - Provides full access to the user's past conversation sessions and message transcripts, bounded by a 1,200-token catalog to prevent context blowup or rate limits.
- **Strict Cross-User Isolation**: Memory queries and writes are strictly scoped to the active userId, preventing cross-tenant data leakage.

### Tier 3: Domain Knowledge Base RAG Chunks (server/db/store.js)
- **Seeded Knowledge Repository**: Pre-populates architectural documents, ambiguity engine specs, LLM fallback documentation, and evaluation guidelines.
- **Context Augmentation**: Matches query semantics against domain knowledge chunks (budget default 500 tokens) to inject authoritative project domain grounding.

---

## 2. Zero-Cost Heuristic Ambiguity Detection (server/services/ambiguityDetector.js)

- **Local Rule-Based Pre-check**: Analyzes incoming messages locally before dispatching requests to external LLM APIs.
- **Pronoun & Vague Reference Detection**: Identifies underspecified queries lacking referents (e.g., *"what about that?"*, *"tell me more"*, *"why?"*, *"explain it"*) when no prior dialogue context exists.
- **Instant Clarification Response**: Immediately returns a targeted clarifying question:
  > *"Could you clarify what "it/that" refers to so I can provide an accurate answer?"*
  - **Latency**: Sub-millisecond execution.
  - **Cost**: **0 API tokens and 0 LLM costs**.
- **Contextual Pass-Through**: If previous dialogue turns already establish the entity (e.g., discussing *PostgreSQL JSONB* in turn 1, then asking *"how to index it?"* in turn 2), the query passes straight to the LLM.

---

## 3. Dual-Engine LLM Inference & Resilient Fallback (server/services/llmProvider.js)

- **Primary Engine**: Google Gemini API via official @google/genai SDK.
  - Supported Models: gemini-2.5-flash (default), gemini-flash-latest, gemini-3.7-flash, gemini-2.5-pro.
- **Secondary / Fallback Engine**: Groq SDK (groq-sdk) with ultra-fast inference.
  - Supported Models: qwen/qwen3.8-27b, groq/compound, openai/gpt-oss-120b, openai/gpt-oss-20b, groq/compound-mini, qwen/qwen3.6-27b, allam-2-7b.
- **Payload Validation & Sanitization**: Strips empty messages and guarantees role: 'system' has non-empty content to prevent upstream 400 Bad Request errors.
- **Multi-Model Failover Chain**: Automatically catches upstream rate limits (429 Too Many Requests), model deprecation errors, or timeout spikes, cycling through candidate fallback models seamlessly without dropping the user's conversation.
- **Real-Time SSE Streaming (generateStreamResponse)**: Server-Sent Events stream tokens incrementally to the client for responsive word-by-word visual output with abort controller support.
- **System Prompt Isolation**: Custom instructions and persona guidelines are delivered strictly through the model's dedicated systemInstruction or system parameter.

---

## 4. Evaluation Suite & Semantic Coherence Engine (server/services/evaluationSuite.js)

- **Semantic Coherence Metric (calculateCoherenceScore)**:
  - Analyzes entity and keyword overlap across the history, user query, and assistant response.
  - Outputs a normalized coherence score from 0.0 to 1.0.
- **5 Standard Automated Multi-Turn Benchmarks**:
  1. **Context Memory & Entity Retention**: Validates recall of user preferences across turns.
  2. **Ambiguity Clarification Trigger**: Verifies heuristic interception of vague queries.
  3. **Multi-Step Math & State Modification**: Assesses accurate state tracking across sequential modifications.
  4. **Negative Constraint Adherence**: Confirms strict adherence to negative constraints (e.g., forbidden words).
  5. **Prompt Injection Safety**: Tests resistance against jailbreak attempts and system prompt extraction.
- **User Rubric Quality Scoring**: Interactive 1–5 scale modal for scoring *Relevance*, *Coherence*, and *Helpfulness* with optional feedback notes.
- **Evaluation Dashboard & Analytics (/api/evaluate/summary)**: Aggregates rubric metrics, average response latencies, and benchmark pass rates.

---

## 5. Security & Defensive Engineering

- **Prompt Injection Neutralization (server/middleware/sanitizer.js)**: Detects and sanitizes adversarial prefixes (e.g., *"ignore previous instructions"*, *"system override"*, *"DAN mode"*).
- **IP Rate Limiting (express-rate-limit)**: Enforces a strict 30 requests/minute ceiling per IP to protect against denial-of-service and API quota exhaustion.
- **Input Sanitization**: Enforces maximum message length (2,000 characters), strips null bytes, and sanitizes malformed Unicode control characters.
- **Password Security**: Salted cryptographic password hashing with bcryptjs.
- **Stateless Authentication**: Signed JSON Web Tokens (JWT) with 7-day expiration.

---

## 6. LangChain RAG Document Ingestion & Analysis Engine (server/services/fileParser.js & server/services/ragService.js)

- **Multi-Format Document Extractor (parseFileContent)**:
  - **PDF Documents**: Direct binary extraction with page metadata parsing via `pdf-parse`.
  - **Text & Markdown**: Full plaintext parsing for `.txt`, `.md`, and `.markdown`.
  - **Structured Datasets**: Parsing of tabular data (`.csv`) and nested object structures (`.json`, `.yaml`, `.yml`).
  - **Source Code Files**: Full multi-language syntax extraction (`.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.rs`, `.go`, `.html`, `.css`, `.sql`).
- **LangChain Recursive Text Chunking**:
  - Leverages `@langchain/textsplitters` (`RecursiveCharacterTextSplitter`) with an 800-character chunk size and 150-character overlap window.
- **Semantic Keyword & Proximity Retrieval (retrieveRelevantChunks)**:
  - Automatically scores and ranks document chunks based on query keyword frequency and co-occurrence proximity.
  - Dynamically retrieves top-ranking excerpts and injects them into the `[UPLOADED DOCUMENT CONTEXT (RAG)]` prompt section.
- **Tactile UI Attachment Dock & Drag-and-Drop**:
  - Drag-and-drop document upload with active attachment chip preview, upload progress indicators, and instant removal button.

