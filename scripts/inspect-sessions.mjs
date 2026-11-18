import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/local_store.backup_pre_clean.json', 'utf8'));

console.log('Total sessions:', data.sessions.length);

// Group sessions by userId or characteristics
const sessionsByUser = {};
for (const s of data.sessions) {
  sessionsByUser[s.userId] = (sessionsByUser[s.userId] || 0) + 1;
}

console.log('\nSessions by userId:');
for (const [uid, count] of Object.entries(sessionsByUser)) {
  if (count > 1 || uid === 'guest-user-default' || !uid.includes('test')) {
    console.log(`- "${uid}": ${count} sessions`);
  }
}

// Find sessions with guest-user-default or non-test
const guestSessions = data.sessions.filter(s => s.userId === 'guest-user-default' || !s.userId || s.userId === 'default-user');
console.log(`\nGuest or default user sessions: ${guestSessions.length}`);
for (const s of guestSessions) {
  console.log(`  [${s.id}] "${s.title}" (created: ${s.createdAt || s.updatedAt || 'n/a'})`);
}
