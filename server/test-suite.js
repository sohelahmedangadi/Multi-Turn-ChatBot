import { detectAmbiguity } from './services/ambiguityDetector.js';
import {
  tavilySearch,
  formatTavilyResultsForContext,
  formatThinResultsWarning,
  extractGeminiGroundingSources,
  extractSearchQueryFromText,
  isIdentityOrFactualQuery,
  checkForUnverifiedFactualClaims,
  isTavilyConfigured,
} from './services/webSearchService.js';
import { classifyInput } from './services/inputClassifier.js';
import {
  getSessionContext,
  estimateTokenCount,
  truncateHistoryToTokenBudget,
} from './services/contextManager.js';
import {
  extractFactsFromMessage,
  processAndSaveUserMemories,
  searchUserMemories,
  searchKnowledgeBase,
  vectorizeText,
  calculateVectorCosineSimilarity,
  MEMORY_MAX_TOKENS,
} from './services/memoryManager.js';
import { extractFactsWithLangChain } from './services/langchainMemory.js';
import {
  calculateCoherenceScore,
  BENCHMARK_DATASET,
} from './services/evaluationSuite.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from './middleware/auth.js';
import { initDatabase, db } from './db/store.js';
import { parseFileContent } from './services/fileParser.js';
import { indexDocument, retrieveRelevantChunks, getDocumentMetadata } from './services/ragService.js';
import fs from 'fs';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
    results.push(`PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    results.push(`FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING LANGCHAIN & 3-TIER MEMORY CAPSTONE TEST SUITE');
  console.log('======================================================\n');

  // Initialize DB & Seed Knowledge Base
  await initDatabase();

  // ----------------------------------------------------
  // 1. Ambiguity Detector Unit Tests
  // ----------------------------------------------------
  console.log('📦 Testing Ambiguity Detector (server/services/ambiguityDetector.js):');
  const amb1 = detectAmbiguity('', []);
  assert(amb1.isAmbiguous, 'Detects empty string as ambiguous');

  const amb2 = detectAmbiguity('What about that?', []);
  assert(amb2.isAmbiguous, 'Flags "What about that?" as ambiguous when context is empty');
  assert(
    amb2.suggestedClarification.includes('Could you clarify'),
    'Returns targeted clarifying question'
  );

  const amb3 = detectAmbiguity('What about that?', [
    { role: 'user', content: 'Tell me about the Tokyo itinerary on day 2.' },
    { role: 'assistant', content: 'On day 2 you visit Shibuya and Shinjuku.' },
  ]);
  assert(
    !amb3.isAmbiguous,
    'Passes vague question to LLM if prior context has sufficient detail'
  );

  const amb4 = detectAmbiguity('Write a TypeScript function to reverse a linked list.', []);
  assert(!amb4.isAmbiguous, 'Recognizes specific non-ambiguous queries without needing clarification');

  // ----------------------------------------------------
  // 2. LangChain Fact Extractor & 3-Tier Memory Tests
  // ----------------------------------------------------
  console.log('\n🦜 Testing LangChain Fact Extractor (server/services/langchainMemory.js):');
  const userA = 'user_test_alpha_' + Date.now();
  const userB = 'user_test_beta_' + Date.now();

  // Test LangChain extraction
  const lcFacts = await extractFactsWithLangChain('My name is Sohail and I am building an AI capstone called CosmoAI. I use React 19.');
  assert(
    lcFacts.some((f) => f.key === 'user_name' && f.fact.includes('Sohail')),
    'LangChain Extractor: Identifies user name "Sohail"'
  );
  assert(
    lcFacts.some((f) => f.key === 'project_name' && f.fact.includes('CosmoAI')),
    'LangChain Extractor: Identifies project name "CosmoAI"'
  );
  assert(
    lcFacts.some((f) => f.key === 'tech_stack' && f.fact.includes('React 19')),
    'LangChain Extractor: Identifies tech stack "React 19"'
  );

  // Save facts for User A
  await processAndSaveUserMemories(userA, 'My name is Sohail and I am building an AI capstone called CosmoAI. I use React 19.', 'sess_1');
  const userAMemories = await db.getUserMemories(userA);
  assert(userAMemories.length === 3, 'User A has exactly 3 structured long-term memories persisted');

  // Conflict Resolution / Renaming Test
  await processAndSaveUserMemories(userA, 'I renamed my project to ApexBot.', 'sess_1');
  const updatedMemories = await db.getUserMemories(userA);
  assert(
    updatedMemories.length === 3,
    'Conflict Resolution: Updates project_name in place without creating duplicate memory'
  );
  const projMem = updatedMemories.find((m) => m.key === 'project_name');
  assert(projMem && projMem.fact.includes('ApexBot'), 'Project memory value updated to "ApexBot"');

  // Explicit Forget Directive
  await processAndSaveUserMemories(userA, 'Forget my tech stack', 'sess_1');
  const memoriesAfterForget = await db.getUserMemories(userA);
  assert(
    !memoriesAfterForget.some((m) => m.key === 'tech_stack'),
    'Explicit Forget: Successfully deleted tech_stack memory upon user request'
  );

  // User Isolation Test (User B must NOT see User A's memories)
  const userBMemories = await searchUserMemories(userB, 'What was the name of my project?');
  assert(userBMemories.length === 0, 'Cross-User Isolation: User B cannot access User A memories');

  // Semantic Vector Retrieval for User A in Brand New Session
  const userASearch = await searchUserMemories(userA, 'What is the name of my project?');
  assert(userASearch.length > 0, 'Semantic Search: Retrieves relevant memory for User A');
  assert(userASearch[0].fact.includes('ApexBot'), 'Retrieved memory contains correct project "ApexBot"');

  // Context Assembler integration
  const assembledContext = await getSessionContext('sess_empty_new_tab', 'What is my name and project?', userA);
  assert(
    assembledContext.relevantMemories.length > 0,
    'Context Assembler embeds retrieved Tier 2 memories into context'
  );
  assert(
    assembledContext.contextualMemorySection.includes('Sohail') &&
      assembledContext.contextualMemorySection.includes('ApexBot'),
    'Context section contains both user name and project name for LLM grounding'
  );

  // Cross-Session Previous Chat History Recall Test
  const pastSessionId = 'sess_tokyo_past_' + Date.now();
  await db.createSession({
    id: pastSessionId,
    userId: userA,
    title: 'Tokyo Trip Planning',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 2,
  });
  await db.saveMessage({
    id: 'msg_tokyo_1',
    sessionId: pastSessionId,
    role: 'user',
    content: 'What is the best itinerary for Tokyo day 1?',
    timestamp: new Date().toISOString(),
  });
  await db.saveMessage({
    id: 'msg_tokyo_2',
    sessionId: pastSessionId,
    role: 'assistant',
    content: 'Day 1 itinerary covers Shibuya, Meiji Shrine, and Shinjuku.',
    timestamp: new Date().toISOString(),
  });

  const activeNewSessionId = 'sess_current_active_' + Date.now();
  const pastChatContext = await getSessionContext(
    activeNewSessionId,
    'What did we discuss in our previous chat about Tokyo?',
    userA
  );
  assert(
    pastChatContext.allPastConversations && pastChatContext.allPastConversations.length > 0,
    'Full Past History Access: Retrieves complete past conversation sessions with messages'
  );
  assert(
    pastChatContext.contextualMemorySection.includes('FULL CATALOG OF USER\'S PAST CONVERSATIONS') &&
      pastChatContext.contextualMemorySection.includes('Tokyo Trip Planning') &&
      pastChatContext.contextualMemorySection.includes('Shibuya'),
    'Context Assembler embeds full past conversation history catalog into LLM context prompt'
  );

  // Tier 3 Knowledge Base Search
  const kbResults = await searchKnowledgeBase('How does ambiguity detection work?');
  assert(kbResults.length > 0, 'Tier 3 Knowledge Base: Retrieves domain architecture chunk');
  assert(
    kbResults[0]?.title?.includes('Ambiguity') || kbResults[0]?.content?.includes('ambiguity'),
    'Tier 3 chunk matches Ambiguity Heuristic domain topic'
  );

  // ----------------------------------------------------
  // 3. Context Truncation & Token Budgeting
  // ----------------------------------------------------
  console.log('\n📦 Testing Context Truncation & Token Budgeting:');
  const est = estimateTokenCount('Hello world! This is a test message.');
  assert(est === Math.ceil('Hello world! This is a test message.'.length / 4), 'Estimates tokens correctly (text.length / 4)');

  const mockLongHistory = [];
  for (let i = 0; i < 20; i++) {
    mockLongHistory.push({ role: 'user', content: `User long message number ${i} `.repeat(20) });
    mockLongHistory.push({ role: 'assistant', content: `Assistant long response number ${i} `.repeat(20) });
  }
  const truncation = truncateHistoryToTokenBudget(mockLongHistory, 400);
  assert(truncation.tokensUsed <= 400, 'Truncation strictly enforces token budget limit');
  assert(truncation.droppedTurns > 0, 'Drops older turns in paired fashion to stay within budget');

  // ----------------------------------------------------
  // 4. Auth & Security Tests
  // ----------------------------------------------------
  console.log('\n📦 Testing Auth & Security (server/middleware/auth.js):');
  const rawPw = 'SuperSecret123!';
  const hashed = await hashPassword(rawPw);
  assert(hashed !== rawPw && hashed.startsWith('$2'), 'Hashes password securely with bcrypt salt');

  const isMatch = await verifyPassword(rawPw, hashed);
  assert(isMatch, 'Verifies valid password against bcrypt hash');

  const isWrong = await verifyPassword('WrongPw123!', hashed);
  assert(!isWrong, 'Rejects invalid password attempt');

  const token = generateToken({ id: 'user_test_99', username: 'tester', email: 't@example.com' });
  const parts = token.split('.');
  assert(parts.length === 3, 'Generates valid 3-part signed JWT token');

  // ----------------------------------------------------
  // 5. Evaluation Suite Tests
  // ----------------------------------------------------
  console.log('\n📦 Testing Evaluation Suite & Coherence Engine:');
  assert(BENCHMARK_DATASET.length === 5, 'Contains 5 comprehensive standard benchmark scenarios');

  const coh = calculateCoherenceScore(
    [{ role: 'user', content: 'I am building a React app with TypeScript state management.' }],
    'Can you recommend a library?',
    'For React and TypeScript state management, Zustand and Redux Toolkit are top choices.'
  );
  assert(coh.score > 0.6, `Computes high coherence score (${coh.score}) for context-aligned responses`);

  // ----------------------------------------------------
  // 6. File Parser & LangChain RAG Document Analysis Tests
  // ----------------------------------------------------
  console.log('\n📦 Testing File Parser & LangChain RAG Document Pipeline:');
  const sampleDocText = `
CosmoAI Architecture Report
Version: 2.5
CosmoAI utilizes an advanced multi-turn state engine with LangChain integration.
The system is built on a 3-tier memory hierarchy: Tier 1 Short-Term History, Tier 2 Long-Term User Facts, and Tier 3 Domain Knowledge.
Additionally, the system includes a zero-latency heuristic ambiguity filter that asks clarifying questions.
File Upload and RAG Analysis allows users to attach PDFs, code files, and CSV datasets.
`;

  // 1. Test parsing text document
  const parsedFile = await parseFileContent(Buffer.from(sampleDocText, 'utf-8'), 'architecture_report.txt', 'text/plain');
  assert(parsedFile.fileType === 'text', 'File Parser: Detects text file type accurately');
  assert(parsedFile.wordCount > 10, 'File Parser: Computes word count correctly');
  assert(parsedFile.textContent.includes('CosmoAI Architecture Report'), 'File Parser: Extracts document body text cleanly');

  // 2. Test LangChain indexing & chunking
  const testDocId = 'doc_test_rag_' + Date.now();
  const indexed = await indexDocument(testDocId, parsedFile, userA);
  assert(indexed.totalChunks >= 1, 'LangChain RAG: Chunks document using RecursiveCharacterTextSplitter');

  // 3. Test RAG Semantic Keyword Retrieval
  const retrievedExcerpts = retrieveRelevantChunks(testDocId, 'How does ambiguity filter work?');
  assert(retrievedExcerpts.length > 0, 'LangChain RAG: Retrieves relevant chunk matching query keywords');
  assert(
    retrievedExcerpts[0]?.content?.includes('ambiguity'),
    'LangChain RAG: Top retrieved chunk contains relevant ambiguity filter details'
  );

  // 4. Test Context Manager RAG Integration
  const ragSessionId = 'sess_rag_' + Date.now();
  const ragContext = await getSessionContext(
    ragSessionId,
    'What does the report say about memory hierarchy?',
    userA,
    { fileId: testDocId }
  );
  assert(
    ragContext.relevantDocumentChunks && ragContext.relevantDocumentChunks.length > 0,
    'Context Assembler: Successfully retrieves RAG document chunks for attached file'
  );
  assert(
    ragContext.contextualMemorySection.includes('[UPLOADED DOCUMENT CONTEXT (RAG)]') &&
      ragContext.contextualMemorySection.includes('architecture_report.txt'),
    'Context Assembler: Embeds [UPLOADED DOCUMENT CONTEXT (RAG)] section into LLM context prompt'
  );

  // 5. Test Anti-Hallucination Guardrail on Empty/Missing File
  const emptyGuardContext = await getSessionContext(
    ragSessionId,
    'What does this document contain?',
    userA,
    { fileId: 'doc_empty_dummy_123' }
  );
  assert(
    emptyGuardContext.contextualMemorySection.includes('[ATTACHED DOCUMENT NOTICE - EXTRACTION FAILED / EMPTY]') &&
      emptyGuardContext.contextualMemorySection.includes('DO NOT GUESS'),
    'Anti-Hallucination Guardrail: Injects strict extraction failure directive when document text is empty'
  );

  // ----------------------------------------------------
  // 7. Web Search Grounding & Tavily Fallback Unit Tests
  // ----------------------------------------------------
  console.log('\n🌐 Testing Web Search Grounding & Tavily Fallback (server/services/webSearchService.js):');

  // Test 1: Gemini Grounding Metadata Extractor
  const mockGeminiResponse = {
    candidates: [
      {
        content: { parts: [{ text: 'React 19 was released in December 2024.' }] },
        groundingMetadata: {
          webSearchQueries: ['React 19 release date', 'React 19 official announcements'],
          groundingChunks: [
            { web: { title: 'React 19 Official Blog', uri: 'https://react.dev/blog/2024/12/05/react-19' } },
            { web: { title: 'React 19 Upgrade Guide', uri: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide' } },
          ],
        },
      },
    ],
  };

  const groundingResult = extractGeminiGroundingSources(mockGeminiResponse);
  assert(
    groundingResult.usedWebSearch === true &&
      groundingResult.searchQueries.length === 2 &&
      groundingResult.sources.length === 2 &&
      groundingResult.sources[0].url === 'https://react.dev/blog/2024/12/05/react-19',
    'Gemini Grounding: Extracts webSearchQueries and citation sources from groundingMetadata'
  );

  // Test 2: Gemini Grounding Unused Detection
  const mockUngroundedResponse = {
    candidates: [{ content: { parts: [{ text: '2 + 2 equals 4.' }] } }],
  };
  const ungroundedResult = extractGeminiGroundingSources(mockUngroundedResponse);
  assert(
    ungroundedResult.usedWebSearch === false &&
      ungroundedResult.searchQueries.length === 0 &&
      ungroundedResult.sources.length === 0,
    'Gemini Grounding: Correctly flags ungrounded responses as usedWebSearch = false'
  );

  // Test 3: Tavily API Graceful Degradation on Missing Key
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = '';
  const noKeyResult = await tavilySearch('latest SpaceX launch');
  assert(
    noKeyResult.error &&
      noKeyResult.error.includes('Missing TAVILY_API_KEY') &&
      Array.isArray(noKeyResult.results) &&
      noKeyResult.results.length === 0,
    'Tavily Search: Gracefully handles missing API key without throwing exceptions'
  );
  process.env.TAVILY_API_KEY = originalTavilyKey || '';

  // Test 4: Tavily Results Formatter
  const mockTavilyData = {
    results: [
      {
        title: 'Starship Flight 7 Updates',
        content: 'SpaceX completed the seventh test flight of Starship with super heavy booster catch.',
        url: 'https://spacex.com/launches/starship-flight-7',
      },
    ],
    answer: 'SpaceX Starship Flight 7 took place in early 2025.',
    error: null,
  };
  const formattedTavily = formatTavilyResultsForContext(mockTavilyData);
  assert(
    formattedTavily.includes('[VERIFIED WEB SEARCH RESULTS (via Tavily)]') &&
      formattedTavily.includes('Starship Flight 7 Updates') &&
      formattedTavily.includes('https://spacex.com/launches/starship-flight-7') &&
      formattedTavily.includes('Direct Summary Answer:') &&
      formattedTavily.includes('Cite the source URLs'),
    'Tavily Search: formatTavilyResultsForContext formats direct answers, summaries, and URLs for context injection'
  );

  // Test 5: Groq Search Query Regex Extractor
  const q1 = extractSearchQueryFromText('I need to search for this: [SEARCH: "Next.js 16 changelog"]');
  const q2 = extractSearchQueryFromText('Let me check:\n```web_search\nquery: "React 19 features"\n```');
  const q3 = extractSearchQueryFromText('web_search(query="Tavily API documentation")');
  assert(
    q1 === 'Next.js 16 changelog' &&
      q2 === 'React 19 features' &&
      q3 === 'Tavily API documentation',
    'Groq Regex Extractor: Accurately parses search queries from bracket tags, markdown blocks, and function calls'
  );

  // Test 6: Identity / Factual Query Pre-Classifier
  const id1 = isIdentityOrFactualQuery('who is Farak from MTV Hustle 5');
  const id2 = isIdentityOrFactualQuery('what is the real name of Eminem');
  const id3 = isIdentityOrFactualQuery('who plays Spider-Man in MCU');
  const id4 = isIdentityOrFactualQuery('What is 15 multiplied by 37?');
  assert(
    id1 === true && id2 === true && id3 === true && id4 === false,
    'Identity Query Pre-Classifier: Accurately flags biographical/contestant/real-name queries for mandatory search while passing math queries'
  );

  // Test 7: Thin / Empty Results Warning Formatter
  const thinWarning = formatThinResultsWarning('Farak MTV Hustle', 'No direct match found');
  assert(
    thinWarning.includes('[SEARCH NOTICE - LIMITED/UNVERIFIED SEARCH RESULTS') &&
      thinWarning.includes('Do NOT guess') &&
      thinWarning.includes('could not be verified'),
    'Thin Results Formatter: Injects strict anti-hallucination directive when search yields sparse data'
  );

  // Test 8: Zero-Source Unverified Factual Claim Guard
  const claim1 = checkForUnverifiedFactualClaims('His real name is Mayur Chitte and he is an artist.', [], false);
  const claim2 = checkForUnverifiedFactualClaims('His real name is Marshall Mathers.', [{ title: 'Bio', url: 'https://bio.com' }], true);
  assert(
    claim1.hasUnverifiedClaim === true &&
      claim1.warning.includes('could not be verified') &&
      claim2.hasUnverifiedClaim === false,
    'Unverified Claim Guard: Flags ungrounded real-name assertions made without search citations'
  );

  // ----------------------------------------------------
  // 8. Input Classifier Unit Tests (server/services/inputClassifier.js)
  // ----------------------------------------------------
  console.log('\n🧠 Testing Upstream Input Classifier (server/services/inputClassifier.js):');

  // Test 1: Identity query -> needsWebSearch = true
  const c1 = classifyInput('who is Farak from MTV Hustle 5');
  assert(
    c1.needsWebSearch === true && c1.reason === 'identity_biographical_lookup' && c1.confidence === 'high',
    'Input Classifier: Correctly classifies identity/biographical query as needsWebSearch = true'
  );

  // Test 2: Casual greeting -> needsWebSearch = false
  const c2 = classifyInput('hello there, good morning!');
  assert(
    c2.needsWebSearch === false && c2.reason === 'casual_greeting' && c2.confidence === 'high',
    'Input Classifier: Correctly classifies casual greeting as needsWebSearch = false'
  );

  // Test 3: Coding help -> needsWebSearch = false
  const c3 = classifyInput('how to fix a React useEffect infinite loop bug in javascript');
  assert(
    c3.needsWebSearch === false && c3.reason === 'code_help' && c3.confidence === 'high',
    'Input Classifier: Correctly classifies coding help request as needsWebSearch = false'
  );

  // Test 4: Current events keyword -> needsWebSearch = true
  const c4 = classifyInput('what is the latest release version of Next.js in 2026?');
  assert(
    c4.needsWebSearch === true && c4.reason === 'current_events_time_sensitive' && c4.confidence === 'high',
    'Input Classifier: Correctly classifies current events keyword query as needsWebSearch = true'
  );

  // Test 5: Ambiguous query -> defaults needsWebSearch = true with confidence = 'low'
  const c5 = classifyInput('what about the secret project AlphaZ?');
  assert(
    c5.needsWebSearch === true && c5.confidence === 'low',
    'Input Classifier: Ambiguous queries safely default to needsWebSearch = true with confidence = low'
  );

  // Write results out to error.md
  const report = `# Test Run Report (${new Date().toISOString()})\n\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}\n\n` +
    results.map((r) => `- ${r}`).join('\n');
  fs.writeFileSync('error.md', report);

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('📄 Results synced to error.md');
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runner error:', err);
  process.exit(1);
});
