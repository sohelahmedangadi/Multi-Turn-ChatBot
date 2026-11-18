import fs from 'fs';
import path from 'path';

const storePath = path.resolve('data/local_store.json');
const backupPath = path.resolve('data/local_store.backup_pre_clean.json');

if (!fs.existsSync(storePath)) {
  console.error(`Store path does not exist: ${storePath}`);
  process.exit(1);
}

// Ensure backup exists
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(storePath, backupPath);
  console.log(`Created backup at: ${backupPath}`);
} else {
  console.log(`Verified pre-clean backup exists at: ${backupPath}`);
}

const rawData = fs.readFileSync(storePath, 'utf8');
const data = JSON.parse(rawData);

// Test identifiers
const testEmailDomains = ['@example.com', '@test.com', '@recovery.test'];

const testUserPrefixes = [
  'user_test_',
  'user_parallel_',
  'user_alpha_',
  'user_beta_',
  'user_auth_',
  'sec_user_',
  'cookie_sec_',
  'e2e_tester_',
  'corpus_guard_',
  'load_runner_',
  'smoke_',
  'u_test_',
  'user_recovery_',
  'test_user_',
  'perf_user_',
  'dummy_',
  'target_',
  'brute_',
  'lock_',
  'user_intercept_test_',
  'user-disconnect-test',
  'user-error-test',
  'user_stream_',
  'user_',
  'test-sec-user',
  'test-',
];

const testSessionPrefixes = [
  'sess_tokyo_past_',
  'sess_test_',
  'sess_parallel_',
  'sess_alpha_',
  'sess_beta_',
  'sess_allow_search_',
  'sess_concurrent_lock_',
  'sess_failed_turn_',
  'sess_auth_session_',
  'sess_e2e_',
  'sess_load_',
  'sess_orphan_',
  'sess_recovery_',
  'sess_intercept_',
  'test-sse-',
  'test-security-sess-',
  'test_',
  'test-',
];

const isTestUser = (user) => {
  if (!user) return true;
  const email = (user.email || '').toLowerCase();
  const username = (user.username || '').toLowerCase();
  const id = (user.id || '').toLowerCase();

  if (testEmailDomains.some((d) => email.endsWith(d) || email.includes(d))) return true;
  if (testUserPrefixes.some((p) => id.startsWith(p) || username.startsWith(p))) return true;
  return false;
};

const testUserIds = new Set();
const cleanUsers = [];
const deletedUsers = [];

for (const u of data.users || []) {
  if (isTestUser(u)) {
    testUserIds.add(u.id);
    deletedUsers.push(u);
  } else {
    cleanUsers.push(u);
  }
}

const isTestSession = (session) => {
  if (!session) return true;
  const id = session.id || '';
  const title = session.title || '';
  const uid = session.userId || '';

  if (testUserIds.has(uid)) return true;
  if (testSessionPrefixes.some((p) => id.startsWith(p))) return true;
  if (title.startsWith('Bench Session') || title.startsWith('User message turn') || title.startsWith('Hello turn')) return true;
  if (testUserPrefixes.some((p) => uid.startsWith(p))) return true;
  return false;
};

const cleanSessions = [];
const deletedSessions = [];

for (const s of data.sessions || []) {
  if (isTestSession(s)) {
    deletedSessions.push(s);
  } else {
    cleanSessions.push(s);
  }
}

const cleanSessionIds = new Set(cleanSessions.map((s) => s.id));
const cleanMessages = {};
let deletedMessageCount = 0;
let preservedMessageCount = 0;

for (const [sid, msgs] of Object.entries(data.messages || {})) {
  if (cleanSessionIds.has(sid)) {
    cleanMessages[sid] = msgs;
    preservedMessageCount += msgs.length;
  } else {
    deletedMessageCount += msgs.length;
  }
}

const cleanMemories = {};
let deletedMemoryCount = 0;
let preservedMemoryCount = 0;

const isTestMemory = (m) => {
  if (!m) return true;
  const key = (m.key || '').toLowerCase();
  if (key.startsWith('pref_bench_') || key.startsWith('test_') || key.startsWith('pref_key_') || key.startsWith('alpha_') || key.startsWith('canary_')) return true;
  return false;
};

for (const [uid, mems] of Object.entries(data.memories || {})) {
  if (testUserIds.has(uid) || testUserPrefixes.some((p) => uid.startsWith(p))) {
    deletedMemoryCount += Array.isArray(mems) ? mems.length : 0;
  } else {
    const validMems = (Array.isArray(mems) ? mems : []).filter((m) => {
      if (isTestMemory(m)) {
        deletedMemoryCount++;
        return false;
      }
      preservedMemoryCount++;
      return true;
    });
    if (validMems.length > 0) {
      cleanMemories[uid] = validMems;
    }
  }
}

console.log('\n======================================================');
console.log('📊 DATA CLEANING DIFF (BEFORE vs AFTER)');
console.log('======================================================');
console.log(`Users:`);
console.log(`  Before: ${data.users ? data.users.length : 0}`);
console.log(`  After:  ${cleanUsers.length}`);
console.log(`  Diff:   -${deletedUsers.length} test users removed`);

console.log(`\nSessions:`);
console.log(`  Before: ${data.sessions ? data.sessions.length : 0}`);
console.log(`  After:  ${cleanSessions.length}`);
console.log(`  Diff:   -${deletedSessions.length} test sessions removed`);

console.log(`\nMessages:`);
console.log(`  Before: ${Object.keys(data.messages || {}).length} session threads (${deletedMessageCount + preservedMessageCount} messages)`);
console.log(`  After:  ${Object.keys(cleanMessages).length} session threads (${preservedMessageCount} messages)`);
console.log(`  Diff:   -${Object.keys(data.messages || {}).length - Object.keys(cleanMessages).length} threads (-${deletedMessageCount} test messages removed)`);

console.log(`\nMemories:`);
console.log(`  Before: ${Object.keys(data.memories || {}).length} user maps (${deletedMemoryCount + preservedMemoryCount} memories)`);
console.log(`  After:  ${Object.keys(cleanMemories).length} user maps (${preservedMemoryCount} memories)`);
console.log(`  Diff:   -${Object.keys(data.memories || {}).length - Object.keys(cleanMemories).length} user maps (-${deletedMemoryCount} test memories removed)`);

console.log('\nPreserved Sessions:');
for (const s of cleanSessions) {
  const msgCount = cleanMessages[s.id] ? cleanMessages[s.id].length : 0;
  console.log(`  - [${s.id}] "${s.title}" (userId: ${s.userId}, messages: ${msgCount}, created: ${s.createdAt})`);
}

// Build clean payload
const cleanPayload = {
  schemaVersion: data.schemaVersion || 2,
  version: data.version || 2,
  savedAt: new Date().toISOString(),
  users: cleanUsers,
  sessions: cleanSessions,
  messages: cleanMessages,
  rubrics: data.rubrics || [],
  memories: cleanMemories,
};

if (process.argv.includes('--apply')) {
  fs.writeFileSync(storePath, JSON.stringify(cleanPayload, null, 2), 'utf8');
  console.log(`\n✅ APPLIED: Clean store written to ${storePath}`);
} else {
  console.log('\n🔍 DRY-RUN MODE: Pass --apply to write changes to disk.');
}
