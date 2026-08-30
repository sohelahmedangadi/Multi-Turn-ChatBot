import { detectAmbiguity } from './server/services/ambiguityDetector.js';
import {
  getSessionContext,
  estimateTokenCount,
  truncateHistoryToTokenBudget,
} from './server/services/contextManager.js';
import {
  extractFactsFromMessage,
  processAndSaveUserMemories,
  searchUserMemories,
  searchKnowledgeBase,
  vectorizeText,
  calculateVectorCosineSimilarity,
  MEMORY_MAX_TOKENS,
} from './server/services/memoryManager.js';
import { extractFactsWithLangChain } from './server/services/langchainMemory.js';
import {
  calculateCoherenceScore,
  BENCHMARK_DATASET,
} from './server/services/evaluationSuite.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from './server/middleware/auth.js';
import { initDatabase, db } from './server/db/store.js';
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
  const lcFacts = await extractFactsWithLangChain('My name is Sohail and I am building an AI capstone called OmniTurn. I use React 19.');
  assert(
    lcFacts.some((f) => f.key === 'user_name' && f.fact.includes('Sohail')),
    'LangChain Extractor: Identifies user name "Sohail"'
  );
  assert(
    lcFacts.some((f) => f.key === 'project_name' && f.fact.includes('OmniTurn')),
    'LangChain Extractor: Identifies project name "OmniTurn"'
  );
  assert(
    lcFacts.some((f) => f.key === 'tech_stack' && f.fact.includes('React 19')),
    'LangChain Extractor: Identifies tech stack "React 19"'
  );

  // Save facts for User A
  await processAndSaveUserMemories(userA, 'My name is Sohail and I am building an AI capstone called OmniTurn. I use React 19.', 'sess_1');
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
