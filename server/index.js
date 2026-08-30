import express from 'express';
import path from 'path';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-bootstrap .env if not found
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
}

// Load environment variables
dotenv.config({ path: envPath });

import { initDatabase, db, isDatabaseMongo } from './db/store.js';
import { generateResponse, generateStreamResponse, getActiveProviderName } from './services/llmProvider.js';
import { getSessionContext, estimateTokenCount } from './services/contextManager.js';
import { processAndSaveUserMemories, searchUserMemories, searchKnowledgeBase } from './services/memoryManager.js';
import { detectAmbiguity } from './services/ambiguityDetector.js';
import { calculateCoherenceScore, BENCHMARK_DATASET, getEvaluationSummary } from './services/evaluationSuite.js';
import { authenticateJWT, optionalJWT, generateToken, hashPassword, verifyPassword } from './middleware/auth.js';
import { inputSanitizationMiddleware } from './middleware/sanitizer.js';
import { parseFileContent } from './services/fileParser.js';
import { indexDocument, getDocumentMetadata, deleteDocument } from './services/ragService.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 5000;

  // Configure trust proxy
  app.set('trust proxy', 1);

  // Initialize DB (MongoDB or fallback In-Memory Store)
  const dbStatus = await initDatabase();

  // Core Middlewares
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // Rate Limiting (30 requests per minute per IP)
  const chatRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      trustProxy: false,
      default: false,
    },
    message: { error: 'Rate limit exceeded (30 requests per minute). Please slow down.' },
  });

  // Health / System Status
  app.get('/api/system/status', (req, res) => {
    const activeProvider = getActiveProviderName();
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');

    res.json({
      status: 'online',
      activeProvider,
      geminiAvailable: hasGemini,
      dbType: isDatabaseMongo() ? 'mongodb' : 'in-memory-store',
      dbStatus: dbStatus.message,
      defaultModel: 'gemini-2.5-flash',
      uptimeSeconds: process.uptime(),
    });
  });

  // ==========================================
  // AUTH ROUTES
  // ==========================================

  // Register: POST /api/auth/register
  const handleRegister = async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
      }

      const existingUser = (await db.findUserByEmail(email)) || (await db.findUserByUsername(username));
      if (existingUser) {
        return res.status(400).json({ error: 'A user with that email or username already exists.' });
      }

      const passwordHash = await hashPassword(password);
      const newUser = {
        id: 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      await db.createUser(newUser);
      const token = generateToken({ id: newUser.id, username: newUser.username, email: newUser.email });

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: { id: newUser.id, username: newUser.username, email: newUser.email },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  };

  app.post('/api/auth/register', handleRegister);
  app.post('/auth/register', handleRegister);

  // Login: POST /api/auth/login
  const handleLogin = async (req, res) => {
    try {
      const { emailOrUsername, password } = req.body;
      if (!emailOrUsername || !password) {
        return res.status(400).json({ error: 'Username/Email and password are required.' });
      }

      const user =
        (await db.findUserByEmail(emailOrUsername)) ||
        (await db.findUserByUsername(emailOrUsername));

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials. User not found.' });
      }

      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
      }

      const token = generateToken({ id: user.id, username: user.username, email: user.email });

      return res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Login failed: ' + err.message });
    }
  };

  app.post('/api/auth/login', handleLogin);
  app.post('/auth/login', handleLogin);

  // Current user info: GET /api/auth/me
  app.get('/api/auth/me', authenticateJWT, async (req, res) => {
    return res.json({ user: req.user });
  });

  // ==========================================
  // SESSION ROUTES
  // ==========================================

  // Create Session: POST /api/session
  const handleCreateSession = async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { title, providerUsed } = req.body;

      const newSession = {
        id: 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        userId,
        title: title?.trim() || 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        providerUsed: providerUsed || getActiveProviderName(),
      };

      await db.createSession(newSession);
      return res.status(201).json(newSession);
    } catch (err) {
      console.error('Create session error:', err);
      return res.status(500).json({ error: 'Failed to create session: ' + err.message });
    }
  };

  app.post('/api/session', optionalJWT, handleCreateSession);
  app.post('/session', optionalJWT, handleCreateSession);

  // List Sessions: GET /api/sessions
  const handleGetSessions = async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const sessions = await db.getSessionsByUser(userId);
      return res.json({ sessions });
    } catch (err) {
      console.error('Get sessions error:', err);
      return res.status(500).json({ error: 'Failed to load sessions: ' + err.message });
    }
  };

  app.get('/api/sessions', optionalJWT, handleGetSessions);
  app.get('/sessions', optionalJWT, handleGetSessions);

  // Delete Session: DELETE /api/session/:sessionId
  app.delete('/api/session/:sessionId', optionalJWT, async (req, res) => {
    try {
      const { sessionId } = req.params;
      await db.deleteSession(sessionId);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete session: ' + err.message });
    }
  });

  // History: GET /api/history/:sessionId
  const handleGetHistory = async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await db.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      const messages = await db.getMessagesBySession(sessionId);
      return res.json({ session, messages });
    } catch (err) {
      console.error('Get history error:', err);
      return res.status(500).json({ error: 'Failed to fetch history: ' + err.message });
    }
  };

  app.get('/api/history/:sessionId', optionalJWT, handleGetHistory);
  app.get('/history/:sessionId', optionalJWT, handleGetHistory);

  // ==========================================
  // TIER 2 & TIER 3: MEMORY & KNOWLEDGE MANAGEMENT
  // ==========================================

  // Get current user's memories
  app.get('/api/memories', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const memories = await db.getUserMemories(userId);
      return res.json({ memories });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch memories: ' + err.message });
    }
  });

  // Manually add or update a user memory
  app.post('/api/memories', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { key, fact, category } = req.body;
      if (!key || !fact) {
        return res.status(400).json({ error: 'Key and fact are required.' });
      }
      const saved = await db.saveOrUpdateUserMemory({
        userId,
        key,
        fact,
        category: category || 'general',
      });
      return res.status(201).json({ memory: saved });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save memory: ' + err.message });
    }
  });

  // Update a user memory
  app.put('/api/memories/:id', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { id } = req.params;
      const { key, fact, category } = req.body;
      const updated = await db.updateUserMemory(id, userId, {
        ...(key && { key: key.trim().toLowerCase().replace(/\s+/g, '_') }),
        ...(fact && { fact: fact.trim() }),
        ...(category && { category }),
      });
      if (!updated) {
        return res.status(404).json({ error: 'Memory not found or unauthorized.' });
      }
      return res.json({ memory: updated });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update memory: ' + err.message });
    }
  });

  // Delete a user memory
  app.delete('/api/memories/:id', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { id } = req.params;
      const deleted = await db.deleteUserMemory(id, userId);
      return res.json({ success: deleted });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete memory: ' + err.message });
    }
  });

  // Get domain knowledge chunks
  app.get('/api/knowledge', async (req, res) => {
    try {
      const chunks = await db.getKnowledgeChunks();
      return res.json({ chunks });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch knowledge chunks: ' + err.message });
    }
  });

  // ==========================================
  // FILE UPLOAD & RAG DOCUMENT ROUTES
  // ==========================================
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  });

  // Upload and index document with LangChain RAG
  app.post('/api/files/upload', optionalJWT, upload.single('file'), async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      let fileBuffer = req.file?.buffer;
      let originalname = req.file?.originalname;
      let mimetype = req.file?.mimetype;

      if (!fileBuffer && req.body?.textContent) {
        fileBuffer = Buffer.from(req.body.textContent, 'utf-8');
        originalname = req.body.filename || 'document.txt';
        mimetype = req.body.mimeType || 'text/plain';
      } else if (!fileBuffer && req.body?.base64) {
        fileBuffer = Buffer.from(req.body.base64, 'base64');
        originalname = req.body.filename || 'document.pdf';
        mimetype = req.body.mimeType || 'application/pdf';
      }

      if (!fileBuffer) {
        return res.status(400).json({ error: 'No file uploaded or file content missing.' });
      }

      const parsed = await parseFileContent(fileBuffer, originalname, mimetype);
      const fileId = 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

      const indexed = await indexDocument(fileId, parsed, userId);

      return res.status(201).json({
        message: 'Document parsed and indexed successfully with LangChain RAG',
        document: indexed,
      });
    } catch (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ error: 'Failed to process document: ' + err.message });
    }
  });

  // Get Document Metadata
  app.get('/api/files/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const meta = getDocumentMetadata(fileId);
      if (!meta) {
        return res.status(404).json({ error: 'Document not found or expired.' });
      }
      return res.json({ document: meta });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch document: ' + err.message });
    }
  });

  // Delete Document
  app.delete('/api/files/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const deleted = deleteDocument(fileId);
      return res.json({ success: deleted });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete document: ' + err.message });
    }
  });

  // ==========================================
  // CHAT ROUTE (POST /api/chat or /chat)
  // Supports 3-Tier Memory Context Assembly + Streaming
  // ==========================================

  const handleChat = async (req, res) => {
    const startTime = Date.now();
    const { sessionId, message, systemPrompt, providerOverride, modelOverride, stream, fileId } = req.body;
    const userId = req.user?.id || 'guest-user-default';

    if (!sessionId) {
      return res.status(400).json({ error: 'Field "sessionId" is required.' });
    }

    if (message === undefined || message === null || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
    }

    try {
      const cleanMessage = message.trim();
      const sessionTitle = cleanMessage.length > 0
        ? cleanMessage.substring(0, 35) + (cleanMessage.length > 35 ? '...' : '')
        : 'New Conversation';

      // 1. Verify / ensure session exists
      let session = await db.getSessionById(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          userId,
          title: sessionTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          providerUsed: providerOverride || getActiveProviderName(),
        };
        await db.createSession(session);
      } else if (session.messageCount === 0 && (!session.title || session.title === 'New Conversation')) {
        await db.updateSessionTitle(sessionId, sessionTitle);
      }

      // 2. Auto-Extract and Persist Persistent Facts into Tier 2 User Memory
      try {
        await processAndSaveUserMemories(userId, message, sessionId);
      } catch (memErr) {
        console.warn('Memory auto-extraction notice:', memErr.message);
      }

      // 3. Assemble 3-Tier Context + LangChain RAG Document Context
      const context = await getSessionContext(sessionId, message, userId, { fileId });

      // 4. Ambiguity Detection Heuristic
      const ambiguity = detectAmbiguity(message, context.history);

      // Save User Message to Database
      const userMsgId = 'msg_user_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const userMessageDoc = {
        id: userMsgId,
        sessionId,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        metadata: {
          tokensEstimated: estimateTokenCount(message),
          attachedFileId: fileId || null,
          attachedFilename: context.attachedDocumentMeta?.filename || null,
          attachedChunksCount: context.relevantDocumentChunks?.length || 0,
        },
      };
      await db.saveMessage(userMessageDoc);

      // If Ambiguity is detected, return clarifying question immediately
      if (ambiguity.isAmbiguous && ambiguity.suggestedClarification) {
        const assistantMsgId = 'msg_asst_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const assistantMessageDoc = {
          id: assistantMsgId,
          sessionId,
          role: 'assistant',
          content: ambiguity.suggestedClarification,
          timestamp: new Date().toISOString(),
          metadata: {
            provider: 'heuristic',
            model: 'Ambiguity-Heuristic-RuleEngine',
            latencyMs: Date.now() - startTime,
            ambiguityFlag: true,
            tokensEstimated: estimateTokenCount(ambiguity.suggestedClarification),
            coherenceScore: 1.0,
            retrievedMemoriesCount: 0,
          },
        };
        await db.saveMessage(assistantMessageDoc);

        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: ambiguity.suggestedClarification })}\n\n`);
          res.write(`data: ${JSON.stringify({
            type: 'done',
            userMessage: userMessageDoc,
            assistantMessage: assistantMessageDoc,
            provider: 'heuristic',
            model: 'Ambiguity-Heuristic-RuleEngine',
            latencyMs: Date.now() - startTime,
            ambiguityDetected: true,
            contextTurnsUsed: context.history.length,
            retrievedMemories: [],
          })}\n\n`);
          return res.end();
        }

        return res.json({
          reply: ambiguity.suggestedClarification,
          sessionId,
          userMessage: userMessageDoc,
          assistantMessage: assistantMessageDoc,
          provider: 'heuristic',
          model: 'Ambiguity-Heuristic-RuleEngine',
          latencyMs: Date.now() - startTime,
          contextTurnsUsed: context.history.length,
          ambiguityDetected: true,
          coherenceScore: 1.0,
          retrievedMemories: [],
        });
      }

      // 5. System Prompt Isolation + Injected Long-Term Memories & Knowledge
      const baseSystemPrompt =
        systemPrompt && systemPrompt.trim().length > 0
          ? systemPrompt.trim()
          : 'You are an intelligent, helpful, and concise conversational AI assistant. Maintain context across multi-turn dialogues and deliver accurate, structured responses.';

      const effectiveSystemPrompt = baseSystemPrompt + context.contextualMemorySection;
      const targetProvider = providerOverride || getActiveProviderName();

      // 6. Handle Streaming Response if requested
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          const streamResult = await generateStreamResponse(
            context.history,
            message,
            effectiveSystemPrompt,
            (chunkText) => {
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
            },
            { provider: targetProvider, model: modelOverride }
          );

          const coherence = calculateCoherenceScore(context.history, message, streamResult.text);

          const assistantMsgId = 'msg_asst_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          const assistantMessageDoc = {
            id: assistantMsgId,
            sessionId,
            role: 'assistant',
            content: streamResult.text,
            timestamp: new Date().toISOString(),
            metadata: {
              provider: streamResult.provider,
              model: streamResult.model,
              latencyMs: streamResult.latencyMs,
              tokensEstimated: streamResult.tokensEstimated,
              ambiguityFlag: false,
              coherenceScore: coherence.score,
              isFallback: streamResult.isFallback,
              retrievedMemoriesCount: context.relevantMemories.length,
              attachedFileId: fileId || null,
              attachedFilename: context.attachedDocumentMeta?.filename || null,
              attachedChunksCount: context.relevantDocumentChunks?.length || 0,
            },
          };
          await db.saveMessage(assistantMessageDoc);

          res.write(`data: ${JSON.stringify({
            type: 'done',
            userMessage: userMessageDoc,
            assistantMessage: assistantMessageDoc,
            provider: streamResult.provider,
            model: streamResult.model,
            latencyMs: streamResult.latencyMs,
            tokensEstimated: streamResult.tokensEstimated,
            ambiguityDetected: false,
            coherenceScore: coherence.score,
            contextTurnsUsed: context.history.length,
            isFallback: streamResult.isFallback,
            retrievedMemories: context.relevantMemories,
            attachedDocument: context.attachedDocumentMeta || null,
          })}\n\n`);
          return res.end();
        } catch (streamErr) {
          console.error('Streaming generation error:', streamErr);
          res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message })}\n\n`);
          return res.end();
        }
      }

      // 7. Non-streaming standard generation
      const llmResult = await generateResponse(
        context.history,
        message,
        effectiveSystemPrompt,
        { provider: targetProvider, model: modelOverride }
      );

      const coherence = calculateCoherenceScore(context.history, message, llmResult.text);

      const assistantMsgId = 'msg_asst_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const assistantMessageDoc = {
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        content: llmResult.text,
        timestamp: new Date().toISOString(),
        metadata: {
          provider: llmResult.provider,
          model: llmResult.model,
          latencyMs: llmResult.latencyMs,
          tokensEstimated: llmResult.tokensEstimated,
          ambiguityFlag: false,
          coherenceScore: coherence.score,
          isFallback: llmResult.isFallback,
          retrievedMemoriesCount: context.relevantMemories.length,
          attachedFileId: fileId || null,
          attachedFilename: context.attachedDocumentMeta?.filename || null,
          attachedChunksCount: context.relevantDocumentChunks?.length || 0,
        },
      };
      await db.saveMessage(assistantMessageDoc);

      return res.json({
        reply: llmResult.text,
        sessionId,
        userMessage: userMessageDoc,
        assistantMessage: assistantMessageDoc,
        provider: llmResult.provider,
        model: llmResult.model,
        latencyMs: llmResult.latencyMs,
        tokensEstimated: llmResult.tokensEstimated,
        contextTurnsUsed: context.history.length,
        ambiguityDetected: false,
        coherenceScore: coherence.score,
        isFallback: llmResult.isFallback,
        retrievedMemories: context.relevantMemories,
        attachedDocument: context.attachedDocumentMeta || null,
      });
    } catch (err) {
      console.error('Chat processing error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to process chat message',
      });
    }
  };

  app.post('/api/chat', chatRateLimiter, optionalJWT, inputSanitizationMiddleware, handleChat);
  app.post('/chat', chatRateLimiter, optionalJWT, inputSanitizationMiddleware, handleChat);

  // ==========================================
  // EVALUATION SUITE ROUTES
  // ==========================================

  // Get Benchmark dataset
  app.get('/api/evaluate/benchmarks', (req, res) => {
    res.json({ benchmarks: BENCHMARK_DATASET });
  });

  // Run a benchmark test case directly
  app.post('/api/evaluate/run-benchmark', optionalJWT, async (req, res) => {
    try {
      const { benchmarkId } = req.body;
      const benchmark = BENCHMARK_DATASET.find((b) => b.id === benchmarkId);
      if (!benchmark) {
        return res.status(404).json({ error: 'Benchmark scenario not found.' });
      }

      const startTime = Date.now();
      const lastTurn = benchmark.turns[benchmark.turns.length - 1];
      const priorTurns = benchmark.turns.slice(0, -1).map((t) => ({ role: 'user', content: t.user }));

      const ambiguity = detectAmbiguity(lastTurn.user, priorTurns);

      let responseText = '';
      let latencyMs = 0;
      let usedProvider = 'gemini';
      let usedModel = 'gemini-2.5-flash';

      if (ambiguity.isAmbiguous && ambiguity.suggestedClarification) {
        responseText = ambiguity.suggestedClarification;
        latencyMs = Date.now() - startTime;
        usedProvider = 'heuristic';
        usedModel = 'Ambiguity-Heuristic';
      } else {
        const result = await generateResponse(
          priorTurns,
          lastTurn.user,
          'You are an evaluation test subject AI. Answer accurately and follow all constraints strictly.'
        );
        responseText = result.text;
        latencyMs = result.latencyMs;
        usedProvider = result.provider;
        usedModel = result.model;
      }

      const lowerResponse = responseText.toLowerCase();
      const matchedKeywords = (lastTurn.expectedContextSubstrings || []).filter((k) => lowerResponse.includes(k.toLowerCase()));
      const keywordPassRate = Number((matchedKeywords.length / Math.max(1, (lastTurn.expectedContextSubstrings || []).length)).toFixed(2));
      const passed = keywordPassRate >= 0.5;

      const coherence = calculateCoherenceScore(priorTurns, lastTurn.user, responseText);

      return res.json({
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        category: benchmark.category,
        response: responseText,
        latencyMs,
        provider: usedProvider,
        model: usedModel,
        expectedKeywords: lastTurn.expectedContextSubstrings || [],
        matchedKeywords,
        passed,
        coherenceScore: coherence.score,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Benchmark run failed: ' + err.message });
    }
  });

  // Submit manual rubric score (1-5 scale)
  app.post('/api/evaluate/rubric', optionalJWT, async (req, res) => {
    try {
      const { sessionId, messageId, relevance, coherence, helpfulness, feedback } = req.body;
      if (!relevance || !coherence || !helpfulness) {
        return res.status(400).json({ error: 'Relevance, coherence, and helpfulness (1-5) are required.' });
      }

      const scoreDoc = {
        id: 'rubric_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        sessionId: sessionId || 'eval-session',
        messageId: messageId || 'msg-eval',
        userId: req.user?.id || 'guest-user-default',
        relevance: Math.min(5, Math.max(1, Number(relevance))),
        coherence: Math.min(5, Math.max(1, Number(coherence))),
        helpfulness: Math.min(5, Math.max(1, Number(helpfulness))),
        feedback: feedback?.trim() || '',
        timestamp: new Date().toISOString(),
      };

      await db.saveRubricScore(scoreDoc);
      return res.status(201).json({ message: 'Score saved', rubric: scoreDoc });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to record rubric: ' + err.message });
    }
  });

  // Get Evaluation Summary & Analytics
  app.get('/api/evaluate/summary', async (req, res) => {
    try {
      const summary = await getEvaluationSummary();
      return res.json(summary);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch evaluation summary: ' + err.message });
    }
  });

  // ==========================================
  // STATIC SERVING (FOR BUILT PRODUCTION FRONTEND)
  // ==========================================
  const clientDistPath = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  function listenWithRetry(portToTry, maxRetries = 10) {
    const serverInstance = app.listen(portToTry, '0.0.0.0', () => {
      console.log('\n======================================================');
      console.log('🚀 CosmoAI Backend Server Ready!');
      console.log(`➜ API URL: http://localhost:${portToTry}`);
      console.log(`➜ Status:  http://localhost:${portToTry}/api/system/status`);
      console.log('======================================================\n');
    });

    serverInstance.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && maxRetries > 0) {
        console.warn(`⚠️ Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
        listenWithRetry(portToTry + 1, maxRetries - 1);
      } else {
        console.error('Server listen error:', err);
        process.exit(1);
      }
    });
  }

  listenWithRetry(PORT);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
