import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function getDataDir() {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '../../data');
}

export function getLocalStorePath() {
  return path.join(getDataDir(), 'local_store.json');
}

export function getLocalStoreBackupPath() {
  return path.join(getDataDir(), 'local_store.backup.json');
}

export let LOCAL_STORE_PATH = getLocalStorePath();
export let LOCAL_STORE_BACKUP_PATH = getLocalStoreBackupPath();

export function updateStorePaths() {
  LOCAL_STORE_PATH = getLocalStorePath();
  LOCAL_STORE_BACKUP_PATH = getLocalStoreBackupPath();
}

// Current schema version
export const CURRENT_SCHEMA_VERSION = 2;

// In-memory persistent stores
const inMemoryUsers = new Map();
const inMemorySessions = new Map();
const inMemoryMessages = new Map(); // sessionId -> messages
const inMemoryRubrics = new Map();
const inMemoryMemories = new Map(); // userId -> Map(normalizedKey -> Memory)
const compoundMemoryIndex = new Map(); // `${userId}:::${normalizedKey}` -> Memory
const memoryIdIndex = new Map(); // memoryId -> Memory
const inMemoryKnowledge = new Map(); // id -> KnowledgeChunk
const inMemoryFileMetadata = new Map(); // fileId -> FileMetadata
const inMemoryFileJobs = new Map(); // jobId -> FileJob
const inMemoryDocumentChunks = new Map(); // chunkId -> DocumentChunk
const inMemoryParses = new Map(); // `${userId}:${sha256}` -> ParsedDocument

export function clearInMemoryStore() {
  inMemoryUsers.clear();
  inMemorySessions.clear();
  inMemoryMessages.clear();
  inMemoryRubrics.clear();
  inMemoryMemories.clear();
  compoundMemoryIndex.clear();
  memoryIdIndex.clear();
  inMemoryKnowledge.clear();
  inMemoryFileMetadata.clear();
  inMemoryFileJobs.clear();
  inMemoryDocumentChunks.clear();
  inMemoryParses.clear();
  isStoreDirty = false;
  lastPersistError = null;
  renameInterceptorForTesting = null;
  writeInterceptorForTesting = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Case-insensitive memory key normalizer.
 * Preserves strict case-insensitive deduplication and lookup:
 * "Tech Stack" -> "tech_stack", "PREFERRED_LLM" -> "preferred_llm"
 */
export function normalizeMemoryKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Compound index key generator for (userId, key)
 */
export function makeCompoundMemoryKey(userId, key) {
  return `${userId || 'unknown'}:::${normalizeMemoryKey(key)}`;
}

/**
 * Index a memory into compound and ID maps in O(1)
 */
function indexMemory(mem) {
  if (!mem || !mem.userId || !mem.key) return;
  const cleanKey = normalizeMemoryKey(mem.key);
  mem.key = cleanKey;
  let userMap = inMemoryMemories.get(mem.userId);
  if (!userMap) {
    userMap = new Map();
    inMemoryMemories.set(mem.userId, userMap);
  }
  userMap.set(cleanKey, mem);
  compoundMemoryIndex.set(makeCompoundMemoryKey(mem.userId, cleanKey), mem);
  if (mem.id) {
    memoryIdIndex.set(mem.id, mem);
  }
}

/**
 * Unindex a memory from compound and ID maps in O(1)
 */
function unindexMemory(mem) {
  if (!mem) return;
  const cleanKey = normalizeMemoryKey(mem.key);
  if (mem.userId) {
    const userMap = inMemoryMemories.get(mem.userId);
    if (userMap) {
      userMap.delete(cleanKey);
    }
    compoundMemoryIndex.delete(makeCompoundMemoryKey(mem.userId, cleanKey));
  }
  if (mem.id) {
    memoryIdIndex.delete(mem.id);
  }
}

// Default initial domain knowledge chunks (Tier 3)
const DEFAULT_KNOWLEDGE_CHUNKS = [
  {
    id: 'kb_1_architecture',
    title: 'CosmoAI Multi-Turn Architecture',
    content: 'CosmoAI uses a 3-tier memory system: Tier 1 is recent turn history, Tier 2 is long-term user memories extracted across sessions, and Tier 3 is domain knowledge.',
    category: 'architecture',
    tags: ['architecture', 'memory', 'tiers', 'context'],
  },
  {
    id: 'kb_2_ambiguity',
    title: 'Zero-Cost Ambiguity Heuristic Engine',
    content: 'The ambiguity detector runs locally before any LLM API call. It inspects short, vague queries lacking context (e.g. "what about that?") and prompts the user for clarification with 0 token cost.',
    category: 'heuristics',
    tags: ['ambiguity', 'heuristics', 'cost-saving', 'zero-token'],
  },
  {
    id: 'kb_3_providers',
    title: 'Dual Engine Resilience & Automatic Fallback',
    content: 'Google Gemini 2.5 Flash acts as the primary LLM engine. If Google Gemini reaches free-tier rate limits or quota caps (429), the backend automatically and seamlessly fails over to Groq LLaMA models.',
    category: 'llm',
    tags: ['gemini', 'groq', 'failover', 'llm', 'fallback'],
  },
  {
    id: 'kb_4_evaluation',
    title: 'Evaluation Suite & Coherence Engine',
    content: 'The evaluation suite measures semantic entity retention, tracks millisecond generation latency, tests 5 standard multi-turn benchmarks, and stores 1-5 user quality rubric scores.',
    category: 'evaluation',
    tags: ['evaluation', 'coherence', 'benchmarks', 'rubrics'],
  },
];

// Single-writer mutex queue and write debounce management
let writeMutexChain = Promise.resolve();
let pendingWriteResolvers = [];
let pendingWriteRejecters = [];
let debounceTimer = null;
const DEBOUNCE_MS = 35; // Coalesce window (35ms)
let isStoreDirty = false;
let lastPersistError = null;

// Fault injection hooks for automated testing
let renameInterceptorForTesting = null;
let writeInterceptorForTesting = null;

export function setRenameInterceptorForTesting(fn) {
  renameInterceptorForTesting = fn;
}

export function setWriteInterceptorForTesting(fn) {
  writeInterceptorForTesting = fn;
}

export function getStoreDirtyState() {
  return isStoreDirty;
}

export function getLastPersistError() {
  return lastPersistError;
}

export function resetLastPersistError() {
  lastPersistError = null;
}

export function markStoreDirty() {
  isStoreDirty = true;
}

/**
 * Robust atomic rename with exponential backoff and retry.
 * Handles Windows transient locks from antivirus, indexers, or background readers (EPERM / EBUSY / EACCES).
 */
async function renameWithRetry(sourcePath, targetPath, maxAttempts = 5) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      if (typeof renameInterceptorForTesting === 'function') {
        await renameInterceptorForTesting(sourcePath, targetPath, attempt);
      } else {
        await fs.promises.rename(sourcePath, targetPath);
      }
      return;
    } catch (err) {
      const isTransient = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES';
      if (!isTransient || attempt >= maxAttempts) {
        // Fallback: try copy + unlink as last resort
        try {
          await fs.promises.copyFile(sourcePath, targetPath);
          await fs.promises.unlink(sourcePath);
          return;
        } catch (copyErr) {
          throw err;
        }
      }
      // Backoff with jitter: 20ms, 40ms, 80ms, 160ms, 200ms
      const backoffMs = Math.min(200, 20 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 10);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

/**
 * Asynchronous atomic write to disk:
 * 1. Serializes in-memory state.
 * 2. Asynchronously writes to temporary file and flushes via filehandle.sync() (libuv threadpool).
 * 3. Rotates existing valid store to a rolling backup.
 * 4. Atomically renames temporary file with exponential backoff retry.
 */
async function executeAtomicDiskWrite(targetPath = getLocalStorePath(), backupPath = getLocalStoreBackupPath()) {
  const dataDir = path.dirname(targetPath);
  if (!fs.existsSync(dataDir)) {
    await fs.promises.mkdir(dataDir, { recursive: true });
  }

  const messagesObj = {};
  for (const [sid, msgs] of inMemoryMessages.entries()) {
    messagesObj[sid] = msgs;
  }
  const memoriesObj = {};
  for (const [uid, memMap] of inMemoryMemories.entries()) {
    memoriesObj[uid] = Array.from(memMap.values());
  }

  const payload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: CURRENT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    users: Array.from(inMemoryUsers.values()),
    sessions: Array.from(inMemorySessions.values()),
    messages: messagesObj,
    rubrics: Array.from(inMemoryRubrics.values()),
    memories: memoriesObj,
  };

  const serialized = JSON.stringify(payload, null, 2);
  const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

  // Test fault injection (e.g. disk-full ENOSPC)
  if (typeof writeInterceptorForTesting === 'function') {
    await writeInterceptorForTesting(tempPath, serialized);
  }

  // Step 1 & 2: Asynchronous write via filehandle + non-blocking fsync via libuv
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(tempPath, 'w');
    await fileHandle.writeFile(serialized, 'utf-8');
    await fileHandle.sync(); // Asynchronous fsync: does not block the V8 event loop!
  } finally {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (e) {}
    }
  }

  // Step 3: Rolling backup (only if primary exists and is non-empty)
  try {
    if (fs.existsSync(targetPath)) {
      const stat = await fs.promises.stat(targetPath);
      if (stat.size > 0) {
        await fs.promises.copyFile(targetPath, backupPath);
      }
    }
  } catch (backupErr) {
    console.warn('[LocalStore] Warning: Could not update rolling backup:', backupErr.message);
  }

  // Step 4: Atomic rename temp -> primary with retry backoff
  await renameWithRetry(tempPath, targetPath, 5);

  isStoreDirty = false;
  lastPersistError = null;
}

function dispatchWriteBatch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const resolvers = pendingWriteResolvers;
  const rejecters = pendingWriteRejecters;
  pendingWriteResolvers = [];
  pendingWriteRejecters = [];

  writeMutexChain = writeMutexChain
    .catch(() => {}) // Don't let previous error permanently wedge future writes
    .then(async () => {
      await executeAtomicDiskWrite(getLocalStorePath(), getLocalStoreBackupPath());
      lastPersistError = null;
      for (const r of resolvers) r();
    })
    .catch((err) => {
      lastPersistError = {
        message: err.message,
        code: err.code || 'ERR_PERSIST',
        timestamp: new Date().toISOString(),
      };
      console.error('[LocalStore] Atomic write failed:', err.message);
      for (const rej of rejecters) rej(err);
    });

  return writeMutexChain;
}

/**
 * Persist in-memory store to disk via single-writer queue with coalescing/debouncing.
 */
export function persistLocalStore(options = {}) {
  markStoreDirty();
  const immediate = options?.immediate === true;

  return new Promise((resolve, reject) => {
    pendingWriteResolvers.push(resolve);
    pendingWriteRejecters.push(reject);

    if (immediate) {
      dispatchWriteBatch();
    } else if (!debounceTimer) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        dispatchWriteBatch();
      }, DEBOUNCE_MS);
    }
  });
}

/**
 * Safe persistence helper for internal DB mutations.
 * Catches any persistence rejection so Node never encounters an unhandled promise rejection.
 */
export function safeSchedulePersist() {
  persistLocalStore().catch((err) => {
    // Handled: recorded in lastPersistError and logged by dispatchWriteBatch
  });
}

/**
 * Flush all debounced pending writes immediately and await disk fsync completion.
 */
export async function flushLocalStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return await persistLocalStore({ immediate: true });
}

let isShuttingDown = false;
export async function handleGracefulShutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (isStoreDirty) {
    console.log(`[LocalStore] Received ${signal}, flushing pending writes to disk...`);
    try {
      await flushLocalStore();
      console.log('[LocalStore] Graceful shutdown flush completed successfully.');
    } catch (err) {
      console.error('[LocalStore] Error flushing store on shutdown:', err.message);
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  process.once('SIGINT', () => {
    handleGracefulShutdown('SIGINT').finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    handleGracefulShutdown('SIGTERM').finally(() => process.exit(0));
  });
}

/**
 * Load local file-persisted store from data/local_store.json.
 * If the primary file is corrupted or partial, recovers from the rolling backup and reports loudly.
 */
export function loadLocalStore(targetPath = getLocalStorePath(), backupPath = getLocalStoreBackupPath()) {
  let raw = null;
  let isCorrupted = false;
  let recoveredFromBackup = false;

  // Clean up any stale temp files left by prior crashes
  try {
    const dataDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      for (const f of files) {
        if (f.startsWith(`${baseName}.tmp.`) || f.startsWith('local_store.tmp.') || (f.startsWith(baseName) && f.includes('.tmp.'))) {
          try {
            fs.unlinkSync(path.join(dataDir, f));
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // 1. Attempt reading and parsing primary file
  if (fs.existsSync(targetPath)) {
    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      if (!content.trim()) {
        isCorrupted = true;
        console.error(`🚨 [LocalStore] CRITICAL CORRUPTION DETECTED: Primary file "${targetPath}" is empty (0 bytes)!`);
      } else {
        JSON.parse(content); // Test JSON syntax
        raw = content;
      }
    } catch (parseErr) {
      isCorrupted = true;
      console.error(`🚨 [LocalStore] CRITICAL CORRUPTION DETECTED in "${targetPath}": ${parseErr.message}`);
    }
  }

  // 2. Recovery path: if primary file is corrupted or missing, recover from rolling backup
  if (isCorrupted || !raw) {
    if (fs.existsSync(backupPath)) {
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf-8');
        if (backupContent.trim()) {
          JSON.parse(backupContent); // Verify backup is valid JSON
          raw = backupContent;
          recoveredFromBackup = true;
          console.warn(`[LocalStore] 🔄 INITIATING AUTOMATED RECOVERY from rolling backup: "${backupPath}"`);
          // Heal primary file immediately with valid backup
          fs.copyFileSync(backupPath, targetPath);
          console.log(`✅ [LocalStore] RECOVERY SUCCESSFUL: Restored primary file "${targetPath}" from rolling backup!`);
        }
      } catch (backupErr) {
        console.error(`🚨 [LocalStore] CRITICAL: Rolling backup "${backupPath}" is also corrupted:`, backupErr.message);
      }
    }
  }

  if (!raw || !raw.trim()) {
    console.log('[LocalStore] Initialized clean in-memory datastore (no data or recovered to empty state).');
    return { loaded: false, recoveredFromBackup, isCorrupted, schemaVersion: CURRENT_SCHEMA_VERSION };
  }

  try {
    const data = JSON.parse(raw);
    const schemaVersion = data.schemaVersion || data.version || 1;

    inMemoryUsers.clear();
    inMemorySessions.clear();
    inMemoryMessages.clear();
    inMemoryRubrics.clear();
    inMemoryMemories.clear();
    compoundMemoryIndex.clear();
    memoryIdIndex.clear();

    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        if (u && u.id) {
          if (u.tokenVersion === undefined) u.tokenVersion = 1;
          inMemoryUsers.set(u.id, u);
        }
      }
    }

    if (Array.isArray(data.sessions)) {
      for (const s of data.sessions) {
        if (s && s.id) inMemorySessions.set(s.id, s);
      }
    }

    if (data.messages && typeof data.messages === 'object') {
      for (const [sid, msgs] of Object.entries(data.messages)) {
        if (Array.isArray(msgs)) {
          let currentSeq = 1;
          for (const m of msgs) {
            if (m.seq === undefined || m.seq === null) {
              m.seq = currentSeq;
            } else if (typeof m.seq === 'number') {
              currentSeq = Math.max(currentSeq, m.seq);
            }
            currentSeq++;
          }
          msgs.sort((a, b) => (a.seq || 0) - (b.seq || 0));
          inMemoryMessages.set(sid, msgs);
        }
      }
    }

    if (Array.isArray(data.rubrics)) {
      for (const r of data.rubrics) {
        if (r && r.id) inMemoryRubrics.set(r.id, r);
      }
    }

    if (data.memories && typeof data.memories === 'object') {
      for (const [uid, mems] of Object.entries(data.memories)) {
        if (Array.isArray(mems)) {
          for (const m of mems) {
            if (m && m.key) {
              m.userId = m.userId || uid;
              indexMemory(m);
            }
          }
        }
      }
    }

    console.log(`💾 Loaded local persistent store from ${targetPath} (${inMemorySessions.size} sessions, ${inMemoryUsers.size} users, ${memoryIdIndex.size} memories, schemaVersion: ${schemaVersion})`);
    return { loaded: true, recoveredFromBackup, isCorrupted, schemaVersion };
  } catch (err) {
    console.error('[LocalStore] Fatal error applying datastore payload:', err.message);
    return { loaded: false, recoveredFromBackup, isCorrupted: true, error: err.message };
  }
}

function seedInMemoryKnowledge() {
  if (inMemoryKnowledge.size === 0) {
    for (const chunk of DEFAULT_KNOWLEDGE_CHUNKS) {
      inMemoryKnowledge.set(chunk.id, chunk);
    }
  }
}

export async function initDatabase() {
  updateStorePaths();
  const storePath = getLocalStorePath();
  const backupPath = getLocalStoreBackupPath();
  console.log(`⚡ Initializing Local Persistent Datastore (${storePath})...`);
  loadLocalStore(storePath, backupPath);
  seedInMemoryKnowledge();
  return { isMongo: false, message: `Local Persistent Datastore (${storePath})` };
}

export function isDatabaseMongo() {
  return false;
}

// Universal database abstraction layer that routes to Local Store
export const db = {
  // Users
  async findUserByEmail(email) {
    for (const u of inMemoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  },

  async findUserByUsername(username) {
    for (const u of inMemoryUsers.values()) {
      if (u.username && u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return null;
  },

  async findUserById(id) {
    return inMemoryUsers.get(id) || null;
  },

  async deleteUser(id) {
    const deleted = inMemoryUsers.delete(id);
    safeSchedulePersist();
    return deleted;
  },

  async createUser(user) {
    if (user.tokenVersion === undefined) {
      user.tokenVersion = 1;
    }
    if (!Array.isArray(user.knownIps)) {
      user.knownIps = [];
    }
    inMemoryUsers.set(user.id, user);
    safeSchedulePersist();
    return user;
  },

  async addKnownUserIp(userId, ip) {
    const user = inMemoryUsers.get(userId);
    if (user && ip) {
      if (!Array.isArray(user.knownIps)) {
        user.knownIps = [];
      }
      if (!user.knownIps.includes(ip)) {
        user.knownIps.push(ip);
        safeSchedulePersist();
      }
    }
  },

  async revokeUserTokens(userId) {
    const user = inMemoryUsers.get(userId);
    if (user) {
      user.tokenVersion = (user.tokenVersion || 1) + 1;
      safeSchedulePersist();
      return user.tokenVersion;
    }
    return null;
  },

  // Sessions
  async createSession(session) {
    inMemorySessions.set(session.id, session);
    safeSchedulePersist();
    return session;
  },

  async getSessionsByUser(userId) {
    return Array.from(inMemorySessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getSessionById(sessionId) {
    return inMemorySessions.get(sessionId) || null;
  },

  async updateSessionTitle(sessionId, title) {
    const updatedAt = new Date().toISOString();
    const sess = inMemorySessions.get(sessionId);
    if (sess) {
      sess.title = title;
      sess.updatedAt = updatedAt;
      safeSchedulePersist();
    }
  },

  async touchSession(sessionId) {
    const updatedAt = new Date().toISOString();
    const sess = inMemorySessions.get(sessionId);
    if (sess) {
      sess.updatedAt = updatedAt;
      sess.messageCount = (sess.messageCount || 0) + 1;
      safeSchedulePersist();
    }
  },

  async deleteSession(sessionId) {
    inMemorySessions.delete(sessionId);
    inMemoryMessages.delete(sessionId);
    for (const [id, r] of inMemoryRubrics.entries()) {
      if (r.sessionId === sessionId) {
        inMemoryRubrics.delete(id);
      }
    }
    safeSchedulePersist();
  },

  // Messages
  async saveMessage(message) {
    const existing = inMemoryMessages.get(message.sessionId) || [];

    // Assign monotonically increasing sequence number per session
    if (message.seq === undefined || message.seq === null) {
      let maxSeq = 0;
      for (const m of existing) {
        if (typeof m.seq === 'number' && m.seq > maxSeq) {
          maxSeq = m.seq;
        }
      }
      message.seq = maxSeq + 1;
    }

    existing.push(message);
    // Always preserve strict monotonic seq order
    existing.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    inMemoryMessages.set(message.sessionId, existing);
    await this.touchSession(message.sessionId);
    safeSchedulePersist();
    return message;
  },

  async getMessagesBySession(sessionId) {
    const msgs = inMemoryMessages.get(sessionId) || [];
    return [...msgs].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  },

  async getMessageById(messageId) {
    if (!messageId) return null;
    for (const msgs of inMemoryMessages.values()) {
      const found = msgs.find((m) => m.id === messageId);
      if (found) return found;
    }
    return null;
  },

  async getMessageCount(sessionId) {
    return (inMemoryMessages.get(sessionId) || []).length;
  },

  async getPastConversationsSummary(userId, currentSessionId = null) {
    const sessions = await this.getSessionsByUser(userId);
    return sessions.filter((s) => s.id !== currentSessionId && (s.messageCount > 0 || inMemoryMessages.has(s.id)));
  },

  async getAllPastConversationsWithFullHistory(userId, currentSessionId = null) {
    const sessions = await this.getSessionsByUser(userId);
    const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
    if (otherSessions.length === 0) return [];

    const fullHistory = [];
    for (const s of otherSessions) {
      const msgs = inMemoryMessages.get(s.id) || [];
      if (msgs.length > 0) {
        fullHistory.push({
          sessionId: s.id,
          title: s.title || 'Untitled Conversation',
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        });
      }
    }
    return fullHistory;
  },

  async searchPastMessages(userId, currentSessionId) {
    const sessions = await this.getSessionsByUser(userId);
    const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
    const otherSessionIds = otherSessions.map((s) => s.id);

    if (otherSessionIds.length === 0) return [];

    const allPastMessages = [];
    for (const sid of otherSessionIds) {
      const msgs = inMemoryMessages.get(sid) || [];
      allPastMessages.push(...msgs);
    }

    const sessionMap = new Map(sessions.map((s) => [s.id, s.title]));
    return allPastMessages.map((m) => ({
      ...m,
      sessionTitle: sessionMap.get(m.sessionId) || 'Previous Conversation',
    }));
  },

  // Rubrics
  async saveRubricScore(rubric) {
    inMemoryRubrics.set(rubric.id, rubric);
    safeSchedulePersist();
    return rubric;
  },

  async getRubricScores(filter = {}) {
    return Array.from(inMemoryRubrics.values()).filter((r) => {
      if (filter.sessionId && r.sessionId !== filter.sessionId) return false;
      if (filter.userId && r.userId !== filter.userId) return false;
      if (filter.messageId && r.messageId !== filter.messageId) return false;
      return true;
    });
  },

  // ==========================================
  // TIER 2: USER MEMORIES (Conflict Resolution Upsert with Compound Indexing)
  // ==========================================
  async saveOrUpdateUserMemory({ userId, key, fact, category = 'general', sourceSessionId, vector = [] }) {
    const now = new Date().toISOString();
    const cleanKey = normalizeMemoryKey(key);
    const compoundKey = makeCompoundMemoryKey(userId, cleanKey);

    // O(1) compound index lookup: no linear scans!
    const existing = compoundMemoryIndex.get(compoundKey);
    const memoryObj = {
      id: existing ? existing.id : 'mem_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      userId,
      key: cleanKey,
      fact: fact ? fact.trim() : '',
      category,
      vector,
      sourceSessionId,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : now,
    };

    indexMemory(memoryObj);
    safeSchedulePersist();
    return memoryObj;
  },

  async getUserMemories(userId) {
    const userMemMap = inMemoryMemories.get(userId);
    if (!userMemMap) return [];
    return Array.from(userMemMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getUserMemoryById(memoryId) {
    if (!memoryId) return null;
    return memoryIdIndex.get(memoryId) || null;
  },

  async getUserMemoryByCompoundKey(userId, key) {
    return compoundMemoryIndex.get(makeCompoundMemoryKey(userId, key)) || null;
  },

  async saveUserMemory(memoryData) {
    return await this.saveOrUpdateUserMemory(memoryData);
  },

  async updateUserMemory(id, userId, data) {
    const mem = memoryIdIndex.get(id);
    if (!mem || mem.userId !== userId) return null;
    const now = new Date().toISOString();
    const oldCleanKey = normalizeMemoryKey(mem.key);
    const newCleanKey = data.key ? normalizeMemoryKey(data.key) : oldCleanKey;

    if (newCleanKey !== oldCleanKey) {
      unindexMemory(mem);
    }

    const updated = {
      ...mem,
      ...data,
      key: newCleanKey,
      updatedAt: now,
    };
    indexMemory(updated);
    safeSchedulePersist();
    return updated;
  },

  async deleteUserMemoryByKey(key, userId) {
    const compoundKey = makeCompoundMemoryKey(userId, key);
    const mem = compoundMemoryIndex.get(compoundKey);
    if (mem) {
      unindexMemory(mem);
      safeSchedulePersist();
      return true;
    }
    return false;
  },

  async deleteUserMemory(memoryId, userId) {
    const mem = memoryIdIndex.get(memoryId);
    if (!mem || mem.userId !== userId) return false;
    unindexMemory(mem);
    safeSchedulePersist();
    return true;
  },

  // ==========================================
  // TIER 3: KNOWLEDGE BASE CHUNKS
  // ==========================================
  async getKnowledgeChunks() {
    return Array.from(inMemoryKnowledge.values());
  },

  // ==========================================
  // ASYNC FILE PROCESSING JOBS (Internal)
  // ==========================================
  async saveFileJob(job) {
    const now = new Date().toISOString();
    const doc = {
      jobId: job.jobId,
      fileId: job.fileId,
      sessionId: job.sessionId,
      userId: job.userId || 'guest-user-default',
      filename: job.filename,
      status: job.status || 'pending',
      progress: job.progress || 0,
      error: job.error || null,
      createdAt: job.createdAt || now,
      updatedAt: now,
    };
    inMemoryFileJobs.set(doc.jobId, doc);
    return doc;
  },

  async getFileJob(jobId) {
    return inMemoryFileJobs.get(jobId) || null;
  },

  async updateFileJobStatus(jobId, status, extra = {}) {
    const updatedAt = new Date().toISOString();
    const job = inMemoryFileJobs.get(jobId);
    if (job) {
      Object.assign(job, { status, updatedAt, ...extra });
      return job;
    }
    return null;
  },

  async expireStaleJobs() {
    const updatedAt = new Date().toISOString();
    for (const job of inMemoryFileJobs.values()) {
      if (job.status === 'pending' || job.status === 'processing') {
        job.status = 'expired';
        job.error = 'Server restarted while job was in flight.';
        job.updatedAt = updatedAt;
      }
    }
  },

  // ==========================================
  // FILE METADATA & USER-SCOPED SHA-256 DEDUP
  // ==========================================
  async saveFileMetadata(meta) {
    const now = new Date().toISOString();
    const doc = {
      fileId: meta.fileId,
      sessionId: meta.sessionId,
      userId: meta.userId || 'guest-user-default',
      filename: meta.filename,
      mimeType: meta.mimeType || 'text/plain',
      size: meta.size || 0,
      sha256: meta.sha256,
      fileType: meta.fileType || 'text',
      uploadedAt: meta.uploadedAt || now,
      summary: meta.summary || '',
      entities: Array.isArray(meta.entities) ? meta.entities : [],
      pageCount: meta.pageCount || 1,
      wordCount: meta.wordCount || 0,
      charCount: meta.charCount || 0,
      estimatedTokens: meta.estimatedTokens || 0,
      isScanned: Boolean(meta.isScanned),
      storagePath: meta.storagePath || null,
    };
    inMemoryFileMetadata.set(doc.fileId, doc);
    return doc;
  },

  async getFileMetadata(fileId) {
    return inMemoryFileMetadata.get(fileId) || null;
  },

  async getFilesBySession(sessionId) {
    return Array.from(inMemoryFileMetadata.values())
      .filter((f) => f.sessionId === sessionId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  },

  async findFileBySha256(userId, sha256) {
    if (!userId || !sha256) return null;
    for (const f of inMemoryFileMetadata.values()) {
      if (f.userId === userId && f.sha256 === sha256) {
        return f;
      }
    }
    return null;
  },

  async saveParsedDocumentCache(userId, sha256, parsedDoc) {
    const key = `${userId}:${sha256}`;
    inMemoryParses.set(key, parsedDoc);
  },

  async getParsedDocumentCache(userId, sha256) {
    const key = `${userId}:${sha256}`;
    return inMemoryParses.get(key) || null;
  },

  // ==========================================
  // DOCUMENT CHUNKS (Namespaced strictly by sessionId)
  // ==========================================
  async saveDocumentChunks(chunks = []) {
    if (!chunks || chunks.length === 0) return [];
    for (const c of chunks) {
      inMemoryDocumentChunks.set(c.id, c);
    }
    return chunks;
  },

  async getDocumentChunksBySession(sessionId, fileId = null, userId = null) {
    if (!sessionId) return [];
    return Array.from(inMemoryDocumentChunks.values())
      .filter((c) => c.sessionId === sessionId && (!fileId || c.fileId === fileId) && (!userId || !c.userId || c.userId === userId))
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  },

  async deleteFile(fileId) {
    if (!fileId) return false;
    inMemoryFileMetadata.delete(fileId);
    for (const [id, c] of inMemoryDocumentChunks.entries()) {
      if (c.fileId === fileId) {
        inMemoryDocumentChunks.delete(id);
      }
    }
    for (const [id, j] of inMemoryFileJobs.entries()) {
      if (j.fileId === fileId) {
        inMemoryFileJobs.delete(id);
      }
    }
    return true;
  },

  getStoreStatus() {
    return {
      type: 'Local Persistent Store (JSON File)',
      location: getLocalStorePath(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      status: lastPersistError ? 'Degraded' : 'Ready',
      lastPersistError: lastPersistError ? lastPersistError.message : null,
      lastPersistErrorDetails: lastPersistError,
      isDirty: isStoreDirty,
      sessionsCount: inMemorySessions.size,
      usersCount: inMemoryUsers.size,
      memoriesCount: memoryIdIndex.size,
      filesCount: inMemoryFileMetadata.size,
      chunksCount: inMemoryDocumentChunks.size,
      jobsCount: inMemoryFileJobs.size,
    };
  },
};
