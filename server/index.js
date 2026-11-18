// Process-level guards against unexpected crashes
process.on('uncaughtException', (err) => {
  console.error('[CosmoAI Server] Uncaught exception intercepted:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CosmoAI Server] Unhandled rejection intercepted:', reason);
});

import express from 'express';
import helmet from 'helmet';
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
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: envPath });
}

import { initDatabase, db, isDatabaseMongo } from './db/store.js';
import { validateAndLogModelConfig, getGeminiPrimaryModel, getModelConfigSummary } from './config/models.js';
import { initChroma, getChromaStatus, seedKnowledgeToChroma, assertChromaLoopback } from './services/chromaService.js';
import { checkModels } from '../scripts/check-models.js';
import { generateResponse, generateStreamResponse, getActiveProviderName, getGeminiBreakerInfo } from './services/llmProvider.js';
import { getSessionContext, estimateTokenCount, resolveActiveSessionFile, detectAndRepairOrphans } from './services/contextManager.js';
import { withSessionLock } from './services/sessionLock.js';
import { processAndSaveUserMemories, searchUserMemories, searchKnowledgeBase } from './services/memoryManager.js';
import { validateMemoryFact } from './services/langchainMemory.js';
import { detectAmbiguity } from './services/ambiguityDetector.js';
import {
  calculateCoherenceScore,
  BENCHMARK_DATASET,
  BENCHMARK_DATASET_40,
  getEvaluationSummary,
  evaluateWithIndependentJudge,
  evaluatePairwiseBlind,
} from './services/evaluationSuite.js';
import {
  authenticateJWT,
  optionalJWT,
  generateToken,
  hashPassword,
  verifyPassword,
  assertResourceOwnership,
  getJwtSecret,
  validatePasswordStrength,
  DUMMY_HASH,
  authRateLimiter,
  recordAuthFailure,
  recordAuthSuccess,
  getSecureClientIp,
  parseCookies,
  generateCsrfToken,
} from './middleware/auth.js';
import { inputSanitizationMiddleware } from './middleware/sanitizer.js';
import { indexDocument, getDocumentMetadata, deleteDocument } from './services/ragService.js';
import { enqueueFileJob, getJobStatus } from './services/extractors/asyncJobQueue.js';
import {
  detectFileTypeAndValidate,
  sanitizeFilename,
  deleteRawFile,
  checkUserUploadQuota,
  recordUserUploadUsage,
  SESSION_FILE_CAP,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_DIR,
} from './services/extractors/fileValidator.js';

// ==========================================
// CHAT ROUTE HANDLER (POST /api/chat or /chat)
// Supports 3-Tier Memory Context Assembly + Streaming
// ==========================================
export async function handleChat(req, res) {
  const startTime = Date.now();
  const { sessionId, message, systemPrompt, providerOverride, modelOverride, stream, fileId, allowWebSearch } = req.body;
  const userId = req.user?.id || 'guest-user-default';
  const defaultAllowWebSearch = process.env.DEFAULT_ALLOW_WEB_SEARCH !== undefined
    ? String(process.env.DEFAULT_ALLOW_WEB_SEARCH).trim().toLowerCase() === 'true'
    : true;
  const effectiveAllowWebSearch = allowWebSearch !== undefined ? Boolean(allowWebSearch) : defaultAllowWebSearch;

  if (!sessionId) {
    return res.status(400).json({ error: 'Field "sessionId" is required.' });
  }

  if (message === undefined || message === null || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
  }

  // Acquire exclusive per-session FIFO lock to serialize concurrent sends
  return await withSessionLock(sessionId, async () => {
    try {
      const cleanMessage = message.trim();
    const sessionTitle = cleanMessage.length > 0
      ? cleanMessage.substring(0, 35) + (cleanMessage.length > 35 ? '...' : '')
      : 'New Conversation';

    // 1. Verify / ensure session exists and validate ownership
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
    } else {
      if (!assertResourceOwnership(res, session, userId, 'Session')) return;
      if (session.messageCount === 0 && (!session.title || session.title === 'New Conversation')) {
        await db.updateSessionTitle(sessionId, sessionTitle);
      }
    }

    // 1b. Validate attached file ownership if explicit fileId is supplied
    if (fileId) {
      const fileMeta = await db.getFileMetadata(fileId);
      if (!assertResourceOwnership(res, fileMeta, userId, 'Document')) return;
    }

    // 2. Resolve Active Session File / Attached Media First
    const rawMessages = await db.getMessagesBySession(sessionId);
    const activeFile = await resolveActiveSessionFile(sessionId, message, fileId, rawMessages, userId);
    const hasActiveFile = Boolean(activeFile || fileId);
    const hasActiveMedia = Boolean(req.body.mediaPayload || activeFile?.isVisionRequired);

    // 3. Ambiguity Detection Heuristic (Evaluated BEFORE Fact Extraction and RAG assembly)
    const priorTurns = rawMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const ambiguity = detectAmbiguity(message, priorTurns, {
      hasActiveFile,
      activeFile,
      hasMedia: hasActiveMedia,
    });

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
        attachedFileId: activeFile?.fileId || fileId || null,
        attachedFilename: activeFile?.filename || null,
        attachedFileType: activeFile?.fileType || null,
        attachedChunksCount: 0,
      },
    };
    await db.saveMessage(userMessageDoc);

    // If Ambiguity is detected, return clarifying question immediately.
    // CRITICAL: Fact extraction (LangChain) is SKIPPED on intercepted turns, guaranteeing true 0-token cost.
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
          contextTurnsUsed: priorTurns.length,
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
        contextTurnsUsed: priorTurns.length,
        ambiguityDetected: true,
        coherenceScore: 1.0,
        retrievedMemories: [],
      });
    }

    // 4. Extract Persistent Facts into Tier 2 User Memory ONLY AFTER ambiguity check passes
    try {
      await processAndSaveUserMemories(userId, message, sessionId);
    } catch (memErr) {
      console.warn('Memory auto-extraction notice:', memErr.message);
    }

    // 5. Assemble 3-Tier Context + Document RAG Excerpts
    const context = await getSessionContext(sessionId, message, userId, { fileId, activeFile, rawMessages });
    userMessageDoc.metadata.attachedChunksCount = context.relevantDocumentChunks?.length || 0;

    // 5. System Prompt Isolation + Injected Long-Term Memories & Knowledge
    const baseSystemPrompt =
      systemPrompt && systemPrompt.trim().length > 0
        ? systemPrompt.trim()
        : 'You are an intelligent, helpful, and concise conversational AI assistant. Maintain context across multi-turn dialogues and deliver accurate, structured responses.';

    const effectiveSystemPrompt = baseSystemPrompt + context.contextualMemorySection;
    const targetProvider = providerOverride || getActiveProviderName();

    // 5b. Resolve and load multimodal media payload (Image or Video)
    let mediaPayload = null;
    if (
      context.attachedDocumentMeta &&
      (context.attachedDocumentMeta.fileType === 'image' || context.attachedDocumentMeta.fileType === 'video')
    ) {
      try {
        const filePath =
          context.attachedDocumentMeta.storagePath ||
          path.resolve(UPLOAD_DIR, `${context.attachedDocumentMeta.fileId}.bin`);
        if (fs.existsSync(filePath)) {
          const mediaBuf = await fs.promises.readFile(filePath);
          if (mediaBuf.length <= 20 * 1024 * 1024) {
            const extractedMediaText =
              context.attachedDocumentMeta.rawText ||
              (context.relevantDocumentChunks || []).map((c) => c.content).join('\n') ||
              context.attachedDocumentMeta.summary ||
              '';
            mediaPayload = {
              mimeType: context.attachedDocumentMeta.mimeType,
              data: mediaBuf.toString('base64'),
              filename: context.attachedDocumentMeta.filename,
              fileType: context.attachedDocumentMeta.fileType,
              extractedText: extractedMediaText,
              ocrText: extractedMediaText,
            };
            console.log(`[handleChat] Loaded multimodal media payload (${(mediaBuf.length / (1024 * 1024)).toFixed(2)} MB, ${context.attachedDocumentMeta.mimeType}) for "${context.attachedDocumentMeta.filename}"`);
          } else {
            console.warn(`[handleChat] Media file exceeds 20MB inline limit (${(mediaBuf.length / (1024 * 1024)).toFixed(2)} MB), falling back to indexed RAG chunks.`);
          }
        } else {
          console.warn(`[handleChat] Media file not found on disk at: ${filePath}`);
        }
      } catch (mediaErr) {
        console.warn('[handleChat] Could not load media buffer for multimodal:', mediaErr.message);
      }
    }

    // 6. Handle Streaming Response if requested
    if (stream) {
      // Set anti-proxy buffering headers for real-time SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');

      // Heartbeat comment emitted every 15s to keep connections alive through proxies
      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded) {
          try {
            res.write(': heartbeat\n\n');
          } catch (e) {
            // connection dropped
          }
        }
      }, 15000);
      if (heartbeatTimer.unref) heartbeatTimer.unref();

      // Client disconnect abort controller to immediately halt upstream token consumption
      const clientAbortController = new AbortController();
      let clientDisconnected = false;

      const cleanupStreaming = () => {
        clearInterval(heartbeatTimer);
        if (typeof req.removeListener === 'function') {
          req.removeListener('close', onClientDisconnect);
        }
      };

      const onClientDisconnect = () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
          cleanupStreaming();
          clientAbortController.abort();
        }
      };

      if (typeof req.on === 'function') {
        req.on('close', onClientDisconnect);
      }

      try {
        const streamResult = await generateStreamResponse(
          context.history,
          message,
          effectiveSystemPrompt,
          (chunkText) => {
            if (!res.writableEnded && !clientAbortController.signal.aborted) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
            }
          },
          {
            provider: targetProvider,
            model: modelOverride,
            media: mediaPayload,
            mediaPayload: mediaPayload,
            sessionId,
            userId,
            res,
            abortSignal: clientAbortController.signal,
            allowWebSearch: effectiveAllowWebSearch,
            onEvent: (event, data) => {
              if (!res.writableEnded && !clientAbortController.signal.aborted) {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
              }
            },
          }
        );

        cleanupStreaming();

        if (streamResult.partial || streamResult.incomplete || clientAbortController.signal.aborted) {
          if (!res.writableEnded) {
            res.end();
          }
          return;
        }

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
            degraded: streamResult.degraded || false,
            degradedReason: streamResult.degradedReason || null,
            retrievedMemoriesCount: context.relevantMemories.length,
            attachedFileId: fileId || context.resolvedFileId || null,
            attachedFilename: context.attachedDocumentMeta?.filename || null,
            attachedFileType: context.attachedDocumentMeta?.fileType || null,
            attachedChunksCount: context.relevantDocumentChunks?.length || 0,
            citations: context.citations || [],
            usedWebSearch: streamResult.usedWebSearch || false,
            forcedSearch: streamResult.forcedSearch || false,
            searchQuery: streamResult.searchQuery || null,
            sources: streamResult.sources || [],
            unverifiedClaim: streamResult.unverifiedClaim || false,
            unverifiedWarning: streamResult.unverifiedWarning || null,
            classification: streamResult.classification || null,
          },
        };
        await db.saveMessage(assistantMessageDoc);

        if (!res.writableEnded) {
          res.write(`event: done\ndata: ${JSON.stringify({
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
            degraded: streamResult.degraded || false,
            degradedReason: streamResult.degradedReason || null,
            retrievedMemories: context.relevantMemories,
            attachedDocument: context.attachedDocumentMeta || null,
            citations: context.citations || [],
            sources: streamResult.sources || [],
            unverifiedClaim: streamResult.unverifiedClaim || false,
            unverifiedWarning: streamResult.unverifiedWarning || null,
            classification: streamResult.classification || null,
          })}\n\n`);
          return res.end();
        }
      } catch (streamErr) {
        cleanupStreaming();
        console.error('Streaming generation error:', streamErr);
        if (!res.writableEnded) {
          res.write(`event: error\ndata: ${JSON.stringify({
            type: 'error',
            code: streamErr.code || 'STREAM_ERROR',
            message: streamErr.message,
            error: streamErr.message,
            partial: true,
          })}\n\n`);
          return res.end();
        }
      }
    }

    // 7. Non-streaming standard generation
    const llmResult = await generateResponse(
      context.history,
      message,
      effectiveSystemPrompt,
      {
        provider: targetProvider,
        model: modelOverride,
        media: mediaPayload,
        mediaPayload: mediaPayload,
        allowWebSearch: effectiveAllowWebSearch,
      }
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
        degraded: llmResult.degraded || false,
        degradedReason: llmResult.degradedReason || null,
        retrievedMemoriesCount: context.relevantMemories.length,
        attachedFileId: fileId || context.resolvedFileId || null,
        attachedFilename: context.attachedDocumentMeta?.filename || null,
        attachedFileType: context.attachedDocumentMeta?.fileType || null,
        attachedChunksCount: context.relevantDocumentChunks?.length || 0,
        citations: context.citations || [],
        usedWebSearch: llmResult.usedWebSearch || false,
        forcedSearch: llmResult.forcedSearch || false,
        searchQuery: llmResult.searchQuery || null,
        sources: llmResult.sources || [],
        unverifiedClaim: llmResult.unverifiedClaim || false,
        unverifiedWarning: llmResult.unverifiedWarning || null,
        classification: llmResult.classification || null,
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
      citations: context.citations || [],
      usedWebSearch: llmResult.usedWebSearch || false,
      forcedSearch: llmResult.forcedSearch || false,
      searchQuery: llmResult.searchQuery || null,
      sources: llmResult.sources || [],
      unverifiedClaim: llmResult.unverifiedClaim || false,
      unverifiedWarning: llmResult.unverifiedWarning || null,
      classification: llmResult.classification || null,
    });
    } catch (err) {
      console.error('Chat processing error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to process chat message',
      });
    }
  });
}

export async function createApp() {
  // Fail fast at startup if JWT_SECRET is missing, empty, or shorter than 32 chars
  getJwtSecret();

  // Startup Security Guard: Refuse to start if Chroma URL answers on or points to a non-loopback address
  assertChromaLoopback(process.env.CHROMA_URL || 'http://127.0.0.1:8000');

  // Validate model configuration and fail fast or switch to alternative if invalid
  validateAndLogModelConfig({ quiet: process.env.NODE_ENV === 'test' });

  // Startup Live Model Catalog Audit: In strict mode, verifies EVERY configured model against provider APIs
  const isStrictModelAudit =
    process.env.STRICT_MODEL_AUDIT === 'true' ||
    process.env.MODEL_AUDIT_STRICT === 'true' ||
    process.argv.includes('--strict-models');

  if (isStrictModelAudit) {
    const auditSummary = await checkModels({ verbose: false, strict: true, saveToFile: true });
    if (auditSummary.missingConfigured && auditSummary.missingConfigured.length > 0) {
      console.error('[Startup] ❌ FATAL: Model catalog audit failed in strict mode. Missing configured models:');
      console.table(auditSummary.missingConfigured);
      throw new Error(
        `[Startup] Fatal: ${auditSummary.missingConfigured.length} configured models are missing or retired from live provider catalogs: ${auditSummary.missingConfigured.map((m) => m.id).join(', ')}`
      );
    }
  }

  const app = express();

  // Configure trust proxy correctly so IP rate limits are not shared by all users or spoofable via X-Forwarded-For
  const trustProxyConfig =
    process.env.TRUST_PROXY !== undefined
      ? (process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY === 'false' ? false : process.env.TRUST_PROXY)
      : (process.env.NODE_ENV === 'production' ? 'loopback' : false);
  app.set('trust proxy', trustProxyConfig);

  // Security Headers via Helmet with strict Content-Security-Policy (strictly no inline scripts)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // Strictly no 'unsafe-inline' or 'unsafe-eval'
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS & UI dynamic styling
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*', 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Initialize Local Persistent Store
  const dbStatus = await initDatabase();
  await db.expireStaleJobs();

  // Initialize Chroma DB Vector Store
  const chromaStatus = await initChroma();
  try {
    const knowledgeChunks = await db.getKnowledgeChunks();
    await seedKnowledgeToChroma(knowledgeChunks);
  } catch (seedErr) {
    // Non-blocking
  }

  // Strict CORS allowlist from env with Vite frontend defaults (port 3000, 5173, 5000)
  const defaultCorsOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ];
  if (process.env.APP_URL) {
    try {
      const appOrigin = new URL(process.env.APP_URL).origin;
      if (!defaultCorsOrigins.includes(appOrigin)) {
        defaultCorsOrigins.push(appOrigin);
      }
    } catch {
      defaultCorsOrigins.push(process.env.APP_URL.trim());
    }
  }

  const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultCorsOrigins;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, supertest, server-to-server)
        if (!origin) return callback(null, true);
        if (corsAllowedOrigins.includes('*') || corsAllowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // In local development, permit loopback requests on any port
        if (process.env.NODE_ENV !== 'production') {
          try {
            const parsedOrigin = new URL(origin);
            if (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1') {
              return callback(null, true);
            }
          } catch {
            // fall through
          }
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const isTestEnv = process.env.NODE_ENV === 'test';

  // Rate Limiting for Chat (default: 30 requests per minute per IP)
  const chatWindowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000;
  const chatLimit = Number(process.env.CHAT_RATE_LIMIT_MAX) || 30;
  const chatRateLimiter = isTestEnv
    ? (req, res, next) => next()
    : rateLimit({
      windowMs: chatWindowMs,
      limit: chatLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      validate: {
        xForwardedForHeader: false,
        forwardedHeader: false,
        trustProxy: false,
        default: false,
      },
      message: { error: `Rate limit exceeded (${chatLimit} requests per ${Math.round(chatWindowMs / 60000) || 1} minute). Please slow down.` },
    });

  // Dedicated Rate Limiter for File Uploads (default: 10 uploads per 5 minutes per IP)
  const uploadWindowMs = Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
  const uploadLimit = Number(process.env.UPLOAD_RATE_LIMIT_MAX) || 10;
  const uploadRateLimiter = isTestEnv
    ? (req, res, next) => next()
    : rateLimit({
      windowMs: uploadWindowMs,
      limit: uploadLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      validate: {
        xForwardedForHeader: false,
        forwardedHeader: false,
        trustProxy: false,
        default: false,
      },
      message: { error: `Upload rate limit reached (${uploadLimit} uploads per ${Math.round(uploadWindowMs / 60000) || 5} minutes). Please try again later.` },
    });

  // Breaker Health Status Endpoint: GET /api/health
  app.get('/api/health', (req, res) => {
    const breaker = getGeminiBreakerInfo();
    const chroma = getChromaStatus();
    const store = db.getStoreStatus ? db.getStoreStatus() : { status: dbStatus.message };
    const modelSummary = getModelConfigSummary();
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
    const hasGroq = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '');

    const isBreakerOpen = breaker.state === 'OPEN';
    const hasPersistError = Boolean(store && store.lastPersistError);
    const isDegraded = isBreakerOpen || hasPersistError;

    return res.json({
      status: isDegraded ? 'degraded' : 'ok',
      provider: {
        active: getActiveProviderName(),
        gemini: {
          available: hasGemini,
          primaryModel: modelSummary.gemini.primary,
          fallbacks: modelSummary.gemini.fallbacks,
        },
        groq: {
          available: hasGroq,
          primaryModel: modelSummary.groq.primary,
          fallbacks: modelSummary.groq.fallbacks,
        },
        embedding: {
          model: modelSummary.embedding.model,
        },
      },
      breaker: {
        provider: breaker.provider,
        state: breaker.state,
        openUntil: breaker.openUntil,
        consecutiveFailures: breaker.consecutiveFailures,
      },
      chroma: {
        provider: chroma.provider || 'chroma',
        status: chroma.connected ? 'connected' : 'fallback_local',
        connected: Boolean(chroma.connected),
        url: chroma.url,
        collectionsReady: Boolean(chroma.collectionsReady),
      },
      store: {
        type: store.type || 'Local Persistent Store (JSON File)',
        schemaVersion: store.schemaVersion || 2,
        status: store.status || 'Ready',
        lastPersistError: store.lastPersistError || null,
        isDirty: Boolean(store.isDirty),
        sessionsCount: store.sessionsCount ?? 0,
        usersCount: store.usersCount ?? 0,
        memoriesCount: store.memoriesCount ?? 0,
        filesCount: store.filesCount ?? 0,
        chunksCount: store.chunksCount ?? 0,
      },
      // Backward compatibility fields
      state: breaker.state,
      openUntil: breaker.openUntil,
      consecutiveFailures: breaker.consecutiveFailures,
    });
  });

  // Health / System Status
  app.get('/api/system/status', (req, res) => {
    const activeProvider = getActiveProviderName();
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
    const currentChromaStatus = getChromaStatus();
    const breaker = getGeminiBreakerInfo();

    res.json({
      status: 'online',
      activeProvider,
      geminiAvailable: hasGemini,
      breaker: {
        provider: breaker.provider,
        state: breaker.state,
        openUntil: breaker.openUntil,
      },
      database: {
        type: 'Local Persistent Store (JSON File)',
        location: 'data/local_store.json',
        status: dbStatus.message,
      },
      vectorDb: currentChromaStatus,
      defaultModel: getGeminiPrimaryModel(),
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

      // Password rules: min length 10, reject common passwords, reject > 72 bytes
      const pwValidation = validatePasswordStrength(password);
      if (!pwValidation.valid) {
        return res.status(400).json({ error: pwValidation.error });
      }

      const existingUser = (await db.findUserByEmail(email)) || (await db.findUserByUsername(username));
      if (existingUser) {
        // Equalize execution time by computing a bcrypt hash so attackers cannot discern registered emails via response timing
        await hashPassword(password);
        return res.status(400).json({
          error: 'Registration could not be completed with the provided credentials. If you already have an account, please log in.',
        });
      }

      const clientIp = getSecureClientIp(req);
      const passwordHash = await hashPassword(password);
      const newUser = {
        id: 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        tokenVersion: 1,
        knownIps: [clientIp],
        createdAt: new Date().toISOString(),
      };

      await db.createUser(newUser);
      recordAuthSuccess(req, email);

      const token = generateToken({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        tokenVersion: newUser.tokenVersion,
      });

      const csrfToken = generateCsrfToken();
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('cosmo_auth_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('cosmo_csrf_token', csrfToken, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        csrfToken,
        user: { id: newUser.id, username: newUser.username, email: newUser.email, tokenVersion: newUser.tokenVersion },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  };

  app.post('/api/auth/register', authRateLimiter, handleRegister);
  app.post('/auth/register', authRateLimiter, handleRegister);

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
        // Run dummy bcrypt compare to equalize timing against timing attacks
        await verifyPassword(password, DUMMY_HASH);
        recordAuthFailure(req, emailOrUsername, false);
        return res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
      }

      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        recordAuthFailure(req, user.email, true);
        return res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
      }

      recordAuthSuccess(req, user.email);
      const clientIp = getSecureClientIp(req);
      if (typeof db.addKnownUserIp === 'function') {
        await db.addKnownUserIp(user.id, clientIp);
      }

      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 1,
      });

      const csrfToken = generateCsrfToken();
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('cosmo_auth_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('cosmo_csrf_token', csrfToken, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      return res.json({
        message: 'Login successful',
        token,
        csrfToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 1,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Login failed: ' + err.message });
    }
  };

  app.post('/api/auth/login', authRateLimiter, handleLogin);
  app.post('/auth/login', authRateLimiter, handleLogin);

  // Logout / Revoke Token: POST /api/auth/logout
  const handleLogout = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      await db.revokeUserTokens(userId);
      res.clearCookie('cosmo_auth_token');
      res.clearCookie('cosmo_csrf_token');
      return res.json({
        message: 'Successfully logged out. All session tokens have been revoked.',
      });
    } catch (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed: ' + err.message });
    }
  };
  app.post('/api/auth/logout', authenticateJWT, handleLogout);
  app.post('/auth/logout', authenticateJWT, handleLogout);

  // Refresh Token: POST /api/auth/refresh
  const handleRefresh = async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      const user = await db.findUserById(userId);
      if (!user) {
        return res.status(401).json({ error: 'User no longer exists.' });
      }
      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 1,
      });
      const csrfToken = generateCsrfToken();
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('cosmo_auth_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('cosmo_csrf_token', csrfToken, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      return res.json({
        message: 'Token refreshed successfully',
        token,
        csrfToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 1,
        },
      });
    } catch (err) {
      console.error('Refresh error:', err);
      return res.status(500).json({ error: 'Token refresh failed: ' + err.message });
    }
  };
  app.post('/api/auth/refresh', authenticateJWT, handleRefresh);
  app.post('/auth/refresh', authenticateJWT, handleRefresh);

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
      const userId = req.user?.id || 'guest-user-default';
      const session = await db.getSessionById(sessionId);
      if (!assertResourceOwnership(res, session, userId, 'Session')) return;
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
      const userId = req.user?.id || 'guest-user-default';
      const session = await db.getSessionById(sessionId);
      if (!assertResourceOwnership(res, session, userId, 'Session')) return;

      const rawMessages = await db.getMessagesBySession(sessionId);
      const { messages } = detectAndRepairOrphans(rawMessages);
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
      const valCheck = validateMemoryFact({ key, fact, category: category || 'general' });
      if (!valCheck.valid) {
        return res.status(400).json({ error: `Memory fact rejected: ${valCheck.reason}` });
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
      const memory = await db.getUserMemoryById(id);
      if (!assertResourceOwnership(res, memory, userId, 'Memory')) return;

      const { key, fact, category } = req.body;
      if (fact || key || category) {
        const valCheck = validateMemoryFact({
          key: key || memory.key,
          fact: fact || memory.fact,
          category: category || memory.category || 'general',
        });
        if (!valCheck.valid) {
          return res.status(400).json({ error: `Memory fact rejected: ${valCheck.reason}` });
        }
      }
      const updated = await db.updateUserMemory(id, userId, {
        ...(key && { key: key.trim().toLowerCase().replace(/\s+/g, '_') }),
        ...(fact && { fact: fact.trim() }),
        ...(category && { category }),
      });
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
      const memory = await db.getUserMemoryById(id);
      if (!assertResourceOwnership(res, memory, userId, 'Memory')) return;

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
  // FILE UPLOAD & ASYNC RAG DOCUMENT ROUTES
  // ==========================================
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
  });

  // Async File Upload Endpoint (POST /api/files/upload)
  app.post('/api/files/upload', uploadRateLimiter, optionalJWT, upload.single('file'), async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const sessionId = req.body?.sessionId || req.query?.sessionId || 'default-session';

      // Check session ownership if target session exists
      if (sessionId && sessionId !== 'default-session') {
        const session = await db.getSessionById(sessionId);
        if (session && !assertResourceOwnership(res, session, userId, 'Session')) return;
      }

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

      // Check per-user daily upload quota (count and byte volume)
      checkUserUploadQuota(userId, fileBuffer.length);

      // Check per-session file cap
      const existingSessionFiles = await db.getFilesBySession(sessionId);
      if (existingSessionFiles.length >= SESSION_FILE_CAP) {
        return res.status(400).json({
          error: `Session file cap reached. Maximum ${SESSION_FILE_CAP} files allowed per conversation session.`,
        });
      }

      // Sanitize incoming filename (prevent directory traversal, Bidi RTL overrides, control characters)
      const safeFilename = sanitizeFilename(originalname || 'document.bin');

      // Validate by magic bytes, enforce max file size, and check for polyglots/bombs
      const validation = detectFileTypeAndValidate(fileBuffer, safeFilename, mimetype);

      const fileId = 'file_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

      // Enqueue job into async background worker queue
      const job = await enqueueFileJob({
        fileId,
        sessionId,
        userId,
        filename: safeFilename,
        buffer: fileBuffer,
        mimeType: validation.mimeType,
      });

      // Record successful user upload usage towards daily quota
      recordUserUploadUsage(userId, fileBuffer.length);

      return res.status(202).json({
        message: 'File accepted for background extraction and indexing',
        jobId: job.jobId,
        fileId,
        sessionId,
        filename: safeFilename,
        status: job.status,
      });
    } catch (err) {
      console.error('File upload error:', err);
      if (err.name === 'UserQuotaExceededError' || err.code === 'USER_QUOTA_EXCEEDED') {
        return res.status(429).json({
          error: err.userMessage || err.message,
          code: 'USER_QUOTA_EXCEEDED',
        });
      }
      return res.status(400).json({
        error: err.userMessage || err.message || 'Failed to process document upload.',
        code: err.code || 'UPLOAD_FAILED',
      });
    }
  });

  // Async Job Status Polling Endpoint (GET /api/files/status/:jobId)
  app.get('/api/files/status/:jobId', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { jobId } = req.params;
      const job = await getJobStatus(jobId);
      if (!assertResourceOwnership(res, job, userId, 'Extraction job')) return;
      return res.json({ job });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch job status: ' + err.message });
    }
  });

  // Get all active files for a session (GET /api/files/session/:sessionId)
  app.get('/api/files/session/:sessionId', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { sessionId } = req.params;
      const session = await db.getSessionById(sessionId);
      if (!assertResourceOwnership(res, session, userId, 'Session')) return;
      const files = await db.getFilesBySession(sessionId);
      return res.json({ files });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch session files: ' + err.message });
    }
  });

  // Get Document Metadata (GET /api/files/:fileId)
  app.get('/api/files/:fileId', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { fileId } = req.params;
      const meta = await db.getFileMetadata(fileId);
      if (!assertResourceOwnership(res, meta, userId, 'Document')) return;
      return res.json({ document: meta });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch document: ' + err.message });
    }
  });

  // Get Raw File / Media Preview (GET /api/files/preview/:fileId or /api/files/:fileId/raw)
  const handleFilePreview = async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { fileId } = req.params;
      const meta = await db.getFileMetadata(fileId);
      if (!assertResourceOwnership(res, meta, userId, 'File')) return;
      const filePath = meta?.storagePath || path.resolve(UPLOAD_DIR, `${fileId}.bin`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File content not found on server.' });
      }

      const mimeType = meta?.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      console.error('File preview error:', err);
      return res.status(500).json({ error: 'Failed to serve file: ' + err.message });
    }
  };

  app.get('/api/files/preview/:fileId', optionalJWT, handleFilePreview);
  app.get('/api/files/:fileId/raw', optionalJWT, handleFilePreview);

  // Delete Document (DELETE /api/files/:fileId)
  app.delete('/api/files/:fileId', optionalJWT, async (req, res) => {
    try {
      const userId = req.user?.id || 'guest-user-default';
      const { fileId } = req.params;
      const meta = await db.getFileMetadata(fileId);
      if (!assertResourceOwnership(res, meta, userId, 'Document')) return;
      await deleteRawFile(fileId);
      const deleted = await db.deleteFile(fileId);
      return res.json({ success: deleted, fileId });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete document: ' + err.message });
    }
  });

  // ==========================================
  // CHAT ROUTE (POST /api/chat or /chat)
  // Supports 3-Tier Memory Context Assembly + Streaming
  // ==========================================
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
      let usedModel = getGeminiPrimaryModel();

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

  // Submit manual or automated cross-provider rubric evaluation
  app.post('/api/evaluate/rubric', optionalJWT, async (req, res) => {
    try {
      const {
        sessionId,
        messageId,
        relevance,
        coherence,
        helpfulness,
        groundedness,
        directiveIsolation,
        feedback,
        autoJudge,
        dialogueHistory,
        userQuery,
        candidateResponse,
        expectedBehavior,
        hardCaseType,
        judgeModel,
        judgeProvider,
      } = req.body;

      const userId = req.user?.id || 'guest-user-default';

      if (sessionId && sessionId !== 'eval-session') {
        const session = await db.getSessionById(sessionId);
        if (session && !assertResourceOwnership(res, session, userId, 'Session')) return;
      }
      if (messageId && messageId !== 'msg-eval') {
        const message = await db.getMessageById(messageId);
        if (message && message.sessionId) {
          const session = await db.getSessionById(message.sessionId);
          if (session && !assertResourceOwnership(res, session, userId, 'Message')) return;
        }
      }

      // Automated Cross-Provider LLM-as-a-Judge Evaluation
      if (autoJudge === true || (userQuery && candidateResponse && !relevance)) {
        const judgeResult = await evaluateWithIndependentJudge({
          dialogueHistory: Array.isArray(dialogueHistory) ? dialogueHistory : [],
          userQuery: userQuery || '',
          candidateResponse: candidateResponse || '',
          expectedBehavior: expectedBehavior || '',
          hardCaseType: hardCaseType || 'general',
          options: { judgeModel, judgeProvider },
        });

        const scoreDoc = {
          id: 'rubric_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          sessionId: sessionId || 'eval-session',
          messageId: messageId || 'msg-eval',
          userId,
          relevance: judgeResult.scores.intentRelevance,
          coherence: judgeResult.scores.contextContinuity,
          helpfulness: judgeResult.scores.userHelpfulness,
          groundedness: judgeResult.scores.groundedness,
          directiveIsolation: judgeResult.scores.directiveIsolation,
          compositeScore: judgeResult.scores.compositeScore,
          judgeModel: judgeResult.metadata.judgeModel,
          judgeProvider: judgeResult.metadata.judgeProvider,
          judgePromptVersion: judgeResult.metadata.promptVersion,
          isCrossProvider: judgeResult.metadata.isCrossProvider,
          temperature: judgeResult.metadata.temperature,
          rationale: judgeResult.rationale,
          feedback: feedback?.trim() || judgeResult.rationale,
          timestamp: new Date().toISOString(),
        };

        await db.saveRubricScore(scoreDoc);
        return res.status(201).json({ message: 'Independent rubric score generated and saved', rubric: scoreDoc, evaluation: judgeResult });
      }

      // Manual Rubric Submission
      if (!relevance || !coherence || !helpfulness) {
        return res.status(400).json({ error: 'Relevance, coherence, and helpfulness (1-5) are required.' });
      }

      const scoreDoc = {
        id: 'rubric_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        sessionId: sessionId || 'eval-session',
        messageId: messageId || 'msg-eval',
        userId,
        relevance: Math.min(5, Math.max(1, Number(relevance))),
        coherence: Math.min(5, Math.max(1, Number(coherence))),
        helpfulness: Math.min(5, Math.max(1, Number(helpfulness))),
        groundedness: groundedness ? Math.min(5, Math.max(1, Number(groundedness))) : undefined,
        directiveIsolation: directiveIsolation ? Math.min(5, Math.max(1, Number(directiveIsolation))) : undefined,
        compositeScore: Number(((Number(relevance) + Number(coherence) + Number(helpfulness)) / 3).toFixed(2)),
        judgeModel: req.body.judgeModel || 'human-annotator',
        judgePromptVersion: req.body.judgePromptVersion || 'manual-v1',
        feedback: feedback?.trim() || '',
        timestamp: new Date().toISOString(),
      };

      await db.saveRubricScore(scoreDoc);
      return res.status(201).json({ message: 'Score saved', rubric: scoreDoc });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to record rubric: ' + err.message });
    }
  });

  // Pairwise Blind Evaluation Endpoint (CosmoAI vs Baseline with Position Debiasing)
  app.post('/api/evaluate/rubric/pairwise', optionalJWT, async (req, res) => {
    try {
      const { dialogueHistory, userQuery, cosmoResponse, baselineResponse, expectedBehavior, hardCaseType, judgeModel, judgeProvider } = req.body;
      if (!userQuery || !cosmoResponse || !baselineResponse) {
        return res.status(400).json({ error: 'userQuery, cosmoResponse, and baselineResponse are required for pairwise evaluation.' });
      }

      const result = await evaluatePairwiseBlind({
        dialogueHistory: Array.isArray(dialogueHistory) ? dialogueHistory : [],
        userQuery,
        cosmoResponse,
        baselineResponse,
        expectedBehavior: expectedBehavior || '',
        hardCaseType: hardCaseType || 'general',
        options: { judgeModel, judgeProvider },
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Pairwise blind evaluation failed: ' + err.message });
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

  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT) || 5000;

  function listenWithRetry(portToTry, maxRetries = 10) {
    const serverInstance = app.listen(portToTry, '0.0.0.0', () => {
      console.log('\n======================================================');
      console.log('🚀 CosmoAI Backend Server Ready!');
      console.log(`➜ API URL: http://localhost:${portToTry}`);
      console.log(`➜ Status:  http://localhost:${portToTry}/api/system/status`);
      console.log('======================================================\n');
    });

    // Configure keep-alive timeouts to prevent ECONNRESET race conditions with proxy servers
    serverInstance.keepAliveTimeout = 65000;
    serverInstance.headersTimeout = 66000;

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
  return app;
}

if (process.argv[1] === __filename) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
