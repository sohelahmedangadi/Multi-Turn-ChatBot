import fs from 'fs';
import path from 'path';

const storePath = path.resolve('data/local_store.json');
const backupPath = path.resolve('data/local_store.backup_pre_clean.json');

if (!fs.existsSync(storePath)) {
  console.log('data/local_store.json does not exist');
  process.exit(1);
}

// Backup first!
fs.copyFileSync(storePath, backupPath);
console.log(`Backed up data/local_store.json to ${backupPath}`);

const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));

console.log('Current store stats:');
console.log('- schemaVersion:', data.schemaVersion);
console.log('- users:', data.users ? data.users.length : 0);
console.log('- sessions:', data.sessions ? data.sessions.length : 0);
console.log('- messages sessions:', data.messages ? Object.keys(data.messages).length : 0);
console.log('- memories users:', data.memories ? Object.keys(data.memories).length : 0);
console.log('- rubrics:', data.rubrics ? data.rubrics.length : 0);

// Let's inspect users
const testUserPatterns = [
  /@example\.com/i,
  /^user_test_/i,
  /^user_parallel_/i,
  /^user_alpha_/i,
  /^user_beta_/i,
  /^corpus_guard_/i,
  /^load_runner_/i,
  /^e2e_tester_/i,
  /^cookie_user_/i,
  /^auth_user_/i,
  /^target_/i,
  /^user_recovery_canary/i,
  /^valid_user_/i,
  /^user_73bytes_/i,
  /^test_user_/i,
  /^perf_user_/i,
  /^stress_/i,
  /^brute_/i,
  /^lock_/i,
  /^sess_/i,
  /^dummy_/i
];

const testUsers = [];
const nonTestUsers = [];

for (const u of (data.users || [])) {
  const isTest = testUserPatterns.some(p => p.test(u.email || '') || p.test(u.username || '') || p.test(u.id || ''));
  if (isTest) {
    testUsers.push(u);
  } else {
    nonTestUsers.push(u);
  }
}

console.log(`\nUsers breakdown:`);
console.log(`- Test users: ${testUsers.length}`);
console.log(`- Non-test users: ${nonTestUsers.length}`);
console.log('Non-test users:');
for (const u of nonTestUsers) {
  console.log(`  ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`);
}

// Let's inspect sessions
const testSessionPatterns = [
  /^sess_test/i,
  /^sess_parallel/i,
  /^sess_alpha_/i,
  /^sess_beta_/i,
  /^sess_allow_search/i,
  /^sess_concurrent_lock/i,
  /^sess_failed_turn/i,
  /^sess_auth_session/i,
  /^sess_e2e_/i,
  /^sess_load_/i,
  /^sess_n9r0/i,
  /^sess_57aql/i,
  /^sess_recovery/i,
  /^sess_orphan/i,
  /^test_/i,
];

let testSessionsCount = 0;
let nonTestSessionsCount = 0;
const nonTestSessions = [];

for (const s of (data.sessions || [])) {
  const isTest = testSessionPatterns.some(p => p.test(s.id || '') || p.test(s.title || '')) ||
                 testUsers.some(u => u.id === s.userId);
  if (isTest) {
    testSessionsCount++;
  } else {
    nonTestSessionsCount++;
    nonTestSessions.push(s);
  }
}

console.log(`\nSessions breakdown:`);
console.log(`- Test sessions: ${testSessionsCount}`);
console.log(`- Non-test sessions: ${nonTestSessionsCount}`);
console.log('Non-test sessions (sample):', nonTestSessions.slice(0, 10).map(s => ({ id: s.id, title: s.title, userId: s.userId })));
