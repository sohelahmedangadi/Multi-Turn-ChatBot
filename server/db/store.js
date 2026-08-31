import mongoose, { Schema, model } from 'mongoose';

// Check if Mongo URI exists
const MONGO_URI = process.env.MONGO_URI || '';
let isMongoConnected = false;

// In-memory fallback stores for local development and preview
const inMemoryUsers = new Map();
const inMemorySessions = new Map();
const inMemoryMessages = new Map(); // sessionId -> messages
const inMemoryRubrics = new Map();
const inMemoryMemories = new Map(); // userId -> Map(key -> Memory)
const inMemoryKnowledge = new Map(); // id -> KnowledgeChunk

// ==========================================
// SCHEMAS
// ==========================================

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const SessionSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  messageCount: { type: Number, default: 0 },
  providerUsed: { type: String, enum: ['gemini', 'groq'] },
});

const MessageSchema = new Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  metadata: {
    provider: String,
    model: String,
    latencyMs: Number,
    tokensEstimated: Number,
    ambiguityFlag: Boolean,
    coherenceScore: Number,
    isFallback: Boolean,
    retrievedMemoriesCount: Number,
  },
});

const RubricSchema = new Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  messageId: { type: String, required: true },
  userId: { type: String, required: true },
  relevance: { type: Number, required: true, min: 1, max: 5 },
  coherence: { type: Number, required: true, min: 1, max: 5 },
  helpfulness: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String },
  timestamp: { type: String, default: () => new Date().toISOString() },
});

// Tier 2: User-Specific Long-Term Memories
const UserMemorySchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  key: { type: String, required: true }, // e.g. "project_name", "preferred_language", "tech_stack"
  fact: { type: String, required: true }, // e.g. "User is building OmniTurn AI, a multi-turn chatbot"
  category: { type: String, default: 'general' }, // "project", "preference", "profile", "tech_stack"
  vector: { type: Schema.Types.Mixed, default: {} }, // dense embedding / term vector
  sourceSessionId: { type: String },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

UserMemorySchema.index({ userId: 1, key: 1 }, { unique: true });

// Tier 3: General Domain Knowledge Base Chunks
const KnowledgeChunkSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'general' },
  tags: { type: [String], default: [] },
  vector: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const UserModel = mongoose.models.User || model('User', UserSchema);
export const SessionModel = mongoose.models.Session || model('Session', SessionSchema);
export const MessageModel = mongoose.models.Message || model('Message', MessageSchema);
export const RubricModel = mongoose.models.Rubric || model('Rubric', RubricSchema);
export const UserMemoryModel = mongoose.models.UserMemory || model('UserMemory', UserMemorySchema, 'memories');
export const KnowledgeChunkModel = mongoose.models.KnowledgeChunk || model('KnowledgeChunk', KnowledgeChunkSchema, 'knowledge_chunks');

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

export async function initDatabase() {
  const uri = process.env.MONGO_URI?.trim() || MONGO_URI;
  if (uri && uri.startsWith('mongodb')) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
      });
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB at:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      await seedKnowledgeBase();
      return { isMongo: true, message: 'Connected to MongoDB' };
    } catch (err) {
      console.warn('⚠️ MongoDB connection error. Operating with In-Memory store:', err.message);
      isMongoConnected = false;
      seedInMemoryKnowledge();
      return { isMongo: false, message: 'Using In-Memory Datastore (MongoDB unreachable)' };
    }
  } else {
    console.log('ℹ️ No MONGO_URI specified. Operating with In-Memory store (session persistence active).');
    seedInMemoryKnowledge();
    return { isMongo: false, message: 'Using In-Memory Datastore' };
  }
}

async function seedKnowledgeBase() {
  if (!isMongoConnected) return;
  try {
    const count = await KnowledgeChunkModel.countDocuments();
    if (count === 0) {
      await KnowledgeChunkModel.insertMany(DEFAULT_KNOWLEDGE_CHUNKS);
    }
  } catch (err) {
    console.warn('Knowledge seed notice:', err.message);
  }
}

function seedInMemoryKnowledge() {
  if (inMemoryKnowledge.size === 0) {
    for (const chunk of DEFAULT_KNOWLEDGE_CHUNKS) {
      inMemoryKnowledge.set(chunk.id, chunk);
    }
  }
}

export function isDatabaseMongo() {
  return isMongoConnected;
}

// Universal database abstraction layer that routes to MongoDB or In-Memory
export const db = {
  // Users
  async findUserByEmail(email) {
    if (isMongoConnected) {
      return (await UserModel.findOne({ email }).lean());
    }
    for (const u of inMemoryUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  },

  async findUserByUsername(username) {
    if (isMongoConnected) {
      return (await UserModel.findOne({ username }).lean());
    }
    for (const u of inMemoryUsers.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return null;
  },

  async findUserById(id) {
    if (isMongoConnected) {
      return (await UserModel.findOne({ id }).lean());
    }
    return inMemoryUsers.get(id) || null;
  },

  async createUser(user) {
    if (isMongoConnected) {
      const doc = new UserModel(user);
      await doc.save();
      return doc.toObject();
    }
    inMemoryUsers.set(user.id, user);
    return user;
  },

  // Sessions
  async createSession(session) {
    if (isMongoConnected) {
      const doc = new SessionModel(session);
      await doc.save();
      return doc.toObject();
    }
    inMemorySessions.set(session.id, session);
    return session;
  },

  async getSessionsByUser(userId) {
    if (isMongoConnected) {
      return (await SessionModel.find({ userId }).sort({ updatedAt: -1 }).lean());
    }
    return Array.from(inMemorySessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getSessionById(sessionId) {
    if (isMongoConnected) {
      return (await SessionModel.findOne({ id: sessionId }).lean());
    }
    return inMemorySessions.get(sessionId) || null;
  },

  async updateSessionTitle(sessionId, title) {
    const updatedAt = new Date().toISOString();
    if (isMongoConnected) {
      await SessionModel.updateOne({ id: sessionId }, { title, updatedAt });
      return;
    }
    const sess = inMemorySessions.get(sessionId);
    if (sess) {
      sess.title = title;
      sess.updatedAt = updatedAt;
    }
  },

  async touchSession(sessionId) {
    const updatedAt = new Date().toISOString();
    if (isMongoConnected) {
      await SessionModel.updateOne(
        { id: sessionId },
        { updatedAt, $inc: { messageCount: 1 } }
      );
      return;
    }
    const sess = inMemorySessions.get(sessionId);
    if (sess) {
      sess.updatedAt = updatedAt;
      sess.messageCount = (sess.messageCount || 0) + 1;
    }
  },

  async deleteSession(sessionId) {
    if (isMongoConnected) {
      await SessionModel.deleteOne({ id: sessionId });
      await MessageModel.deleteMany({ sessionId });
      await RubricModel.deleteMany({ sessionId });
      return;
    }
    inMemorySessions.delete(sessionId);
    inMemoryMessages.delete(sessionId);
    for (const [id, r] of inMemoryRubrics.entries()) {
      if (r.sessionId === sessionId) {
        inMemoryRubrics.delete(id);
      }
    }
  },

  // Messages
  async saveMessage(message) {
    if (isMongoConnected) {
      const doc = new MessageModel(message);
      await doc.save();
      await this.touchSession(message.sessionId);
      return doc.toObject();
    }
    const existing = inMemoryMessages.get(message.sessionId) || [];
    existing.push(message);
    inMemoryMessages.set(message.sessionId, existing);
    await this.touchSession(message.sessionId);
    return message;
  },

  async getMessagesBySession(sessionId) {
    if (isMongoConnected) {
      return (await MessageModel.find({ sessionId }).sort({ timestamp: 1 }).lean());
    }
    return inMemoryMessages.get(sessionId) || [];
  },

  async getMessageCount(sessionId) {
    if (isMongoConnected) {
      return await MessageModel.countDocuments({ sessionId });
    }
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
      let msgs = [];
      if (isMongoConnected) {
        msgs = await MessageModel.find({ sessionId: s.id }).sort({ timestamp: 1 }).lean();
      } else {
        msgs = inMemoryMessages.get(s.id) || [];
      }
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

    let allPastMessages = [];
    if (isMongoConnected) {
      allPastMessages = await MessageModel.find({
        sessionId: { $in: otherSessionIds },
      })
        .sort({ timestamp: 1 })
        .limit(200)
        .lean();
    } else {
      for (const sid of otherSessionIds) {
        const msgs = inMemoryMessages.get(sid) || [];
        allPastMessages.push(...msgs);
      }
    }

    const sessionMap = new Map(sessions.map((s) => [s.id, s.title]));
    return allPastMessages.map((m) => ({
      ...m,
      sessionTitle: sessionMap.get(m.sessionId) || 'Previous Conversation',
    }));
  },

  // Rubrics
  async saveRubricScore(rubric) {
    if (isMongoConnected) {
      const doc = new RubricModel(rubric);
      await doc.save();
      return doc.toObject();
    }
    inMemoryRubrics.set(rubric.id, rubric);
    return rubric;
  },

  async getRubricScores(filter = {}) {
    if (isMongoConnected) {
      return (await RubricModel.find(filter).lean());
    }
    return Array.from(inMemoryRubrics.values()).filter((r) => {
      if (filter.sessionId && r.sessionId !== filter.sessionId) return false;
      if (filter.userId && r.userId !== filter.userId) return false;
      if (filter.messageId && r.messageId !== filter.messageId) return false;
      return true;
    });
  },

  // ==========================================
  // TIER 2: USER MEMORIES (Conflict Resolution Upsert)
  // ==========================================
  async saveOrUpdateUserMemory({ userId, key, fact, category = 'general', sourceSessionId, vector = [] }) {
    const now = new Date().toISOString();
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');

    if (isMongoConnected) {
      const updated = await UserMemoryModel.findOneAndUpdate(
        { userId, key: cleanKey },
        {
          $set: {
            fact: fact.trim(),
            category,
            sourceSessionId,
            vector,
            updatedAt: now,
          },
          $setOnInsert: {
            id: 'mem_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      ).lean();
      return updated;
    }

    // In-Memory store
    let userMemMap = inMemoryMemories.get(userId);
    if (!userMemMap) {
      userMemMap = new Map();
      inMemoryMemories.set(userId, userMemMap);
    }

    const existing = userMemMap.get(cleanKey);
    const memoryObj = {
      id: existing ? existing.id : 'mem_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      userId,
      key: cleanKey,
      fact: fact.trim(),
      category,
      vector,
      sourceSessionId,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : now,
    };

    userMemMap.set(cleanKey, memoryObj);
    return memoryObj;
  },

  async getUserMemories(userId) {
    if (isMongoConnected) {
      return (await UserMemoryModel.find({ userId }).sort({ updatedAt: -1 }).lean());
    }
    const userMemMap = inMemoryMemories.get(userId);
    if (!userMemMap) return [];
    return Array.from(userMemMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async saveUserMemory(memoryData) {
    return await this.saveOrUpdateUserMemory(memoryData);
  },

  async updateUserMemory(id, userId, data) {
    const now = new Date().toISOString();
    if (isMongoConnected) {
      const updated = await UserMemoryModel.findOneAndUpdate(
        { id, userId },
        { $set: { ...data, updatedAt: now } },
        { returnDocument: 'after' }
      ).lean();
      return updated;
    }
    const userMemMap = inMemoryMemories.get(userId);
    if (userMemMap) {
      for (const [k, mem] of userMemMap.entries()) {
        if (mem.id === id) {
          const updated = { ...mem, ...data, updatedAt: now };
          userMemMap.set(k, updated);
          return updated;
        }
      }
    }
    return null;
  },

  async deleteUserMemoryByKey(key, userId) {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (isMongoConnected) {
      const res = await UserMemoryModel.deleteOne({ userId, key: cleanKey });
      return res.deletedCount > 0;
    }
    const userMemMap = inMemoryMemories.get(userId);
    if (userMemMap && userMemMap.has(cleanKey)) {
      userMemMap.delete(cleanKey);
      return true;
    }
    return false;
  },

  async deleteUserMemory(memoryId, userId) {
    if (isMongoConnected) {
      await UserMemoryModel.deleteOne({ id: memoryId, userId });
      return true;
    }
    const userMemMap = inMemoryMemories.get(userId);
    if (userMemMap) {
      for (const [key, mem] of userMemMap.entries()) {
        if (mem.id === memoryId) {
          userMemMap.delete(key);
          return true;
        }
      }
    }
    return false;
  },

  // ==========================================
  // TIER 3: KNOWLEDGE BASE CHUNKS
  // ==========================================
  async getKnowledgeChunks() {
    if (isMongoConnected) {
      const chunks = await KnowledgeChunkModel.find().lean();
      if (chunks.length > 0) return chunks;
    }
    return Array.from(inMemoryKnowledge.values());
  },
};
