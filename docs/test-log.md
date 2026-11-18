# Complete Automated Verification Test Log

**Generated:** 2026-11-18T16:44:38.358Z  
**Source:** `test-results.json` (emitted by `server/test-suite.js`)  
**Total Assertions:** 558  
**Total Discrete Test Cases:** 469  
**Passed Assertions:** 558 (100%)  
**Failed Assertions:** 0  

## Metric Definitions

- **Test Case**: A discrete verification scenario, specification unit, or requirement target. In standard non-parameterized tests, 1 test case evaluates 1 assertion. In parameterized tests (e.g., prompt injection benchmarks, monotonic sequence checks, compound index lookups), 1 test case verifies multiple inputs or assertions in a single scenario.
- **Assertion**: An individual atomic condition verification (`assert(condition, message)`) evaluated at runtime. Every single assertion is itemized below.

---

## Test Execution Log by Category

### Ambiguity Detection Heuristics & Fast Interception

*Category Summary: 17 Test Cases | 17 Assertions | 17 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **001** | `PASS` ✅ | Detects empty string as ambiguous | Detects empty string as ambiguous |
| **002** | `PASS` ✅ | Flags "What about that?" as ambiguous when context is empty | Flags "What about that?" as ambiguous when context is empty |
| **003** | `PASS` ✅ | Returns targeted clarifying question | Returns targeted clarifying question |
| **004** | `PASS` ✅ | Passes vague question to LLM if prior context has sufficient detail | Passes vague question to LLM if prior context has sufficient detail |
| **005** | `PASS` ✅ | Recognizes specific non-ambiguous queries without needing clarification | Recognizes specific non-ambiguous queries without needing clarification |
| **006** | `PASS` ✅ | Ambiguity Detector: "Is it raining?" must NOT be intercepted as ambiguous | Ambiguity Detector: "Is it raining?" must NOT be intercepted as ambiguous |
| **007** | `PASS` ✅ | Ambiguity Detector: "Explain this: <code>" must NOT be intercepted as ambiguous | Ambiguity Detector: "Explain this: <code>" must NOT be intercepted as ambiguous |
| **008** | `PASS` ✅ | Ambiguity Detector: "Explain this: <inline code>" must NOT be intercepted as ambiguous | Ambiguity Detector: "Explain this: <inline code>" must NOT be intercepted as ambiguous |
| **009** | `PASS` ✅ | Ambiguity Detector: "Fix it" without context or file must be intercepted as ambiguous | Ambiguity Detector: "Fix it" without context or file must be intercepted as ambiguous |
| **010** | `PASS` ✅ | Ambiguity Detector: "Summarize this" without context or file must be intercepted as ambiguous | Ambiguity Detector: "Summarize this" without context or file must be intercepted as ambiguous |
| **011** | `PASS` ✅ | Ambiguity Detector: "Fix it" with active file must NOT be intercepted as ambiguous | Ambiguity Detector: "Fix it" with active file must NOT be intercepted as ambiguous |
| **012** | `PASS` ✅ | Ambiguity Detector: "Summarize this" with active file must NOT be intercepted as ambiguous | Ambiguity Detector: "Summarize this" with active file must NOT be intercepted as ambiguous |
| **013** | `PASS` ✅ | Ambiguity Detector: "Explain it" with active media must NOT be intercepted as ambiguous | Ambiguity Detector: "Explain it" with active media must NOT be intercepted as ambiguous |
| **014** | `PASS` ✅ | First message after upload: Resolves active file before ambiguity check | First message after upload: Resolves active file before ambiguity check |
| **015** | `PASS` ✅ | First message after upload: "Summarize this" with resolved session file must NOT be intercepted | First message after upload: "Summarize this" with resolved session file must NOT be intercepted |
| **016** | `PASS` ✅ | Ambiguity Detector: Intercepts vague query before any LLM execution | Ambiguity Detector: Intercepts vague query before any LLM execution |
| **017** | `PASS` ✅ | Zero-Cost Guardrail: Intercepted turn skips fact extraction preserving 0 token cost | Zero-Cost Guardrail: Intercepted turn skips fact extraction preserving 0 token cost |

### LangChain Fact Extraction & 3-Tier Memory Context

*Category Summary: 16 Test Cases | 16 Assertions | 16 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **018** | `PASS` ✅ | LangChain Extractor: Identifies user name "Sohail" | LangChain Extractor: Identifies user name "Sohail" |
| **019** | `PASS` ✅ | LangChain Extractor: Identifies project name "CosmoAI" | LangChain Extractor: Identifies project name "CosmoAI" |
| **020** | `PASS` ✅ | LangChain Extractor: Identifies tech stack "React 19" | LangChain Extractor: Identifies tech stack "React 19" |
| **021** | `PASS` ✅ | User A has exactly 3 structured long-term memories persisted | User A has exactly 3 structured long-term memories persisted |
| **022** | `PASS` ✅ | Conflict Resolution: Updates project_name in place without creating duplicate memory | Conflict Resolution: Updates project_name in place without creating duplicate memory |
| **023** | `PASS` ✅ | Project memory value updated to "ApexBot" | Project memory value updated to "ApexBot" |
| **024** | `PASS` ✅ | Explicit Forget: Successfully deleted tech_stack memory upon user request | Explicit Forget: Successfully deleted tech_stack memory upon user request |
| **025** | `PASS` ✅ | Cross-User Isolation: User B cannot access User A memories | Cross-User Isolation: User B cannot access User A memories |
| **026** | `PASS` ✅ | Semantic Search: Retrieves relevant memory for User A | Semantic Search: Retrieves relevant memory for User A |
| **027** | `PASS` ✅ | Retrieved memory contains correct project "ApexBot" | Retrieved memory contains correct project "ApexBot" |
| **028** | `PASS` ✅ | Context Assembler embeds retrieved Tier 2 memories into context | Context Assembler embeds retrieved Tier 2 memories into context |
| **029** | `PASS` ✅ | Context section contains both user name and project name for LLM grounding | Context section contains both user name and project name for LLM grounding |
| **030** | `PASS` ✅ | Full Past History Access: Retrieves complete past conversation sessions with messages | Full Past History Access: Retrieves complete past conversation sessions with messages |
| **031** | `PASS` ✅ | Context Assembler embeds full past conversation history catalog into LLM context prompt | Context Assembler embeds full past conversation history catalog into LLM context prompt |
| **032** | `PASS` ✅ | Tier 3 Knowledge Base: Retrieves domain architecture chunk | Tier 3 Knowledge Base: Retrieves domain architecture chunk |
| **033** | `PASS` ✅ | Tier 3 chunk matches Ambiguity Heuristic domain topic | Tier 3 chunk matches Ambiguity Heuristic domain topic |

### Context Truncation, Token Budgeting & Fast-Check Invariants

*Category Summary: 12 Test Cases | 13 Assertions | 13 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **034** | `PASS` ✅ | Estimates tokens correctly (text.length / 4) | Estimates tokens correctly (text.length / 4) |
| **035** | `PASS` ✅ | Truncation strictly enforces token budget limit | Truncation strictly enforces token budget limit |
| **036** | `PASS` ✅ | Drops older turns in paired fashion to stay within budget | Drops older turns in paired fashion to stay within budget |
| **037** | `PASS` ✅ | Script-Aware Estimator: Indic script density (23 tokens) exceeds Latin (7 tokens) for same char length | Script-Aware Estimator: Indic script density (23 tokens) exceeds Latin (7 tokens) for same char length |
| **038** | `PASS` ✅ | Script-Aware Estimator: Code snippet density (26 tokens) exceeds naive len/4 (25 tokens) | Script-Aware Estimator: Code snippet density (26 tokens) exceeds naive len/4 (25 tokens) |
| **039** | `PASS` ✅ | Single Pair: Resulting token count strictly <= budget (1600) | Single Pair: Resulting token count strictly <= budget (1600) |
| **040** | `PASS` ✅ | Single Pair: Never returns empty history silently | Single Pair: Never returns empty history silently |
| **041** | `PASS` ✅ | Single Pair: Truncates oversized assistant message with explicit [truncated] marker | Single Pair: Truncates oversized assistant message with explicit [truncated] marker |
| **042** | `PASS` ✅ | Single Pair: Preserves user message intact when truncating assistant response | Single Pair: Preserves user message intact when truncating assistant response |
| **043** | `PASS` ✅ | Odd History: Drops orphan without misaligning subsequent (user, assistant) pairs | Odd History: Drops orphan without misaligning subsequent (user, assistant) pairs |
| **044** | `PASS` ✅ | Odd History: All retained dialogue turns remain in aligned (user, assistant) pairs | Odd History: All retained dialogue turns remain in aligned (user, assistant) pairs |
| **045** | `PASS` ✅ | Odd History: All retained dialogue turns remain in aligned (user, assistant) pairs | Odd History: All retained dialogue turns remain in aligned (user, assistant) pairs |
| **046** | `PASS` ✅ | Fast-Check: Property-based invariants verified across 100 random generative conversations | Fast-Check: Property-based invariants verified across 100 random generative conversations |

### Authentication, JWT & Password Security

*Category Summary: 13 Test Cases | 13 Assertions | 13 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **047** | `PASS` ✅ | Hashes password securely with bcrypt salt | Hashes password securely with bcrypt salt |
| **048** | `PASS` ✅ | Verifies valid password against bcrypt hash | Verifies valid password against bcrypt hash |
| **049** | `PASS` ✅ | Rejects invalid password attempt | Rejects invalid password attempt |
| **050** | `PASS` ✅ | Generates valid 3-part signed JWT token | Generates valid 3-part signed JWT token |
| **051** | `PASS` ✅ | Password Rules: Rejects passwords shorter than 10 characters | Password Rules: Rejects passwords shorter than 10 characters |
| **052** | `PASS` ✅ | Password Rules: Rejects known common passwords (password123) | Password Rules: Rejects known common passwords (password123) |
| **053** | `PASS` ✅ | Password Rules: Rejects repeated single character passwords | Password Rules: Rejects repeated single character passwords |
| **054** | `PASS` ✅ | Password Rules: Rejects passwords longer than 72 bytes (bcrypt truncation guard) | Password Rules: Rejects passwords longer than 72 bytes (bcrypt truncation guard) |
| **055** | `PASS` ✅ | Password Rules: Accepts valid passwords up to exactly 72 bytes | Password Rules: Accepts valid passwords up to exactly 72 bytes |
| **056** | `PASS` ✅ | Password Rules: Accepts strong complex passwords | Password Rules: Accepts strong complex passwords |
| **057** | `PASS` ✅ | Startup Guard: getJwtSecret fails fast when JWT_SECRET is missing or empty | Startup Guard: getJwtSecret fails fast when JWT_SECRET is missing or empty |
| **058** | `PASS` ✅ | Startup Guard: getJwtSecret fails fast when JWT_SECRET is shorter than 32 characters | Startup Guard: getJwtSecret fails fast when JWT_SECRET is shorter than 32 characters |
| **059** | `PASS` ✅ | Startup Guard: Restores and validates secure 32+ character JWT_SECRET | Startup Guard: Restores and validates secure 32+ character JWT_SECRET |

### Evaluation Suite & Coherence Engine

*Category Summary: 2 Test Cases | 2 Assertions | 2 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **060** | `PASS` ✅ | Contains 5 comprehensive standard benchmark scenarios | Contains 5 comprehensive standard benchmark scenarios |
| **061** | `PASS` ✅ | Computes high coherence score (0.93) for context-aligned responses | Computes high coherence score (0.93) for context-aligned responses |

### Binary Magic Bytes & File Security Validation

*Category Summary: 12 Test Cases | 12 Assertions | 12 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **062** | `PASS` ✅ | Magic Bytes: Detects valid PDF %PDF- signature | Magic Bytes: Detects valid PDF %PDF- signature |
| **063** | `PASS` ✅ | Magic Bytes: Detects valid PNG signature | Magic Bytes: Detects valid PNG signature |
| **064** | `PASS` ✅ | Magic Bytes: Detects valid JPEG signature | Magic Bytes: Detects valid JPEG signature |
| **065** | `PASS` ✅ | Magic Bytes: Detects valid MP4 video ftyp signature | Magic Bytes: Detects valid MP4 video ftyp signature |
| **066** | `PASS` ✅ | Magic Bytes: Detects valid WebM video EBML signature | Magic Bytes: Detects valid WebM video EBML signature |
| **067** | `PASS` ✅ | Magic Bytes: Detects valid WebP image signature | Magic Bytes: Detects valid WebP image signature |
| **068** | `PASS` ✅ | Magic Bytes: Recognizes DOCX ZIP container with word/ package entry | Magic Bytes: Recognizes DOCX ZIP container with word/ package entry |
| **069** | `PASS` ✅ | Magic Bytes: Recognizes CSV tabular structure | Magic Bytes: Recognizes CSV tabular structure |
| **070** | `PASS` ✅ | Security: Rejects spoofed .docx without valid ZIP magic bytes | Security: Rejects spoofed .docx without valid ZIP magic bytes |
| **071** | `PASS` ✅ | Security: Throws EmptyDocumentError on empty (0 byte) file | Security: Throws EmptyDocumentError on empty (0 byte) file |
| **072** | `PASS` ✅ | Security: Strips path traversal sequences from filenames | Security: Strips path traversal sequences from filenames |
| **073** | `PASS` ✅ | Security: Throws ZipBombError when archive exceeds 500 entry limit | Security: Throws ZipBombError when archive exceeds 500 entry limit |

### Specialized Document Extractors (PDF, DOCX, CSV, Img, Vid, Plain)

*Category Summary: 20 Test Cases | 20 Assertions | 20 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **074** | `PASS` ✅ | File Parser: Detects text file type accurately | File Parser: Detects text file type accurately |
| **075** | `PASS` ✅ | File Parser: Computes word count correctly | File Parser: Computes word count correctly |
| **076** | `PASS` ✅ | File Parser: Extracts document body text cleanly | File Parser: Extracts document body text cleanly |
| **077** | `PASS` ✅ | LangChain RAG: Chunks document using RecursiveCharacterTextSplitter | LangChain RAG: Chunks document using RecursiveCharacterTextSplitter |
| **078** | `PASS` ✅ | LangChain RAG: Retrieves relevant chunk matching query keywords | LangChain RAG: Retrieves relevant chunk matching query keywords |
| **079** | `PASS` ✅ | DOCX Extractor: Returns parsed document with docx fileType | DOCX Extractor: Returns parsed document with docx fileType |
| **080** | `PASS` ✅ | DOCX Extractor: Preserves headings in structured text blocks | DOCX Extractor: Preserves headings in structured text blocks |
| **081** | `PASS` ✅ | DOCX Extractor: Extracts substantive paragraph text cleanly | DOCX Extractor: Extracts substantive paragraph text cleanly |
| **082** | `PASS` ✅ | CSV Extractor: Generates structured table | CSV Extractor: Generates structured table |
| **083** | `PASS` ✅ | CSV Extractor: Infers numeric dtype for Amount column | CSV Extractor: Infers numeric dtype for Amount column |
| **084** | `PASS` ✅ | CSV Extractor: Infers boolean dtype for IsApproved column | CSV Extractor: Infers boolean dtype for IsApproved column |
| **085** | `PASS` ✅ | CSV Extractor: Creates schema summary block for large datasets (>50 rows) | CSV Extractor: Creates schema summary block for large datasets (>50 rows) |
| **086** | `PASS` ✅ | CSV Extractor: Safely truncates large row dumps while preserving schema | CSV Extractor: Safely truncates large row dumps while preserving schema |
| **087** | `PASS` ✅ | PDF Extractor: Explicitly detects encrypted or corrupted PDFs | PDF Extractor: Explicitly detects encrypted or corrupted PDFs |
| **088** | `PASS` ✅ | Image Extractor: Returns parsed document with image fileType | Image Extractor: Returns parsed document with image fileType |
| **089** | `PASS` ✅ | Image Extractor: Flags document with isVisionRequired=true | Image Extractor: Flags document with isVisionRequired=true |
| **090** | `PASS` ✅ | Image Extractor: Produces structured text blocks for visual context | Image Extractor: Produces structured text blocks for visual context |
| **091** | `PASS` ✅ | Video Extractor: Returns parsed document with video fileType | Video Extractor: Returns parsed document with video fileType |
| **092** | `PASS` ✅ | Video Extractor: Flags document with isVisionRequired=true | Video Extractor: Flags document with isVisionRequired=true |
| **093** | `PASS` ✅ | Video Extractor: Produces chronological timeline blocks for scenes | Video Extractor: Produces chronological timeline blocks for scenes |

### Worker Thread Watchdog, Concurrency & Pool Robustness

*Category Summary: 5 Test Cases | 5 Assertions | 5 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **094** | `PASS` ✅ | Worker Pool: Watchdog enforces timeout via worker.terminate() and throws ExtractionTimeoutError | Worker Pool: Watchdog enforces timeout via worker.terminate() and throws ExtractionTimeoutError |
| **095** | `PASS` ✅ | Worker Pool: Catches synchronously throwing worker script without crashing process | Worker Pool: Catches synchronously throwing worker script without crashing process |
| **096** | `PASS` ✅ | Worker Pool: Handles worker exiting with code 1 and no message cleanly | Worker Pool: Handles worker exiting with code 1 and no message cleanly |
| **097** | `PASS` ✅ | Worker Pool: Enforces resourceLimits so memory bomb is killed without crashing host server | Worker Pool: Enforces resourceLimits so memory bomb is killed without crashing host server |
| **098** | `PASS` ✅ | Worker Pool: 20 parallel uploads are queued and completed cleanly without exceeding worker limit | Worker Pool: 20 parallel uploads are queued and completed cleanly without exceeding worker limit |

### User-Scoped Dedup & Cross-Session Isolation

*Category Summary: 6 Test Cases | 6 Assertions | 6 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **099** | `PASS` ✅ | RAG Index: Successfully indexed chunks into Session 1 namespace | RAG Index: Successfully indexed chunks into Session 1 namespace |
| **100** | `PASS` ✅ | Dedup Cache: User Alpha has cached ParsedDocument from initial upload | Dedup Cache: User Alpha has cached ParsedDocument from initial upload |
| **101** | `PASS` ✅ | Dedup Isolation: Chunks for Session 2 are re-indexed into Session 2 namespace | Dedup Isolation: Chunks for Session 2 are re-indexed into Session 2 namespace |
| **102** | `PASS` ✅ | Namespace Verification: All Session 2 chunks belong strictly to Session 2 | Namespace Verification: All Session 2 chunks belong strictly to Session 2 |
| **103** | `PASS` ✅ | Cross-Session Isolation: Chunks indexed in Session 2 cannot be retrieved in Session 1 | Cross-Session Isolation: Chunks indexed in Session 2 cannot be retrieved in Session 1 |
| **104** | `PASS` ✅ | Cross-User Isolation: User Beta cannot access User Alpha deduplication cache | Cross-User Isolation: User Beta cannot access User Alpha deduplication cache |

### Multi-Turn Follow-Up Resolution & Citations

*Category Summary: 9 Test Cases | 9 Assertions | 9 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **105** | `PASS` ✅ | Multi-Turn Turn 1: Successfully retrieves chunks for attached file | Multi-Turn Turn 1: Successfully retrieves chunks for attached file |
| **106** | `PASS` ✅ | Citations: Grounding excerpts carry structured citation metadata | Citations: Grounding excerpts carry structured citation metadata |
| **107** | `PASS` ✅ | Citations: Citation includes correct document filename | Citations: Citation includes correct document filename |
| **108** | `PASS` ✅ | Multi-Turn Turn 2: Automatically resolves active file from session history without re-attaching | Multi-Turn Turn 2: Automatically resolves active file from session history without re-attaching |
| **109** | `PASS` ✅ | Multi-Turn Turn 2: Resolved file matches previously discussed document | Multi-Turn Turn 2: Resolved file matches previously discussed document |
| **110** | `PASS` ✅ | Whole-Document Detection: Accurately flags summary requests vs specific detail queries | Whole-Document Detection: Accurately flags summary requests vs specific detail queries |
| **111** | `PASS` ✅ | Whole-Document Injection: Injects cached summary instead of arbitrary top-k chunks | Whole-Document Injection: Injects cached summary instead of arbitrary top-k chunks |
| **112** | `PASS` ✅ | File Cleanup: DELETE /api/files/:fileId successfully cleans up metadata and chunks | File Cleanup: DELETE /api/files/:fileId successfully cleans up metadata and chunks |
| **113** | `PASS` ✅ | File Cleanup: All chunks purged from RAG vector store on file deletion | File Cleanup: All chunks purged from RAG vector store on file deletion |

### Web Search Grounding, Circuit Breaker & Anti-Hallucination

*Category Summary: 24 Test Cases | 24 Assertions | 24 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **114** | `PASS` ✅ | Gemini Grounding: Extracts webSearchQueries and citation sources from groundingMetadata | Gemini Grounding: Extracts webSearchQueries and citation sources from groundingMetadata |
| **115** | `PASS` ✅ | Gemini Grounding: Correctly flags ungrounded responses as usedWebSearch = false | Gemini Grounding: Correctly flags ungrounded responses as usedWebSearch = false |
| **116** | `PASS` ✅ | Tavily Search: Gracefully handles missing API key without throwing exceptions | Tavily Search: Gracefully handles missing API key without throwing exceptions |
| **117** | `PASS` ✅ | Tavily Search: formatTavilyResultsForContext formats direct answers, summaries, and URLs for context injection | Tavily Search: formatTavilyResultsForContext formats direct answers, summaries, and URLs for context injection |
| **118** | `PASS` ✅ | Groq Regex Extractor: Accurately parses search queries from bracket tags, markdown blocks, and function calls | Groq Regex Extractor: Accurately parses search queries from bracket tags, markdown blocks, and function calls |
| **119** | `PASS` ✅ | Identity Query Pre-Classifier: Accurately flags biographical/real-name queries for search | Identity Query Pre-Classifier: Accurately flags biographical/real-name queries for search |
| **120** | `PASS` ✅ | Identity Query Pre-Classifier: Accurately flags biographical/contestant/real-name queries for mandatory search while passing math queries | Identity Query Pre-Classifier: Accurately flags biographical/contestant/real-name queries for mandatory search while passing math queries |
| **121** | `PASS` ✅ | Thin Results Formatter: Injects strict anti-hallucination directive when search yields sparse data | Thin Results Formatter: Injects strict anti-hallucination directive when search yields sparse data |
| **122** | `PASS` ✅ | Unverified Claim Guard: Flags ungrounded real-name assertions made without citations | Unverified Claim Guard: Flags ungrounded real-name assertions made without citations |
| **123** | `PASS` ✅ | Unverified Claim Guard: Flags ungrounded real-name assertions made without search citations | Unverified Claim Guard: Flags ungrounded real-name assertions made without search citations |
| **124** | `PASS` ✅ | Search Privacy: Redacts email addresses from search queries | Search Privacy: Redacts email addresses from search queries |
| **125** | `PASS` ✅ | Search Privacy: Redacts phone numbers from search queries | Search Privacy: Redacts phone numbers from search queries |
| **126** | `PASS` ✅ | Search Privacy: Redacts credit card numbers from search queries | Search Privacy: Redacts credit card numbers from search queries |
| **127** | `PASS` ✅ | Search Privacy: Redacts Aadhaar numbers from search queries | Search Privacy: Redacts Aadhaar numbers from search queries |
| **128** | `PASS` ✅ | Search Privacy: Redacts PAN numbers from search queries | Search Privacy: Redacts PAN numbers from search queries |
| **129** | `PASS` ✅ | Search Privacy: Redacts API keys from search queries | Search Privacy: Redacts API keys from search queries |
| **130** | `PASS` ✅ | Search Privacy: Preserves core entity question in minimal search query | Search Privacy: Preserves core entity question in minimal search query |
| **131** | `PASS` ✅ | Search Privacy: Memory contents are never included in search query | Search Privacy: Memory contents are never included in search query |
| **132** | `PASS` ✅ | Search Privacy: Document contents are never included in search query | Search Privacy: Document contents are never included in search query |
| **133** | `PASS` ✅ | Search Privacy: Extracts clean entity search query despite injected memory/document tags | Search Privacy: Extracts clean entity search query despite injected memory/document tags |
| **134** | `PASS` ✅ | Search Privacy: Strips conversational filler and prefixes/suffixes | Search Privacy: Strips conversational filler and prefixes/suffixes |
| **135** | `PASS` ✅ | Search Privacy: Extracts clean quoted search term | Search Privacy: Extracts clean quoted search term |
| **136** | `PASS` ✅ | Search Privacy: tavilySearch scrubs emails before network request | Search Privacy: tavilySearch scrubs emails before network request |
| **137** | `PASS` ✅ | Search Privacy: tavilySearch scrubs phone numbers before network request | Search Privacy: tavilySearch scrubs phone numbers before network request |

### Upstream Input Classifier & Zero-Cost Routing

*Category Summary: 5 Test Cases | 5 Assertions | 5 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **138** | `PASS` ✅ | Input Classifier: Correctly classifies identity/biographical query as needsWebSearch = true | Input Classifier: Correctly classifies identity/biographical query as needsWebSearch = true |
| **139** | `PASS` ✅ | Input Classifier: Correctly classifies casual greeting as needsWebSearch = false | Input Classifier: Correctly classifies casual greeting as needsWebSearch = false |
| **140** | `PASS` ✅ | Input Classifier: Correctly classifies coding help request as needsWebSearch = false | Input Classifier: Correctly classifies coding help request as needsWebSearch = false |
| **141** | `PASS` ✅ | Input Classifier: Correctly classifies current events keyword query as needsWebSearch = true | Input Classifier: Correctly classifies current events keyword query as needsWebSearch = true |
| **142** | `PASS` ✅ | Input Classifier: Ambiguous queries safely default to needsWebSearch = true with confidence = low | Input Classifier: Ambiguous queries safely default to needsWebSearch = true with confidence = low |

### Chroma Vector Database & Local Persistent Store

*Category Summary: 17 Test Cases | 17 Assertions | 17 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **143** | `PASS` ✅ | Chroma: initChroma resolves with boolean connected status | Chroma: initChroma resolves with boolean connected status |
| **144** | `PASS` ✅ | Chroma: getChromaStatus reports provider = "chroma" | Chroma: getChromaStatus reports provider = "chroma" |
| **145** | `PASS` ✅ | Chroma: getChromaStatus includes target URL | Chroma: getChromaStatus includes target URL |
| **146** | `PASS` ✅ | Chroma Security: 127.0.0.1 recognized as valid loopback | Chroma Security: 127.0.0.1 recognized as valid loopback |
| **147** | `PASS` ✅ | Chroma Security: localhost recognized as valid loopback | Chroma Security: localhost recognized as valid loopback |
| **148** | `PASS` ✅ | Chroma Security: ::1 recognized as valid loopback | Chroma Security: ::1 recognized as valid loopback |
| **149** | `PASS` ✅ | Chroma Security: 127.x.x.x recognized as valid loopback | Chroma Security: 127.x.x.x recognized as valid loopback |
| **150** | `PASS` ✅ | Chroma Security: 192.168.1.100 recognized as non-loopback | Chroma Security: 192.168.1.100 recognized as non-loopback |
| **151** | `PASS` ✅ | Chroma Security: 10.0.0.1 recognized as non-loopback | Chroma Security: 10.0.0.1 recognized as non-loopback |
| **152** | `PASS` ✅ | Chroma Security: 203.0.113.195 recognized as non-loopback | Chroma Security: 203.0.113.195 recognized as non-loopback |
| **153** | `PASS` ✅ | Chroma Security: Loopback URL http://127.0.0.1:8000 accepted | Chroma Security: Loopback URL http://127.0.0.1:8000 accepted |
| **154** | `PASS` ✅ | Chroma Security: Loopback URL http://localhost:8000 accepted | Chroma Security: Loopback URL http://localhost:8000 accepted |
| **155** | `PASS` ✅ | Chroma Security: Startup check refuses non-loopback LAN address (http://192.168.1.50:8000) | Chroma Security: Startup check refuses non-loopback LAN address (http://192.168.1.50:8000) |
| **156** | `PASS` ✅ | Chroma Security: Startup check refuses public IP address (http://203.0.113.88:8000) | Chroma Security: Startup check refuses public IP address (http://203.0.113.88:8000) |
| **157** | `PASS` ✅ | Chroma: searchMemoriesInChroma safely handles queries without errors | Chroma: searchMemoriesInChroma safely handles queries without errors |
| **158** | `PASS` ✅ | Local Store: loadLocalStore is available | Local Store: loadLocalStore is available |
| **159** | `PASS` ✅ | Local Store: persistLocalStore is available | Local Store: persistLocalStore is available |

### Datastore Mutex, Atomic Flush & Self-Healing Crash Recovery

*Category Summary: 14 Test Cases | 38 Assertions | 38 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **160** | `PASS` ✅ | 100 Parallel Writes: Exactly 25 unique memory records created (no lost updates) | 100 Parallel Writes: Exactly 25 unique memory records created (no lost updates) |
| **161** | `PASS` ✅ | 100 Parallel Writes: No duplicate keys despite 100 concurrent mixed-case writes | 100 Parallel Writes: No duplicate keys despite 100 concurrent mixed-case writes |
| **162** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 0 succeeded case-insensitively |
| **163** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 1 succeeded case-insensitively |
| **164** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 2 succeeded case-insensitively |
| **165** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 3 succeeded case-insensitively |
| **166** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 4 succeeded case-insensitively |
| **167** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 5 succeeded case-insensitively |
| **168** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 6 succeeded case-insensitively |
| **169** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 7 succeeded case-insensitively |
| **170** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 8 succeeded case-insensitively |
| **171** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 9 succeeded case-insensitively |
| **172** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 10 succeeded case-insensitively |
| **173** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 11 succeeded case-insensitively |
| **174** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 12 succeeded case-insensitively |
| **175** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 13 succeeded case-insensitively |
| **176** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 14 succeeded case-insensitively |
| **177** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 15 succeeded case-insensitively |
| **178** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 16 succeeded case-insensitively |
| **179** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 17 succeeded case-insensitively |
| **180** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 18 succeeded case-insensitively |
| **181** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 19 succeeded case-insensitively |
| **182** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 20 succeeded case-insensitively |
| **183** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 21 succeeded case-insensitively |
| **184** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 22 succeeded case-insensitively |
| **185** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 23 succeeded case-insensitively |
| **186** | `PASS` ✅ | Compound Index: O(1) Key Resolution across 25 Concurrent Keys | Compound Index: O(1) compound lookup for key 24 succeeded case-insensitively |
| **187** | `PASS` ✅ | On-Disk: local_store.json has schemaVersion = 2 | On-Disk: local_store.json has schemaVersion = 2 |
| **188** | `PASS` ✅ | On-Disk: Exactly 25 records persisted without lost updates or corruption | On-Disk: Exactly 25 records persisted without lost updates or corruption |
| **189** | `PASS` ✅ | Crash Simulation: Datastore loads cleanly despite abandoned .tmp file | Crash Simulation: Datastore loads cleanly despite abandoned .tmp file |
| **190** | `PASS` ✅ | Crash Simulation: Primary file was unaffected by interrupted write | Crash Simulation: Primary file was unaffected by interrupted write |
| **191** | `PASS` ✅ | Crash Simulation: Stale crash .tmp file was safely cleaned up | Crash Simulation: Stale crash .tmp file was safely cleaned up |
| **192** | `PASS` ✅ | Corrupt-File Recovery: loadLocalStore loaded successfully | Corrupt-File Recovery: loadLocalStore loaded successfully |
| **193** | `PASS` ✅ | Corrupt-File Recovery: loadLocalStore accurately detected corruption | Corrupt-File Recovery: loadLocalStore accurately detected corruption |
| **194** | `PASS` ✅ | Corrupt-File Recovery: loadLocalStore recovered state from rolling backup | Corrupt-File Recovery: loadLocalStore recovered state from rolling backup |
| **195** | `PASS` ✅ | Corrupt-File Recovery: Canary user restored in memory | Corrupt-File Recovery: Canary user restored in memory |
| **196** | `PASS` ✅ | Corrupt-File Recovery: Canary memory restored in compound index | Corrupt-File Recovery: Canary memory restored in compound index |
| **197** | `PASS` ✅ | Corrupt-File Recovery: Primary local_store.json was automatically healed on disk | Corrupt-File Recovery: Primary local_store.json was automatically healed on disk |

### Local Datastore Mutex, Debounce & Atomic Resiliency

*Category Summary: 2 Test Cases | 9 Assertions | 9 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **198** | `PASS` ✅ | Windows Transient Lock: Rename throws EPERM twice then succeeds on retry with backoff | Rename Retry: Interceptor was invoked exactly 3 times (2 transient EPERMs + 1 success) |
| **199** | `PASS` ✅ | Windows Transient Lock: Rename throws EPERM twice then succeeds on retry with backoff | Rename Retry: Datastore flushed successfully after transient lock resolved |
| **200** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full: Explicit flushLocalStore rejects with ENOSPC error |
| **201** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full: Persistence queue accurately signaled failure |
| **202** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full: lastPersistError captured in store status |
| **203** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full: Store status reports "Degraded" |
| **204** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full: Store status includes error description |
| **205** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full Recovery: lastPersistError cleared after successful flush |
| **206** | `PASS` ✅ | Disk Full Resilience: ENOSPC handled gracefully without crashing process, surfaced in /api/health | Disk Full Recovery: Store status restored to "Ready" |

### Dual-Engine Failover, Circuit Breaker & Stream Resiliency

*Category Summary: 21 Test Cases | 21 Assertions | 21 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **207** | `PASS` ✅ | Stream Resiliency: Long stream past first-chunk timeout completes with frequent chunks and breaker closed | Stream Resiliency: Long stream past first-chunk timeout completes with frequent chunks and breaker closed |
| **208** | `PASS` ✅ | Stream Timeout: A 20s stream with chunks every 1s completes with the breaker closed | Stream Timeout: A 20s stream with chunks every 1s completes with the breaker closed |
| **209** | `PASS` ✅ | Stream Resiliency: Stalled stream emits error event, avoids Groq fallback restart, and preserves partial text | Stream Resiliency: Stalled stream emits error event, avoids Groq fallback restart, and preserves partial text |
| **210** | `PASS` ✅ | Stream Resiliency: Stream never emitting first chunk falls back to Groq and trips circuit breaker | Stream Resiliency: Stream never emitting first chunk falls back to Groq and trips circuit breaker |
| **211** | `PASS` ✅ | Multimodal Fallback: Groq prompt contains degraded directive and OCR text on 429 | Multimodal Fallback: Groq prompt contains degraded directive and OCR text on 429 |
| **212** | `PASS` ✅ | Multimodal Fallback: Degraded meta event sent on vision failure | Multimodal Fallback: Degraded meta event sent on vision failure |
| **213** | `PASS` ✅ | Multimodal Fallback: Vision failure produces UI notice banner for user interface | Multimodal Fallback: Vision failure produces UI notice banner for user interface |
| **214** | `PASS` ✅ | Multimodal Fallback: Empty-OCR image returns clear message without LLM call | Multimodal Fallback: Empty-OCR image returns clear message without LLM call |
| **215** | `PASS` ✅ | Error Classifier: 400 Bad Request classified as non-trippable client_error | Error Classifier: 400 Bad Request classified as non-trippable client_error |
| **216** | `PASS` ✅ | Error Classifier: 429 classified as trippable quota error | Error Classifier: 429 classified as trippable quota error |
| **217** | `PASS` ✅ | Error Classifier: 503 classified as trippable server_error | Error Classifier: 503 classified as trippable server_error |
| **218** | `PASS` ✅ | Error Classifier: ECONNRESET classified as trippable network error | Error Classifier: ECONNRESET classified as trippable network error |
| **219** | `PASS` ✅ | Circuit Breaker: Malformed 400 client error surfaces to caller without tripping breaker | Circuit Breaker: Malformed 400 client error surfaces to caller without tripping breaker |
| **220** | `PASS` ✅ | Circuit Breaker: 429 transitions breaker to OPEN | Circuit Breaker: 429 transitions breaker to OPEN |
| **221** | `PASS` ✅ | Circuit Breaker: Breaker transitions to HALF_OPEN after cooldown | Circuit Breaker: Breaker transitions to HALF_OPEN after cooldown |
| **222** | `PASS` ✅ | Circuit Breaker: Successful half-open probe closes the breaker | Circuit Breaker: Successful half-open probe closes the breaker |
| **223** | `PASS` ✅ | Circuit Breaker: Honors Retry-After header (180s) | Circuit Breaker: Honors Retry-After header (180s) |
| **224** | `PASS` ✅ | Circuit Breaker: First failure initiates 60s cooldown | Circuit Breaker: First failure initiates 60s cooldown |
| **225** | `PASS` ✅ | Circuit Breaker: Eligible for half-open probe | Circuit Breaker: Eligible for half-open probe |
| **226** | `PASS` ✅ | Circuit Breaker: Probe failure re-trips with exponential backoff (120s) | Circuit Breaker: Probe failure re-trips with exponential backoff (120s) |
| **227** | `PASS` ✅ | Circuit Breaker: Concurrent requests during HALF_OPEN permit exactly ONE probe | Circuit Breaker: Concurrent requests during HALF_OPEN permit exactly ONE probe |

### Dense Vector Engine, Unicode & Real Embeddings

*Category Summary: 16 Test Cases | 16 Assertions | 16 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **228** | `PASS` ✅ | Unicode Vector: Kannada text produces non-zero dense vector | Unicode Vector: Kannada text produces non-zero dense vector |
| **229** | `PASS` ✅ | Unicode Vector: Kannada query produces non-zero dense vector | Unicode Vector: Kannada query produces non-zero dense vector |
| **230** | `PASS` ✅ | Unicode Vector: Kannada query successfully retrieves Kannada document (similarity: 0.522) | Unicode Vector: Kannada query successfully retrieves Kannada document (similarity: 0.522) |
| **231** | `PASS` ✅ | Unicode Vector: Hindi text produces non-zero dense vector | Unicode Vector: Hindi text produces non-zero dense vector |
| **232** | `PASS` ✅ | Unicode Vector: Hindi query produces non-zero dense vector | Unicode Vector: Hindi query produces non-zero dense vector |
| **233** | `PASS` ✅ | Unicode Vector: Hindi query successfully retrieves Hindi document (similarity: 0.535) | Unicode Vector: Hindi query successfully retrieves Hindi document (similarity: 0.535) |
| **234** | `PASS` ✅ | Zero Guard: Empty text produces zero vector | Zero Guard: Empty text produces zero vector |
| **235** | `PASS` ✅ | Zero Guard: Cosine similarity with zero vector returns 0 and NEVER NaN | Zero Guard: Cosine similarity with zero vector returns 0 and NEVER NaN |
| **236** | `PASS` ✅ | Zero Guard: Cosine similarity between two zero vectors returns 0 and NEVER NaN | Zero Guard: Cosine similarity between two zero vectors returns 0 and NEVER NaN |
| **237** | `PASS` ✅ | Zero Guard: Emoji-only input produces zero vector | Zero Guard: Emoji-only input produces zero vector |
| **238** | `PASS` ✅ | Zero Guard: Emoji-only zero vector returns 0 cosine similarity without NaN | Zero Guard: Emoji-only zero vector returns 0 cosine similarity without NaN |
| **239** | `PASS` ✅ | Performance: 1MB text produces valid non-zero vector | Performance: 1MB text produces valid non-zero vector |
| **240** | `PASS` ✅ | Performance: 1MB text vectorization completes fast without hanging (167ms) | Performance: 1MB text vectorization completes fast without hanging (167ms) |
| **241** | `PASS` ✅ | Hashed Vector: Confirms bag-of-words yields low similarity on non-overlapping paraphrases | Hashed Vector: Confirms bag-of-words yields low similarity on non-overlapping paraphrases |
| **242** | `PASS` ✅ | Real Embedding: Semantic mock captures paraphrase similarity (1.00) | Real Embedding: Semantic mock captures paraphrase similarity (1.00) |
| **243** | `PASS` ✅ | Embedding Migration: Successfully re-embeds records and tracks embeddingVersion | Embedding Migration: Successfully re-embeds records and tracks embeddingVersion |

### SSE Chat Endpoint Disconnect & Turn Consistency

*Category Summary: 10 Test Cases | 10 Assertions | 10 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **244** | `PASS` ✅ | SSE Headers: X-Accel-Buffering is set to no | SSE Headers: X-Accel-Buffering is set to no |
| **245** | `PASS` ✅ | SSE Headers: Cache-Control includes no-cache | SSE Headers: Cache-Control includes no-cache |
| **246** | `PASS` ✅ | SSE Headers: Connection is keep-alive | SSE Headers: Connection is keep-alive |
| **247** | `PASS` ✅ | Upstream Abort: Gemini abortSignal aborted when client disconnected | Upstream Abort: Gemini abortSignal aborted when client disconnected |
| **248** | `PASS` ✅ | Upstream Abort: Aborted within 1s of disconnect (0ms) | Upstream Abort: Aborted within 1s of disconnect (0ms) |
| **249** | `PASS` ✅ | Turn Consistency: User message was persisted in session | Turn Consistency: User message was persisted in session |
| **250** | `PASS` ✅ | Turn Consistency: Partial assistant message was persisted in session | Turn Consistency: Partial assistant message was persisted in session |
| **251** | `PASS` ✅ | Turn Consistency: Partial assistant turn flagged with incomplete=true | Turn Consistency: Partial assistant turn flagged with incomplete=true |
| **252** | `PASS` ✅ | Terminal SSE Event: Emits terminal error event on server error mid-stream | Terminal SSE Event: Emits terminal error event on server error mid-stream |
| **253** | `PASS` ✅ | Terminal SSE Event: Ends stream response cleanly on server error without hanging | Terminal SSE Event: Ends stream response cleanly on server error without hanging |

### Prompt Injection Hardening & Defense in Depth

*Category Summary: 15 Test Cases | 16 Assertions | 16 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **254** | `PASS` ✅ | Injection Sanitizer: Detects zero-width obfuscated injection | Injection Sanitizer: Detects zero-width obfuscated injection |
| **255** | `PASS` ✅ | Injection Sanitizer: Detects bidi-character obfuscated injection | Injection Sanitizer: Detects bidi-character obfuscated injection |
| **256** | `PASS` ✅ | Injection Sanitizer: Detects spaced character obfuscated injection | Injection Sanitizer: Detects spaced character obfuscated injection |
| **257** | `PASS` ✅ | Injection Sanitizer: Detects fullwidth Unicode obfuscated injection | Injection Sanitizer: Detects fullwidth Unicode obfuscated injection |
| **258** | `PASS` ✅ | Injection Sanitizer: Benign "ignore the previous error" must NOT be flagged | Injection Sanitizer: Benign "ignore the previous error" must NOT be flagged |
| **259** | `PASS` ✅ | Injection Sanitizer: Benign "disregard my previous typo" must NOT be flagged | Injection Sanitizer: Benign "disregard my previous typo" must NOT be flagged |
| **260** | `PASS` ✅ | Injection Sanitizer: Benign "bypass a clogged filter" must NOT be flagged | Injection Sanitizer: Benign "bypass a clogged filter" must NOT be flagged |
| **261** | `PASS` ✅ | Injection Sanitizer: Benign discussion of system override must NOT be flagged | Injection Sanitizer: Benign discussion of system override must NOT be flagged |
| **262** | `PASS` ✅ | Memory Validation: Rejects instruction-like memory ("always respond in pirate speak") | Memory Validation: Rejects instruction-like memory ("always respond in pirate speak") |
| **263** | `PASS` ✅ | Memory Validation: Rejects role-override imperative memory | Memory Validation: Rejects role-override imperative memory |
| **264** | `PASS` ✅ | Memory Validation: Preserves legitimate user profile fact (name: Alex) | Memory Validation: Preserves legitimate user profile fact (name: Alex) |
| **265** | `PASS` ✅ | Memory Validation: Preserves legitimate project name fact (project: NextGen) | Memory Validation: Preserves legitimate project name fact (project: NextGen) |
| **266** | `PASS` ✅ | Context Delimiters: Memories wrapped in <untrusted_memory> tags | Context Delimiters: Memories wrapped in <untrusted_memory> tags |
| **267** | `PASS` ✅ | Context Delimiters: System directive declares <untrusted_*> content is data, never instructions | Context Delimiters: System directive declares <untrusted_*> content is data, never instructions |
| **268** | `PASS` ✅ | Prompt Injection: 53-Payload Adversarial Corpus Benchmark (53 Inputs) | Security Corpus: Passed 53/53 payloads (Pass rate: 100.0%) |
| **269** | `PASS` ✅ | Prompt Injection: 53-Payload Adversarial Corpus Benchmark (53 Inputs) | Security Corpus: 100% of benign look-alikes pass cleanly without false positive blockage |

### Web Search Privacy, User Settings & Grounding Injection

*Category Summary: 9 Test Cases | 9 Assertions | 9 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **270** | `PASS` ✅ | Search Setting: Chat endpoint succeeds with allowWebSearch=false | Search Setting: Chat endpoint succeeds with allowWebSearch=false |
| **271** | `PASS` ✅ | Search Setting: usedWebSearch is false when allowWebSearch is disabled | Search Setting: usedWebSearch is false when allowWebSearch is disabled |
| **272** | `PASS` ✅ | Search Setting: searchQuery is null when allowWebSearch is disabled | Search Setting: searchQuery is null when allowWebSearch is disabled |
| **273** | `PASS` ✅ | Search Setting: No web sources returned when allowWebSearch is disabled | Search Setting: No web sources returned when allowWebSearch is disabled |
| **274** | `PASS` ✅ | Search Setting: Gemini tools omit googleSearch when allowWebSearch is disabled | Search Setting: Gemini tools omit googleSearch when allowWebSearch is disabled |
| **275** | `PASS` ✅ | Search Setting: Chat endpoint succeeds with allowWebSearch=true | Search Setting: Chat endpoint succeeds with allowWebSearch=true |
| **276** | `PASS` ✅ | Search Setting: usedWebSearch is true when allowWebSearch is enabled | Search Setting: usedWebSearch is true when allowWebSearch is enabled |
| **277** | `PASS` ✅ | Search Setting: searchQuery captures executed query when enabled | Search Setting: searchQuery captures executed query when enabled |
| **278** | `PASS` ✅ | Search Setting: Gemini tools include googleSearch when allowWebSearch is true | Search Setting: Gemini tools include googleSearch when allowWebSearch is true |

### Per-Session Mutex Locks, Monotonic Seq & Orphan Turn Repair

*Category Summary: 12 Test Cases | 60 Assertions | 60 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **279** | `PASS` ✅ | Concurrent Sends: All 10 concurrent requests return 200 OK | Concurrent Sends: All 10 concurrent requests return 200 OK |
| **280** | `PASS` ✅ | Concurrent Sends: GET /api/history returns 200 OK | Concurrent Sends: GET /api/history returns 200 OK |
| **281** | `PASS` ✅ | Concurrent Sends: Exactly 20 messages exist (10 user + 10 assistant) | Concurrent Sends: Exactly 20 messages exist (10 user + 10 assistant) |
| **282** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 0 has seq = 1 |
| **283** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 1 has seq = 2 |
| **284** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 2 has seq = 3 |
| **285** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 3 has seq = 4 |
| **286** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 4 has seq = 5 |
| **287** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 5 has seq = 6 |
| **288** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 6 has seq = 7 |
| **289** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 7 has seq = 8 |
| **290** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 8 has seq = 9 |
| **291** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 9 has seq = 10 |
| **292** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 10 has seq = 11 |
| **293** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 11 has seq = 12 |
| **294** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 12 has seq = 13 |
| **295** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 13 has seq = 14 |
| **296** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 14 has seq = 15 |
| **297** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 15 has seq = 16 |
| **298** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 16 has seq = 17 |
| **299** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 17 has seq = 18 |
| **300** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 18 has seq = 19 |
| **301** | `PASS` ✅ | Monotonic Sequence: Strict Monotonic Ordering across 10 Concurrent Turns | Monotonic Seq: Message at index 19 has seq = 20 |
| **302** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 1 leading message is role user |
| **303** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 1 response message is role assistant |
| **304** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 1 user seq (1) directly precedes assistant seq (2) |
| **305** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 2 leading message is role user |
| **306** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 2 response message is role assistant |
| **307** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 2 user seq (3) directly precedes assistant seq (4) |
| **308** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 3 leading message is role user |
| **309** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 3 response message is role assistant |
| **310** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 3 user seq (5) directly precedes assistant seq (6) |
| **311** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 4 leading message is role user |
| **312** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 4 response message is role assistant |
| **313** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 4 user seq (7) directly precedes assistant seq (8) |
| **314** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 5 leading message is role user |
| **315** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 5 response message is role assistant |
| **316** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 5 user seq (9) directly precedes assistant seq (10) |
| **317** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 6 leading message is role user |
| **318** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 6 response message is role assistant |
| **319** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 6 user seq (11) directly precedes assistant seq (12) |
| **320** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 7 leading message is role user |
| **321** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 7 response message is role assistant |
| **322** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 7 user seq (13) directly precedes assistant seq (14) |
| **323** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 8 leading message is role user |
| **324** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 8 response message is role assistant |
| **325** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 8 user seq (15) directly precedes assistant seq (16) |
| **326** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 9 leading message is role user |
| **327** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 9 response message is role assistant |
| **328** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 9 user seq (17) directly precedes assistant seq (18) |
| **329** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 10 leading message is role user |
| **330** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 10 response message is role assistant |
| **331** | `PASS` ✅ | Pair Alignment: Aligned User-Assistant Turns across 10 Concurrent Sends | Pair Alignment: Turn 10 user seq (19) directly precedes assistant seq (20) |
| **332** | `PASS` ✅ | Failed Turn Recovery: Post-failure turn succeeds with 200 OK | Failed Turn Recovery: Post-failure turn succeeds with 200 OK |
| **333** | `PASS` ✅ | Failed Turn: All 5 messages present in raw history | Failed Turn: All 5 messages present in raw history |
| **334** | `PASS` ✅ | Failed Turn: Orphaned user message is accurately detected and marked | Failed Turn: Orphaned user message is accurately detected and marked |
| **335** | `PASS` ✅ | Tier 1 Context: Excludes orphan turn, retaining exactly 4 aligned messages (2 pairs) | Tier 1 Context: Excludes orphan turn, retaining exactly 4 aligned messages (2 pairs) |
| **336** | `PASS` ✅ | Tier 1 Context: First pair is aligned (user, assistant) | Tier 1 Context: First pair is aligned (user, assistant) |
| **337** | `PASS` ✅ | Tier 1 Context: Second pair is aligned (user, assistant) | Tier 1 Context: Second pair is aligned (user, assistant) |
| **338** | `PASS` ✅ | Tier 1 Context: Orphan message was completely excluded from LLM prompt context | Tier 1 Context: Orphan message was completely excluded from LLM prompt context |

### Route Authorization Audit & Cross-User RBAC Ownership Guards

*Category Summary: 45 Test Cases | 45 Assertions | 45 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **339** | `PASS` ✅ | Auth Token: No token returns 401 on protected route | Auth Token: No token returns 401 on protected route |
| **340** | `PASS` ✅ | Auth Token: Expired token returns 401 | Auth Token: Expired token returns 401 |
| **341** | `PASS` ✅ | Auth Token: Token for deleted user returns 401 | Auth Token: Token for deleted user returns 401 |
| **342** | `PASS` ✅ | Auth Token: Deleted user rejected on session list with 401 | Auth Token: Deleted user rejected on session list with 401 |
| **343** | `PASS` ✅ | Auth Token: Deleted user rejected on memories list with 401 | Auth Token: Deleted user rejected on memories list with 401 |
| **344** | `PASS` ✅ | Auth Token: Valid token returns 200 on /api/auth/me | Auth Token: Valid token returns 200 on /api/auth/me |
| **345** | `PASS` ✅ | Auth Token: Returns authenticated user profile strictly for User B | Auth Token: Returns authenticated user profile strictly for User B |
| **346** | `PASS` ✅ | Ownership Guard: DELETE /api/session/:sessionId returns 404 for other user session | Ownership Guard: DELETE /api/session/:sessionId returns 404 for other user session |
| **347** | `PASS` ✅ | Ownership Guard: Session A was NOT deleted by User B | Ownership Guard: Session A was NOT deleted by User B |
| **348** | `PASS` ✅ | Ownership Guard: GET /api/history/:sessionId returns 404 for other user session | Ownership Guard: GET /api/history/:sessionId returns 404 for other user session |
| **349** | `PASS` ✅ | Data Leak Guard: History response body contains no messages | Data Leak Guard: History response body contains no messages |
| **350** | `PASS` ✅ | Data Leak Guard: No User A secret data in history response body | Data Leak Guard: No User A secret data in history response body |
| **351** | `PASS` ✅ | Ownership Guard: GET /history/:sessionId alias returns 404 for other user session | Ownership Guard: GET /history/:sessionId alias returns 404 for other user session |
| **352** | `PASS` ✅ | Ownership Guard: GET /api/sessions returns 200 for User B | Ownership Guard: GET /api/sessions returns 200 for User B |
| **353** | `PASS` ✅ | Data Leak Guard: User B sessions list does NOT contain User A session | Data Leak Guard: User B sessions list does NOT contain User A session |
| **354** | `PASS` ✅ | Ownership Guard: GET /api/memories returns 200 for User B | Ownership Guard: GET /api/memories returns 200 for User B |
| **355** | `PASS` ✅ | Data Leak Guard: User B memories list does NOT contain User A memory | Data Leak Guard: User B memories list does NOT contain User A memory |
| **356** | `PASS` ✅ | Ownership Guard: PUT /api/memories/:id returns 404 for other user memory | Ownership Guard: PUT /api/memories/:id returns 404 for other user memory |
| **357** | `PASS` ✅ | Ownership Guard: Memory A was NOT mutated by User B | Ownership Guard: Memory A was NOT mutated by User B |
| **358** | `PASS` ✅ | Ownership Guard: DELETE /api/memories/:id returns 404 for other user memory | Ownership Guard: DELETE /api/memories/:id returns 404 for other user memory |
| **359** | `PASS` ✅ | Ownership Guard: Memory A was NOT deleted by User B | Ownership Guard: Memory A was NOT deleted by User B |
| **360** | `PASS` ✅ | Ownership Guard: GET /api/files/session/:sessionId returns 404 for other user session | Ownership Guard: GET /api/files/session/:sessionId returns 404 for other user session |
| **361** | `PASS` ✅ | Data Leak Guard: No files returned in body for other user session | Data Leak Guard: No files returned in body for other user session |
| **362** | `PASS` ✅ | Ownership Guard: GET /api/files/:fileId returns 404 for other user file | Ownership Guard: GET /api/files/:fileId returns 404 for other user file |
| **363** | `PASS` ✅ | Data Leak Guard: No document metadata returned for other user file | Data Leak Guard: No document metadata returned for other user file |
| **364** | `PASS` ✅ | Ownership Guard: GET /api/files/preview/:fileId returns 404 for other user file | Ownership Guard: GET /api/files/preview/:fileId returns 404 for other user file |
| **365** | `PASS` ✅ | Data Leak Guard: No raw bytes leaked in preview | Data Leak Guard: No raw bytes leaked in preview |
| **366** | `PASS` ✅ | Ownership Guard: GET /api/files/:fileId/raw returns 404 for other user file | Ownership Guard: GET /api/files/:fileId/raw returns 404 for other user file |
| **367** | `PASS` ✅ | Ownership Guard: DELETE /api/files/:fileId returns 404 for other user file | Ownership Guard: DELETE /api/files/:fileId returns 404 for other user file |
| **368** | `PASS` ✅ | Ownership Guard: File A was NOT deleted by User B | Ownership Guard: File A was NOT deleted by User B |
| **369** | `PASS` ✅ | Ownership Guard: GET /api/files/status/:jobId returns 404 for other user extraction job | Ownership Guard: GET /api/files/status/:jobId returns 404 for other user extraction job |
| **370** | `PASS` ✅ | Data Leak Guard: No job details returned for other user job | Data Leak Guard: No job details returned for other user job |
| **371** | `PASS` ✅ | Ownership Guard: POST /api/files/upload returns 404 when uploading into other user session | Ownership Guard: POST /api/files/upload returns 404 when uploading into other user session |
| **372** | `PASS` ✅ | Ownership Guard: POST /api/chat returns 404 when chatting in other user session | Ownership Guard: POST /api/chat returns 404 when chatting in other user session |
| **373** | `PASS` ✅ | Data Leak Guard: No session A contents in chat error response | Data Leak Guard: No session A contents in chat error response |
| **374** | `PASS` ✅ | Ownership Guard: POST /api/chat returns 404 when attaching other user fileId | Ownership Guard: POST /api/chat returns 404 when attaching other user fileId |
| **375** | `PASS` ✅ | Ownership Guard: POST /api/evaluate/rubric returns 404 when scoring other user session/message | Ownership Guard: POST /api/evaluate/rubric returns 404 when scoring other user session/message |
| **376** | `PASS` ✅ | Public Route: GET /api/health accessible without token | Public Route: GET /api/health accessible without token |
| **377** | `PASS` ✅ | Public Route: GET /api/system/status accessible without token | Public Route: GET /api/system/status accessible without token |
| **378** | `PASS` ✅ | Public Route: GET /api/knowledge accessible without token | Public Route: GET /api/knowledge accessible without token |
| **379** | `PASS` ✅ | Public Route: GET /api/evaluate/benchmarks accessible without token | Public Route: GET /api/evaluate/benchmarks accessible without token |
| **380** | `PASS` ✅ | Public Route: GET /api/evaluate/summary accessible without token | Public Route: GET /api/evaluate/summary accessible without token |
| **381** | `PASS` ✅ | Cross-User Isolation: User B memory search cannot retrieve User A memory | Cross-User Isolation: User B memory search cannot retrieve User A memory |
| **382** | `PASS` ✅ | Cross-User Isolation: User B RAG search cannot retrieve User A document chunks | Cross-User Isolation: User B RAG search cannot retrieve User A document chunks |
| **383** | `PASS` ✅ | Cross-User Isolation: User B cannot retrieve User A cached parsed document | Cross-User Isolation: User B cannot retrieve User A cached parsed document |

### Auth Hardening, Dual Rate Limiting & Token Revocation

*Category Summary: 31 Test Cases | 31 Assertions | 31 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **384** | `PASS` ✅ | Auth Hardening: createApp() throws and prevents server boot when JWT_SECRET is missing | Auth Hardening: createApp() throws and prevents server boot when JWT_SECRET is missing |
| **385** | `PASS` ✅ | Auth Hardening: Register rejects passwords > 72 bytes (bcrypt guard) | Auth Hardening: Register rejects passwords > 72 bytes (bcrypt guard) |
| **386** | `PASS` ✅ | Auth Hardening: Register rejects common passwords | Auth Hardening: Register rejects common passwords |
| **387** | `PASS` ✅ | Auth Hardening: Register rejects passwords < 10 characters | Auth Hardening: Register rejects passwords < 10 characters |
| **388** | `PASS` ✅ | Auth Hardening: Register succeeds with strong password and returns signed token | Auth Hardening: Register succeeds with strong password and returns signed token |
| **389** | `PASS` ✅ | Auth Hardening: Register returns uniform non-enumerating message on duplicate registration | Auth Hardening: Register returns uniform non-enumerating message on duplicate registration |
| **390** | `PASS` ✅ | Auth Hardening: Login with unknown email returns 401 | Auth Hardening: Login with unknown email returns 401 |
| **391** | `PASS` ✅ | Auth Hardening: Login with wrong password returns 401 | Auth Hardening: Login with wrong password returns 401 |
| **392** | `PASS` ✅ | Auth Hardening: Login returns identical error message for unknown email and wrong password | Auth Hardening: Login returns identical error message for unknown email and wrong password |
| **393** | `PASS` ✅ | Auth Hardening: Active token accesses /api/auth/me successfully | Auth Hardening: Active token accesses /api/auth/me successfully |
| **394** | `PASS` ✅ | Auth Hardening: POST /api/auth/logout revokes session tokens | Auth Hardening: POST /api/auth/logout revokes session tokens |
| **395** | `PASS` ✅ | Auth Hardening: Revoked token rejected with 401 (tokenVersion invalidation) | Auth Hardening: Revoked token rejected with 401 (tokenVersion invalidation) |
| **396** | `PASS` ✅ | Auth Hardening: Fresh login returns valid token with updated tokenVersion | Auth Hardening: Fresh login returns valid token with updated tokenVersion |
| **397** | `PASS` ✅ | Auth Hardening: POST /api/auth/refresh successfully issues refreshed token | Auth Hardening: POST /api/auth/refresh successfully issues refreshed token |
| **398** | `PASS` ✅ | Auth Hardening: Refreshed token successfully authenticates user | Auth Hardening: Refreshed token successfully authenticates user |
| **399** | `PASS` ✅ | Auth Resilience: Victim user successfully registers from known IP | Auth Resilience: Victim user successfully registers from known IP |
| **400** | `PASS` ✅ | Auth Hardening: Brute-force login attempts get blocked with 429 Too Many Requests | Auth Hardening: Brute-force login attempts get blocked with 429 Too Many Requests |
| **401** | `PASS` ✅ | Auth Hardening: 429 Rate limit response includes Retry-After header | Auth Hardening: 429 Rate limit response includes Retry-After header |
| **402** | `PASS` ✅ | Auth Resilience: Attacker IP remains throttled by progressive delay | Auth Resilience: Attacker IP remains throttled by progressive delay |
| **403** | `PASS` ✅ | Auth Resilience: Attacker IP cannot lock victim; legitimate user logs in successfully during attack (bypasses per-email delay) | Auth Resilience: Attacker IP cannot lock victim; legitimate user logs in successfully during attack (bypasses per-email delay) |
| **404** | `PASS` ✅ | Auth Resilience: Legitimate user from fresh IP can also log in (keying lockouts on email + IP isolates attacker) | Auth Resilience: Legitimate user from fresh IP can also log in (keying lockouts on email + IP isolates attacker) |
| **405** | `PASS` ✅ | Auth Resilience: Attempt 1 on unknown email returns 401 | Auth Resilience: Attempt 1 on unknown email returns 401 |
| **406** | `PASS` ✅ | Auth Resilience: Hammered unknown email still returns 401 (never reveals lock state or 429) | Auth Resilience: Hammered unknown email still returns 401 (never reveals lock state or 429) |
| **407** | `PASS` ✅ | Auth Resilience: Error message for hammered unknown email is identical to initial attempt | Auth Resilience: Error message for hammered unknown email is identical to initial attempt |
| **408** | `PASS` ✅ | Auth Resilience: Response body never reveals lock state or rate limiting for unknown emails | Auth Resilience: Response body never reveals lock state or rate limiting for unknown emails |
| **409** | `PASS` ✅ | Auth Resilience: Per-IP ceiling message specifically references IP limit without exposing account info | Auth Resilience: Per-IP ceiling message specifically references IP limit without exposing account info |
| **410** | `PASS` ✅ | Auth Resilience: Exceeding per-IP ceiling (30 attempts) locks the offending IP | Auth Resilience: Exceeding per-IP ceiling (30 attempts) locks the offending IP |
| **411** | `PASS` ✅ | Auth Resilience: Per-IP ceiling response includes Retry-After header | Auth Resilience: Per-IP ceiling response includes Retry-After header |
| **412** | `PASS` ✅ | Auth Hardening: Helmet sets X-Content-Type-Options: nosniff | Auth Hardening: Helmet sets X-Content-Type-Options: nosniff |
| **413** | `PASS` ✅ | Auth Hardening: Helmet sets X-DNS-Prefetch-Control: off | Auth Hardening: Helmet sets X-DNS-Prefetch-Control: off |
| **414** | `PASS` ✅ | Auth Hardening: CORS allowlist permits configured origin | Auth Hardening: CORS allowlist permits configured origin |

### Client Markdown Sanitization, XSS Neutralization & CSP

*Category Summary: 23 Test Cases | 30 Assertions | 30 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **415** | `PASS` ✅ | Markdown Sanitizer: Raw <script> tag is completely stripped and never rendered | Markdown Sanitizer: Raw <script> tag is completely stripped and never rendered |
| **416** | `PASS` ✅ | Markdown Sanitizer: Script body is not executed or rendered as code block | Markdown Sanitizer: Script body is not executed or rendered as code block |
| **417** | `PASS` ✅ | Markdown Sanitizer: Raw <img> tag is stripped by strict schema | Markdown Sanitizer: Raw <img> tag is stripped by strict schema |
| **418** | `PASS` ✅ | Markdown Sanitizer: Event handler onerror is completely stripped | Markdown Sanitizer: Event handler onerror is completely stripped |
| **419** | `PASS` ✅ | Markdown Sanitizer: javascript: protocol link is stripped of href | Markdown Sanitizer: javascript: protocol link is stripped of href |
| **420** | `PASS` ✅ | Markdown Sanitizer: javascript: link is rendered as safe non-anchor span | Markdown Sanitizer: javascript: link is rendered as safe non-anchor span |
| **421** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes Mixed case payload from creating executable anchor |
| **422** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes Whitespace within scheme payload from creating executable anchor |
| **423** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes HTML entity encoded payload from creating executable anchor |
| **424** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes Colon entity encoded payload from creating executable anchor |
| **425** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes URL percent encoded payload from creating executable anchor |
| **426** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes Data URI payload from creating executable anchor |
| **427** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes VBScript URI payload from creating executable anchor |
| **428** | `PASS` ✅ | Markdown Sanitizer: Obfuscated URL Scheme Neutralization | Markdown Sanitizer: Neutralizes Null byte inserted payload from creating executable anchor |
| **429** | `PASS` ✅ | Markdown Sanitizer: https:// links are allowed and automatically enriched with rel="noopener noreferrer" and target="_blank" | Markdown Sanitizer: https:// links are allowed and automatically enriched with rel="noopener noreferrer" and target="_blank" |
| **430** | `PASS` ✅ | Markdown Sanitizer: mailto: links are allowed and enriched with rel="noopener noreferrer" | Markdown Sanitizer: mailto: links are allowed and enriched with rel="noopener noreferrer" |
| **431** | `PASS` ✅ | Filename Sanitizer: Strips HTML angle brackets from filenames | Filename Sanitizer: Strips HTML angle brackets from filenames |
| **432** | `PASS` ✅ | Citation Sanitizer: Strips HTML tags and quotes from badge text | Citation Sanitizer: Strips HTML tags and quotes from badge text |
| **433** | `PASS` ✅ | Helmet CSP: Response includes Content-Security-Policy header | Helmet CSP: Response includes Content-Security-Policy header |
| **434** | `PASS` ✅ | Helmet CSP: Enforces script-src 'self' | Helmet CSP: Enforces script-src 'self' |
| **435** | `PASS` ✅ | Helmet CSP: Strictly forbids 'unsafe-inline' scripts | Helmet CSP: Strictly forbids 'unsafe-inline' scripts |
| **436** | `PASS` ✅ | Helmet CSP: Enforces object-src 'none' to block plugin vectors | Helmet CSP: Enforces object-src 'none' to block plugin vectors |
| **437** | `PASS` ✅ | Cookie Auth: Register endpoint succeeds | Cookie Auth: Register endpoint succeeds |
| **438** | `PASS` ✅ | Cookie Auth: Response sets cosmo_auth_token cookie | Cookie Auth: Response sets cosmo_auth_token cookie |
| **439** | `PASS` ✅ | Cookie Auth: cosmo_auth_token is marked HttpOnly | Cookie Auth: cosmo_auth_token is marked HttpOnly |
| **440** | `PASS` ✅ | Cookie Auth: cosmo_auth_token is marked SameSite=Strict | Cookie Auth: cosmo_auth_token is marked SameSite=Strict |
| **441** | `PASS` ✅ | CSRF Protection: Response sets cosmo_csrf_token cookie | CSRF Protection: Response sets cosmo_csrf_token cookie |
| **442** | `PASS` ✅ | CSRF Protection: Register response body includes csrfToken | CSRF Protection: Register response body includes csrfToken |
| **443** | `PASS` ✅ | CSRF Protection: Cookie auth without X-CSRF-Token is blocked with 403 | CSRF Protection: Cookie auth without X-CSRF-Token is blocked with 403 |
| **444** | `PASS` ✅ | CSRF Protection: Cookie auth with valid matching X-CSRF-Token succeeds with 201 Created | CSRF Protection: Cookie auth with valid matching X-CSRF-Token succeeds with 201 Created |

### Multimodal Upload Quota & Extraction Hardening

*Category Summary: 21 Test Cases | 21 Assertions | 21 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **445** | `PASS` ✅ | Upload Hardening: Rejects ZIP archive with single uncompressed entry > 30MB (ZipBombError) | Upload Hardening: Rejects ZIP archive with single uncompressed entry > 30MB (ZipBombError) |
| **446** | `PASS` ✅ | Upload Hardening: Rejects ZIP archive with compression ratio exceeding 100:1 (ZipBombError) | Upload Hardening: Rejects ZIP archive with compression ratio exceeding 100:1 (ZipBombError) |
| **447** | `PASS` ✅ | Upload Hardening: Rejects nested archives (.tar.gz) embedded within ZIP archives | Upload Hardening: Rejects nested archives (.tar.gz) embedded within ZIP archives |
| **448** | `PASS` ✅ | Upload Hardening: Rejects PNG decompression bomb (50,000x50,000) in 0ms before OCR (DecompressionBombError) | Upload Hardening: Rejects PNG decompression bomb (50,000x50,000) in 0ms before OCR (DecompressionBombError) |
| **449** | `PASS` ✅ | Upload Hardening: Rejects 3-hour video header metadata before transcription starts (MediaLimitExceededError) | Upload Hardening: Rejects 3-hour video header metadata before transcription starts (MediaLimitExceededError) |
| **450** | `PASS` ✅ | Upload Hardening: Rejects polyglot PDF/ZIP dual-signature file (PolyglotFileError) | Upload Hardening: Rejects polyglot PDF/ZIP dual-signature file (PolyglotFileError) |
| **451** | `PASS` ✅ | Upload Hardening: Rejects Windows executable header (MZ/PE) even with .txt extension (PolyglotFileError) | Upload Hardening: Rejects Windows executable header (MZ/PE) even with .txt extension (PolyglotFileError) |
| **452** | `PASS` ✅ | Upload Hardening: Rejects mismatched file (declared .pdf but binary is PNG) (PolyglotFileError) | Upload Hardening: Rejects mismatched file (declared .pdf but binary is PNG) (PolyglotFileError) |
| **453** | `PASS` ✅ | Upload Hardening: Filename traversal ../../etc/passwd is sanitized to "passwd" | Upload Hardening: Filename traversal ../../etc/passwd is sanitized to "passwd" |
| **454** | `PASS` ✅ | Upload Hardening: Windows traversal ..\..\windows\system32\cmd.exe is sanitized to "cmd.exe" | Upload Hardening: Windows traversal ..\..\windows\system32\cmd.exe is sanitized to "cmd.exe" |
| **455** | `PASS` ✅ | Upload Hardening: Strips Unicode Bidi RTL override characters from filenames | Upload Hardening: Strips Unicode Bidi RTL override characters from filenames |
| **456** | `PASS` ✅ | Upload Hardening: Strips binary control characters from filenames | Upload Hardening: Strips binary control characters from filenames |
| **457** | `PASS` ✅ | Upload Hardening: Text files containing NUL bytes (0x00) are rejected (CorruptFileError) | Upload Hardening: Text files containing NUL bytes (0x00) are rejected (CorruptFileError) |
| **458** | `PASS` ✅ | Upload Quota: Blocks 51st upload when daily count quota (50 files/day) is reached | Upload Quota: Blocks 51st upload when daily count quota (50 files/day) is reached |
| **459** | `PASS` ✅ | Upload Quota: Blocks upload exceeding daily byte volume quota (100MB/day) | Upload Quota: Blocks upload exceeding daily byte volume quota (100MB/day) |
| **460** | `PASS` ✅ | Upload Quota: POST /api/files/upload returns 429 Too Many Requests when daily quota is exceeded | Upload Quota: POST /api/files/upload returns 429 Too Many Requests when daily quota is exceeded |
| **461** | `PASS` ✅ | Process Safety: Python process runner caps concurrency to max 2 concurrent jobs | Process Safety: Python process runner caps concurrency to max 2 concurrent jobs |
| **462** | `PASS` ✅ | Process Safety: Python runner provides process group kill on timeout | Process Safety: Python runner provides process group kill on timeout |
| **463** | `PASS` ✅ | Concurrency Hardening: All 30 parallel uploads are accepted with 202 and enqueued | Concurrency Hardening: All 30 parallel uploads are accepted with 202 and enqueued |
| **464** | `PASS` ✅ | Concurrency Hardening: Server remains responsive (200 OK) during and after 30 parallel uploads | Concurrency Hardening: Server remains responsive (200 OK) during and after 30 parallel uploads |
| **465** | `PASS` ✅ | Process Safety: 30 parallel uploads leave no orphan Python processes | Process Safety: 30 parallel uploads leave no orphan Python processes |

### Extended HTTP-Level E2E Workflows

*Category Summary: 25 Test Cases | 25 Assertions | 25 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **466** | `PASS` ✅ | E2E Auth: User successfully registered with token | E2E Auth: User successfully registered with token |
| **467** | `PASS` ✅ | E2E Auth: User login returns valid access token | E2E Auth: User login returns valid access token |
| **468** | `PASS` ✅ | E2E Auth: Authenticated profile retrieval matches user email | E2E Auth: Authenticated profile retrieval matches user email |
| **469** | `PASS` ✅ | E2E Session: POST /api/session creates new session | E2E Session: POST /api/session creates new session |
| **470** | `PASS` ✅ | E2E Session: GET /api/sessions lists created session | E2E Session: GET /api/sessions lists created session |
| **471** | `PASS` ✅ | E2E Session: GET /api/history/:id returns empty history initially | E2E Session: GET /api/history/:id returns empty history initially |
| **472** | `PASS` ✅ | E2E Chat SSE: POST /api/chat returns HTTP 200 OK | E2E Chat SSE: POST /api/chat returns HTTP 200 OK |
| **473** | `PASS` ✅ | E2E Chat SSE: Response header Content-Type is text/event-stream | E2E Chat SSE: Response header Content-Type is text/event-stream |
| **474** | `PASS` ✅ | E2E Chat SSE: Response header Cache-Control includes no-cache | E2E Chat SSE: Response header Cache-Control includes no-cache |
| **475** | `PASS` ✅ | E2E Chat SSE: Response header X-Accel-Buffering is no | E2E Chat SSE: Response header X-Accel-Buffering is no |
| **476** | `PASS` ✅ | E2E Chat SSE: Stream payload contains SSE chunk events | E2E Chat SSE: Stream payload contains SSE chunk events |
| **477** | `PASS` ✅ | E2E Chat SSE: Stream payload terminates with done event | E2E Chat SSE: Stream payload terminates with done event |
| **478** | `PASS` ✅ | E2E Chat: History persists exactly 2 messages (user + assistant turn) | E2E Chat: History persists exactly 2 messages (user + assistant turn) |
| **479** | `PASS` ✅ | E2E Chat: User message persisted with monotonic seq 1 | E2E Chat: User message persisted with monotonic seq 1 |
| **480** | `PASS` ✅ | E2E Chat: Assistant message persisted with monotonic seq 2 | E2E Chat: Assistant message persisted with monotonic seq 2 |
| **481** | `PASS` ✅ | E2E Upload: POST /api/files/upload accepts file with 202 and returns jobId & fileId | E2E Upload: POST /api/files/upload accepts file with 202 and returns jobId & fileId |
| **482** | `PASS` ✅ | E2E Upload: Async job queue processes and completes file extraction | E2E Upload: Async job queue processes and completes file extraction |
| **483** | `PASS` ✅ | E2E Upload: GET /api/files/:fileId returns document metadata and parsed chunks | E2E Upload: GET /api/files/:fileId returns document metadata and parsed chunks |
| **484** | `PASS` ✅ | E2E Memories: POST /api/memories creates new memory record | E2E Memories: POST /api/memories creates new memory record |
| **485** | `PASS` ✅ | E2E Memories: GET /api/memories lists created memory | E2E Memories: GET /api/memories lists created memory |
| **486** | `PASS` ✅ | E2E Memories: PUT /api/memories/:id updates memory fact | E2E Memories: PUT /api/memories/:id updates memory fact |
| **487** | `PASS` ✅ | E2E Memories: DELETE /api/memories/:id deletes memory | E2E Memories: DELETE /api/memories/:id deletes memory |
| **488** | `PASS` ✅ | E2E Memories: Memory successfully removed from datastore | E2E Memories: Memory successfully removed from datastore |
| **489** | `PASS` ✅ | E2E Session: DELETE /api/session/:id deletes session | E2E Session: DELETE /api/session/:id deletes session |
| **490** | `PASS` ✅ | E2E Session: Deleted session returns 404 on subsequent queries | E2E Session: Deleted session returns 404 on subsequent queries |

### Fault-Injecting Mock LLM Resiliency

*Category Summary: 8 Test Cases | 8 Assertions | 8 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **491** | `PASS` ✅ | Fault Injector: 429 Quota Exceeded is tracked as trippable rate limit failure without process crash | Fault Injector: 429 Quota Exceeded is tracked as trippable rate limit failure without process crash |
| **492** | `PASS` ✅ | Fault Injector: 500 Internal Server Error is intercepted and handled cleanly without unhandled rejection | Fault Injector: 500 Internal Server Error is intercepted and handled cleanly without unhandled rejection |
| **493** | `PASS` ✅ | Fault Injector: Slow first token triggers STREAM_FIRST_CHUNK_TIMEOUT and aborts stalled stream | Fault Injector: Slow first token triggers STREAM_FIRST_CHUNK_TIMEOUT and aborts stalled stream |
| **494** | `PASS` ✅ | Fault Injector: Mid-stream drop flags response with incomplete=true | Fault Injector: Mid-stream drop flags response with incomplete=true |
| **495** | `PASS` ✅ | Fault Injector: Mid-stream drop preserves partial flag | Fault Injector: Mid-stream drop preserves partial flag |
| **496** | `PASS` ✅ | Fault Injector: Partial chunks emitted prior to disconnect were captured | Fault Injector: Partial chunks emitted prior to disconnect were captured |
| **497** | `PASS` ✅ | Fault Injector: Malformed chunks (null, missing text) are safely ignored while valid chunk is retained | Fault Injector: Malformed chunks (null, missing text) are safely ignored while valid chunk is retained |
| **498** | `PASS` ✅ | Fault Injector: Empty response (0 tokens) completes gracefully without hanging or throwing | Fault Injector: Empty response (0 tokens) completes gracefully without hanging or throwing |

### Real Chat Route Adversarial Corpus Verification

*Category Summary: 1 Test Cases | 2 Assertions | 2 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **499** | `PASS` ✅ | Real Chat Route: 53-Payload Adversarial Corpus HTTP Verification (53 Inputs) | Real-Route Corpus: Passed 53/53 payloads through HTTP route (Pass rate: 100.0%) |
| **500** | `PASS` ✅ | Real Chat Route: 53-Payload Adversarial Corpus HTTP Verification (53 Inputs) | Real-Route Corpus: 100% of benign look-alikes pass cleanly through HTTP route without false positive blockage |

### Autocannon Load Performance & Event Loop Lag

*Category Summary: 3 Test Cases | 3 Assertions | 3 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **501** | `PASS` ✅ | Load Test: All 10 concurrent uploads accepted with 202 and enqueued during stream load | Load Test: All 10 concurrent uploads accepted with 202 and enqueued during stream load |
| **502** | `PASS` ✅ | Load Test: Event loop p95 lag (514.85ms) stays below safety threshold (< 2500ms under load/instrumentation) | Load Test: Event loop p95 lag (514.85ms) stays below safety threshold (< 2500ms under load/instrumentation) |
| **503** | `PASS` ✅ | Load Test: All 50 concurrent streams served successfully | Load Test: All 50 concurrent streams served successfully |

### Property-Based Testing (fast-check) Truncation Invariants

*Category Summary: 3 Test Cases | 3 Assertions | 3 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **504** | `PASS` ✅ | Fast-Check Property: Token estimation is strictly positive (>=1) and monotonic with repetition across 100 generative strings | Fast-Check Property: Token estimation is strictly positive (>=1) and monotonic with repetition across 100 generative strings |
| **505** | `PASS` ✅ | Fast-Check Property: Script-aware token estimator assigns non-Latin scripts density >= naive length/4 across 50 runs | Fast-Check Property: Script-aware token estimator assigns non-Latin scripts density >= naive length/4 across 50 runs |
| **506** | `PASS` ✅ | Fast-Check Property: Truncated history strictly adheres to token budget across 100 random multi-turn dialogues | Fast-Check Property: Truncated history strictly adheres to token budget across 100 random multi-turn dialogues |

### Model Configuration, Live Catalog Audit & Health Endpoint

*Category Summary: 50 Test Cases | 50 Assertions | 50 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **507** | `PASS` ✅ | Model Config: Primary Gemini model configured as "gemini-2.5-flash" | Model Config: Primary Gemini model configured as "gemini-2.5-flash" |
| **508** | `PASS` ✅ | Model Config: Full Gemini model list has 5 models with primary in 0th position | Model Config: Full Gemini model list has 5 models with primary in 0th position |
| **509** | `PASS` ✅ | Model Config: Primary Groq model configured as "qwen/qwen3.8-27b" | Model Config: Primary Groq model configured as "qwen/qwen3.8-27b" |
| **510** | `PASS` ✅ | Model Config: Groq fallback list excludes deprecated "groq/compound" | Model Config: Groq fallback list excludes deprecated "groq/compound" |
| **511** | `PASS` ✅ | Model Config: Embedding model configured as "gemini-embedding-001" | Model Config: Embedding model configured as "gemini-embedding-001" |
| **512** | `PASS` ✅ | Model Config: getModelConfigSummary returns valid structured config snapshot | Model Config: getModelConfigSummary returns valid structured config snapshot |
| **513** | `PASS` ✅ | Model Config: Simulating legacy invalid Groq model "groq/compound" | Model Config: Simulating legacy invalid Groq model "groq/compound" |
| **514** | `PASS` ✅ | Model Config: validateAndLogModelConfig handles deprecated model gracefully | Model Config: validateAndLogModelConfig handles deprecated model gracefully |
| **515** | `PASS` ✅ | Model Config: Warning logged loudly for deprecated model | Model Config: Warning logged loudly for deprecated model |
| **516** | `PASS` ✅ | Model Config: Automatically switched to alternative: "openai/gpt-oss-120b" | Model Config: Automatically switched to alternative: "openai/gpt-oss-120b" |
| **517** | `PASS` ✅ | Model Config: Fail fast mode throws loudly: "[Model Config] Fatal: Primary Groq model "compound" is deprecated or invalid, and no valid fallback exists." | Model Config: Fail fast mode throws loudly: "[Model Config] Fatal: Primary Groq model "compound" is deprecated or invalid, and no valid fallback exists." |
| **518** | `PASS` ✅ | Model Config: Strict validation fails loudly when configured primary model is deprecated | Model Config: Strict validation fails loudly when configured primary model is deprecated |
| **519** | `PASS` ✅ | Health Endpoint: GET /api/health returns HTTP 200 | Health Endpoint: GET /api/health returns HTTP 200 |
| **520** | `PASS` ✅ | Health Endpoint: reports status "ok" | Health Endpoint: reports status "ok" |
| **521** | `PASS` ✅ | Health Endpoint: reports active provider "gemini" | Health Endpoint: reports active provider "gemini" |
| **522** | `PASS` ✅ | Health Endpoint: reports Gemini primary model | Health Endpoint: reports Gemini primary model |
| **523** | `PASS` ✅ | Health Endpoint: reports Groq primary model | Health Endpoint: reports Groq primary model |
| **524** | `PASS` ✅ | Health Endpoint: reports configured embedding model | Health Endpoint: reports configured embedding model |
| **525** | `PASS` ✅ | Health Endpoint: reports circuit breaker state "CLOSED" | Health Endpoint: reports circuit breaker state "CLOSED" |
| **526** | `PASS` ✅ | Health Endpoint: reports breaker failure counter | Health Endpoint: reports breaker failure counter |
| **527** | `PASS` ✅ | Health Endpoint: reports Chroma status | Health Endpoint: reports Chroma status |
| **528** | `PASS` ✅ | Health Endpoint: reports Chroma bound URL | Health Endpoint: reports Chroma bound URL |
| **529** | `PASS` ✅ | Health Endpoint: reports store type | Health Endpoint: reports store type |
| **530** | `PASS` ✅ | Health Endpoint: reports store schemaVersion 2 | Health Endpoint: reports store schemaVersion 2 |
| **531** | `PASS` ✅ | Health Endpoint: reports sessions count | Health Endpoint: reports sessions count |
| **532** | `PASS` ✅ | Health Endpoint: reports users count | Health Endpoint: reports users count |
| **533** | `PASS` ✅ | Health Endpoint: reports memories count | Health Endpoint: reports memories count |
| **534** | `PASS` ✅ | Health Endpoint: reports store.lastPersistError as null when healthy | Health Endpoint: reports store.lastPersistError as null when healthy |
| **535** | `PASS` ✅ | Health Endpoint: returns HTTP 200 even when store is degraded | Health Endpoint: returns HTTP 200 even when store is degraded |
| **536** | `PASS` ✅ | Health Endpoint: reports status "degraded" when lastPersistError is present | Health Endpoint: reports status "degraded" when lastPersistError is present |
| **537** | `PASS` ✅ | Health Endpoint: surfaces store.lastPersistError with failure details | Health Endpoint: surfaces store.lastPersistError with failure details |
| **538** | `PASS` ✅ | Health Endpoint: status restores to "ok" once store persists successfully | Health Endpoint: status restores to "ok" once store persists successfully |
| **539** | `PASS` ✅ | Health Endpoint: store.lastPersistError cleared back to null after recovery | Health Endpoint: store.lastPersistError cleared back to null after recovery |
| **540** | `PASS` ✅ | Health Endpoint: backward-compatible top-level state "CLOSED" preserved | Health Endpoint: backward-compatible top-level state "CLOSED" preserved |
| **541** | `PASS` ✅ | Health Endpoint: backward-compatible top-level openUntil preserved | Health Endpoint: backward-compatible top-level openUntil preserved |
| **542** | `PASS` ✅ | Model Audit: checkModels executed with 17 models audited | Model Audit: checkModels executed with 17 models audited |
| **543** | `PASS` ✅ | Model Audit: Gemini 2.5 Flash ("gemini-2.5-flash") verified to EXIST on Gemini API | Model Audit: Gemini 2.5 Flash ("gemini-2.5-flash") verified to EXIST on Gemini API |
| **544** | `PASS` ✅ | Model Audit: Gemini Fallback #1 ("gemini-flash-latest") verified to EXIST on Gemini API | Model Audit: Gemini Fallback #1 ("gemini-flash-latest") verified to EXIST on Gemini API |
| **545** | `PASS` ✅ | Model Audit: Gemini Fallback #2 ("gemini-3.7-flash") verified to EXIST on Gemini API | Model Audit: Gemini Fallback #2 ("gemini-3.7-flash") verified to EXIST on Gemini API |
| **546** | `PASS` ✅ | Model Audit: Gemini Fallback #3 ("gemini-2.5-flash-lite") verified to EXIST on Gemini API | Model Audit: Gemini Fallback #3 ("gemini-2.5-flash-lite") verified to EXIST on Gemini API |
| **547** | `PASS` ✅ | Model Audit: Gemini Fallback #4 ("gemini-3.1-pro-preview") verified to EXIST on Gemini API | Model Audit: Gemini Fallback #4 ("gemini-3.1-pro-preview") verified to EXIST on Gemini API |
| **548** | `PASS` ✅ | Model Audit: Embedding model ("gemini-embedding-001") verified to EXIST on Gemini API | Model Audit: Embedding model ("gemini-embedding-001") verified to EXIST on Gemini API |
| **549** | `PASS` ✅ | Model Audit: Groq "qwen/qwen3.8-27b" verified to EXIST on Groq Cloud API | Model Audit: Groq "qwen/qwen3.8-27b" verified to EXIST on Groq Cloud API |
| **550** | `PASS` ✅ | Model Audit: Groq Fallback #1 ("openai/gpt-oss-120b") verified to EXIST on Groq Cloud API | Model Audit: Groq Fallback #1 ("openai/gpt-oss-120b") verified to EXIST on Groq Cloud API |
| **551** | `PASS` ✅ | Model Audit: Groq Fallback #2 ("openai/gpt-oss-20b") verified to EXIST on Groq Cloud API | Model Audit: Groq Fallback #2 ("openai/gpt-oss-20b") verified to EXIST on Groq Cloud API |
| **552** | `PASS` ✅ | Model Audit: Groq Fallback #3 ("allam-2-7b") verified to EXIST on Groq Cloud API | Model Audit: Groq Fallback #3 ("allam-2-7b") verified to EXIST on Groq Cloud API |
| **553** | `PASS` ✅ | Model Audit: Zero missing models across all configured active and fallback chains | Model Audit: Zero missing models across all configured active and fallback chains |
| **554** | `PASS` ✅ | Model Audit: Written audit output file exists in docs/ directory | Model Audit: Written audit output file exists in docs/ directory |
| **555** | `PASS` ✅ | Model Audit: Groq "compound" verified to NOT EXIST on Groq API (correctly flagged) | Model Audit: Groq "compound" verified to NOT EXIST on Groq API (correctly flagged) |
| **556** | `PASS` ✅ | Model Audit: Groq "groq/compound" verified to NOT EXIST on Groq API (correctly flagged) | Model Audit: Groq "groq/compound" verified to NOT EXIST on Groq API (correctly flagged) |

### Test Isolation & Production Store Protection

*Category Summary: 2 Test Cases | 2 Assertions | 2 Passed | 0 Failed*

| # | Status | Test Case / Scenario | Exact Assertion Name |
| :---: | :---: | :--- | :--- |
| **557** | `PASS` ✅ | Test Isolation: Production data/local_store.json hash remains completely unchanged after test suite execution | Test Isolation: Production store SHA-256 hash (b5b3663896164ed369a8cd7b9894c672c634292521548d40a6b52e4234384d05) matches initial hash (b5b3663896164ed369a8cd7b9894c672c634292521548d40a6b52e4234384d05) exactly; real store was not touched |
| **558** | `PASS` ✅ | Test Isolation: Refuses to run tests if DATA_DIR resolves to real production data directory | Test Isolation: Safety guard successfully throws and halts execution when DATA_DIR points to ./data |

